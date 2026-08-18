export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "épp most";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} perce`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} órája`;
  const day = Math.round(hr / 24);
  if (day === 1) return "tegnap";
  if (day < 30) return `${day} napja`;
  return new Date(iso).toLocaleDateString("hu-HU");
}
