import { ImageResponse } from "next/og"

export const alt = "BauGenerál — generálkivitelezés Kecskemét"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#FAF9F7",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 10,
            background: "#A60C19",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 120,
            marginLeft: 80,
            width: 360,
            border: "2px solid #E5E1D9",
            background: "#FFFFFF",
          }}
        >
          <div
            style={{
              background: "#A60C19",
              color: "#FFFFFF",
              fontSize: 48,
              fontWeight: 700,
              fontFamily: "Georgia, serif",
              padding: "18px 28px",
            }}
          >
            Bau
          </div>
          <div
            style={{
              color: "#A60C19",
              fontSize: 48,
              fontWeight: 700,
              fontFamily: "Georgia, serif",
              padding: "18px 28px",
            }}
          >
            Generál
          </div>
        </div>
        <div
          style={{
            marginTop: 48,
            marginLeft: 80,
            color: "#1C1A18",
            fontSize: 40,
            fontWeight: 600,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Generálkivitelezés · Kecskemét
        </div>
        <div
          style={{
            marginTop: 16,
            marginLeft: 80,
            color: "#8A8478",
            fontSize: 28,
            fontFamily: "system-ui, sans-serif",
            maxWidth: 900,
          }}
        >
          A tervektől az átadásig, egy kézben, ahogy megegyeztünk.
        </div>
      </div>
    ),
    { ...size },
  )
}
