#!/usr/bin/env python3
"""
MJPEG preview with Hailo YOLO person detection, IN/OUT line overlay, and crossing counts.

Requires on the Pi:
  sudo apt install python3-picamera2 python3-opencv hailo-all

Run (SSH on Pi):
  cd /opt/footcounter
  python3 preview_hailo_mjpeg.py

Browser (Mac): http://<pi-ip>:8000/index.html

Stop other camera apps first (plain preview_mjpeg.py, rpicam-hello, etc.).
"""
from __future__ import annotations

import io
import json
import logging
import os
import socketserver
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timezone
from http import server
from pathlib import Path
from threading import Condition

import cv2

try:
    from footcounter_per_event_sync import schedule_crossing_sync
except ImportError:

    def schedule_crossing_sync(
        _db_path: str,
        _row_id: int,
        _client_event_id: str,
        _occurred_at_iso: str,
        _direction: str,
        _confidence: float | None,
    ) -> None:
        pass


from picamera2 import MappedArray, Picamera2
from picamera2.encoders import JpegEncoder
from picamera2.outputs import FileOutput

try:
    from picamera2.devices import Hailo, hailo_architecture
except ImportError as e:
    raise SystemExit(
        "picamera2 Hailo device not available. On the Pi run:\n"
        "  sudo apt update && sudo apt install -y hailo-all python3-opencv\n"
        f"Original error: {e}"
    ) from e

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

BASE = Path(__file__).resolve().parent

# --- Shared state (inference thread writes, pre_callback reads) ---
_state_lock = threading.Lock()
_latest_persons: list[tuple[tuple[int, int, int, int], float]] = []  # ((x0,y0,x1,y1), score)
_count_in = 0
_count_out = 0
_stop = threading.Event()


def load_env(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, _, v = line.partition("=")
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v


def default_model_path() -> str:
    m = os.environ.get("HAILO_MODEL")
    if m:
        return m
    try:
        if hailo_architecture() == "HAILO10H":
            return "/usr/share/hailo-models/yolov8m_h10.hef"
    except Exception:
        pass
    return "/usr/share/hailo-models/yolov8s_h8l.hef"


def extract_detections(
    hailo_output,
    w: int,
    h: int,
    threshold: float,
    person_only: bool,
) -> list[tuple[tuple[int, int, int, int], float]]:
    """BBox in main-stream pixel coords; filter to COCO 'person' (class 0) if requested."""
    out: list[tuple[tuple[int, int, int, int], float]] = []
    for class_id, detections in enumerate(hailo_output):
        if person_only and class_id != 0:
            continue
        for detection in detections:
            score = detection[4]
            if score < threshold:
                continue
            y0, x0, y1, x1 = detection[:4]
            bbox = (int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h))
            out.append((bbox, float(score)))
    return out


def foot_xy(bbox: tuple[int, int, int, int]) -> tuple[float, float]:
    x0, y0, x1, y1 = bbox
    return ((x0 + x1) * 0.5, float(y1))


def region_vertical(fx: float, line_x: int) -> str:
    return "left" if fx < line_x else "right"


def region_horizontal(fy: float, line_y: int) -> str:
    return "top" if fy < line_y else "bottom"


class CrossingState:
    """Match feet frame-to-frame; count when region flips across the line."""

    def __init__(self, match_px: float) -> None:
        self.match_px = match_px
        self.prev: list[tuple[float, float, str]] = []

    def update(
        self,
        feet: list[tuple[float, float, str]],
    ) -> tuple[int, int]:
        """Returns (delta_in, delta_out) for this frame."""
        if not feet:
            self.prev = []
            return (0, 0)
        if not self.prev:
            self.prev = list(feet)
            return (0, 0)

        used: set[int] = set()
        din = dout = 0
        for pfx, pfy, pside in self.prev:
            best_i = None
            best_d = self.match_px
            for i, (cfx, cfy, cside) in enumerate(feet):
                if i in used:
                    continue
                d = ((cfx - pfx) ** 2 + (cfy - pfy) ** 2) ** 0.5
                if d < best_d:
                    best_d = d
                    best_i = i
            if best_i is None:
                continue
            used.add(best_i)
            cfx, cfy, cside = feet[best_i]
            if pside != cside:
                di, do = self._crossing_delta(pside, cside)
                din += di
                dout += do

        self.prev = list(feet)
        return (din, dout)

    def _crossing_delta(self, prev_side: str, curr_side: str) -> tuple[int, int]:
        in_region = os.environ.get("FOOTCOUNTER_IN_REGION", "left")
        if prev_side == curr_side:
            return (0, 0)
        if curr_side == in_region:
            return (1, 0)
        if prev_side == in_region:
            return (0, 1)
        return (0, 0)


def ensure_sync_columns(conn: sqlite3.Connection) -> None:
    try:
        conn.execute("SELECT client_event_id, synced_at FROM crossing_events LIMIT 1")
    except sqlite3.OperationalError:
        conn.executescript(
            """
            ALTER TABLE crossing_events ADD COLUMN client_event_id TEXT;
            ALTER TABLE crossing_events ADD COLUMN synced_at TEXT;
            """
        )
        conn.commit()


def ensure_db_schema(db_path: Path) -> None:
    schema_path = BASE / "sql" / "schema.sql"
    if not schema_path.is_file():
        return
    try:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(db_path))
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        conn.commit()
        conn.close()
    except OSError as e:
        logging.warning("Could not init DB schema at %s: %s", db_path, e)


def log_crossing_to_sqlite(db_path: Path, direction: str, score: float | None) -> None:
    try:
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        cid = str(uuid.uuid4())
        conn = sqlite3.connect(str(db_path))
        ensure_sync_columns(conn)
        cur = conn.execute(
            """
            INSERT INTO crossing_events (
              ts_utc, direction, confidence, track_id, model_name, raw_meta_json,
              client_event_id, synced_at
            )
            VALUES (?, ?, ?, NULL, 'hailo_yolov8_preview', ?, ?, NULL)
            """,
            (ts, direction, score, json.dumps({"source": "preview_hailo_mjpeg"}), cid),
        )
        row_id = int(cur.lastrowid)
        conn.commit()
        conn.close()
        schedule_crossing_sync(str(db_path), row_id, cid, ts, direction, score)
    except (OSError, sqlite3.Error) as e:
        logging.warning("sqlite log failed: %s", e)


def make_pre_callback(line_x: int, line_y: int, vertical: bool) -> object:
    def draw_overlay(request: object) -> None:
        global _count_in, _count_out
        with _state_lock:
            persons = list(_latest_persons)
            ci, co = _count_in, _count_out

        with MappedArray(request, "main") as m:
            arr = m.array
            h, w = arr.shape[0], arr.shape[1]

            # Counting line
            if vertical:
                cv2.line(arr, (line_x, 0), (line_x, h - 1), (0, 255, 255, 255), 3)
            else:
                cv2.line(arr, (0, line_y), (w - 1, line_y), (0, 255, 255, 255), 3)

            in_region = os.environ.get("FOOTCOUNTER_IN_REGION", "left")
            cv2.putText(
                arr,
                f"IN ({in_region})",
                (12, 36),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.9,
                (0, 255, 0, 255),
                2,
                cv2.LINE_AA,
            )
            cv2.putText(
                arr,
                "OUT",
                (12, 72),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.9,
                (0, 128, 255, 255),
                2,
                cv2.LINE_AA,
            )
            cv2.putText(
                arr,
                f"counts  IN={ci}  OUT={co}",
                (12, h - 20),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (255, 255, 255, 255),
                2,
                cv2.LINE_AA,
            )

            for bbox, score in persons:
                x0, y0, x1, y1 = bbox
                label = f"person {int(score * 100)}%"
                cv2.rectangle(arr, (x0, y0), (x1, y1), (0, 255, 0, 255), 2)
                cv2.putText(
                    arr,
                    label,
                    (x0 + 4, max(20, y0 + 18)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (0, 255, 0, 255),
                    1,
                    cv2.LINE_AA,
                )
                fx, fy = foot_xy(bbox)
                cv2.circle(arr, (int(fx), int(fy)), 6, (255, 0, 255, 255), -1)

    return draw_overlay


def build_page(w: int, h: int) -> str:
    wd = min(w, 1600)
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>footcounter — Hailo preview</title></head>
<body>
<p>Hailo person detection + IN/OUT line. Adjust FOOTCOUNTER_IN_REGION / LINE_POS in config.env.</p>
<img src="/stream.mjpg" width="{wd}" alt="preview" />
</body></html>
"""


class StreamingOutput(io.BufferedIOBase):
    def __init__(self) -> None:
        self.frame: bytes | None = None
        self.condition = Condition()

    def write(self, buf: bytes) -> int:
        with self.condition:
            self.frame = buf
            self.condition.notify_all()
        return len(buf)


output: StreamingOutput | None = None
picam2: Picamera2 | None = None


class StreamingHandler(server.BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        assert output is not None
        if self.path in ("/", "/index.html"):
            content = build_page(self.server.preview_w, self.server.preview_h).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        elif self.path == "/stream.mjpg":
            self.send_response(200)
            self.send_header("Age", "0")
            self.send_header("Cache-Control", "no-cache, private")
            self.send_header("Pragma", "no-cache")
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=FRAME")
            self.end_headers()
            try:
                while True:
                    with output.condition:
                        output.condition.wait()
                        frame = output.frame
                    if not frame:
                        continue
                    hdr = (
                        b"--FRAME\r\n"
                        b"Content-Type: image/jpeg\r\n"
                        b"Content-Length: "
                        + str(len(frame)).encode()
                        + b"\r\n\r\n"
                    )
                    self.wfile.write(hdr)
                    self.wfile.write(frame)
                    self.wfile.write(b"\r\n")
            except (BrokenPipeError, ConnectionResetError):
                pass
        else:
            self.send_error(404)

    def log_message(self, fmt: str, *args: object) -> None:
        logging.info("%s - %s", self.client_address[0], fmt % args)


class StreamingServer(socketserver.ThreadingMixIn, server.HTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def inference_worker(
    hailo: Hailo,
    video_w: int,
    video_h: int,
    score_thresh: float,
    crossing: CrossingState,
    db_path: Path | None,
) -> None:
    global _latest_persons, _count_in, _count_out
    assert picam2 is not None
    while not _stop.is_set():
        try:
            frame = picam2.capture_array("lores")
        except Exception as e:
            logging.warning("capture_array lores: %s", e)
            time.sleep(0.05)
            continue
        try:
            results = hailo.run(frame)
        except Exception as e:
            logging.warning("hailo.run: %s", e)
            time.sleep(0.01)
            continue

        persons = extract_detections(results, video_w, video_h, score_thresh, person_only=True)
        vertical = os.environ.get("FOOTCOUNTER_LINE_ORIENTATION", "vertical") != "horizontal"
        pos = float(os.environ.get("FOOTCOUNTER_LINE_POS", "0.5"))
        line_x = int(pos * video_w)
        line_y = int(pos * video_h)

        feet: list[tuple[float, float, str]] = []
        for bbox, sc in persons:
            fx, fy = foot_xy(bbox)
            if vertical:
                side = region_vertical(fx, line_x)
            else:
                side = region_horizontal(fy, line_y)
            feet.append((fx, fy, side))

        din, dout = crossing.update(feet)

        with _state_lock:
            _latest_persons = persons
            if din or dout:
                _count_in += din
                _count_out += dout
                for _ in range(din):
                    logging.info("crossing IN (total in=%s out=%s)", _count_in, _count_out)
                    if db_path and os.environ.get("FOOTCOUNTER_LOG_CROSSINGS", "").lower() in (
                        "1",
                        "true",
                        "yes",
                    ):
                        max_sc = max((s for _, s in persons), default=None) if persons else None
                        log_crossing_to_sqlite(db_path, "in", max_sc)
                for _ in range(dout):
                    logging.info("crossing OUT (total in=%s out=%s)", _count_in, _count_out)
                    if db_path and os.environ.get("FOOTCOUNTER_LOG_CROSSINGS", "").lower() in (
                        "1",
                        "true",
                        "yes",
                    ):
                        max_sc = max((s for _, s in persons), default=None) if persons else None
                        log_crossing_to_sqlite(db_path, "out", max_sc)


def main() -> None:
    global output, picam2
    load_env(BASE / "config.env")

    video_w = int(os.environ.get("PREVIEW_WIDTH", "1280"))
    video_h = int(os.environ.get("PREVIEW_HEIGHT", "720"))
    port = int(os.environ.get("PREVIEW_PORT", "8000"))
    score_thresh = float(os.environ.get("HAILO_SCORE_THRESH", "0.5"))
    labels_path = Path(os.environ.get("HAILO_LABELS", str(BASE / "coco.txt")))
    match_px = float(os.environ.get("FOOTCOUNTER_MATCH_DISTANCE_PX", "120"))

    db_path: Path | None = None
    if os.environ.get("FOOTCOUNTER_LOG_CROSSINGS", "").lower() in ("1", "true", "yes"):
        db_path = Path(os.environ.get("FOOTCOUNTER_DB_PATH", "/var/lib/footcounter/events.sqlite"))
        ensure_db_schema(db_path)

    if not labels_path.is_file():
        logging.warning("Optional labels file missing: %s (sync repo; not required for person-only)", labels_path)

    model = default_model_path()
    if not Path(model).is_file():
        logging.warning("Model file missing: %s — install hailo-all", model)

    crossing = CrossingState(match_px=match_px)

    vertical = os.environ.get("FOOTCOUNTER_LINE_ORIENTATION", "vertical") != "horizontal"
    pos = float(os.environ.get("FOOTCOUNTER_LINE_POS", "0.5"))
    line_x = int(pos * video_w)
    line_y = int(pos * video_h)

    with Hailo(model) as hailo:
        model_h, model_w, _ = hailo.get_input_shape()
        main = {"size": (video_w, video_h), "format": "XRGB8888"}
        lores = {"size": (model_w, model_h), "format": "RGB888"}
        controls = {"FrameRate": 30}

        picam2 = Picamera2()
        picam2.configure(
            picam2.create_preview_configuration(main, lores=lores, controls=controls)
        )
        picam2.pre_callback = make_pre_callback(line_x, line_y, vertical)

        output = StreamingOutput()
        picam2.start_recording(JpegEncoder(), FileOutput(output))

        worker = threading.Thread(
            target=inference_worker,
            args=(hailo, video_w, video_h, score_thresh, crossing, db_path),
            daemon=True,
        )
        worker.start()

        httpd = StreamingServer(("", port), StreamingHandler)
        httpd.preview_w = video_w
        httpd.preview_h = video_h

        logging.info(
            "Hailo MJPEG http://0.0.0.0:%s/  (%sx%s) model=%s line_pos=%s orientation=%s IN_region=%s",
            port,
            video_w,
            video_h,
            model,
            pos,
            "vertical" if vertical else "horizontal",
            os.environ.get("FOOTCOUNTER_IN_REGION", "left"),
        )
        try:
            httpd.serve_forever()
        finally:
            _stop.set()
            picam2.stop_recording()


if __name__ == "__main__":
    main()
