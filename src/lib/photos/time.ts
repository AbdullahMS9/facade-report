// Turning a camera's local timestamp into a real instant (ISO, UTC).

// Offset of New York from UTC at `utcMs`, in minutes (e.g. -240 in summer).
function newYorkOffsetMinutes(utcMs: number): number {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "longOffset" })
    .formatToParts(new Date(utcMs))
    .find((p) => p.type === "timeZoneName")?.value; // "GMT-04:00"
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(part ?? "");
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

// "2026-05-01T14:03:22" (+ optional "-04:00") → "2026-05-01T18:03:22.000Z".
// Without an offset, the time is taken as New York local time, where FISP
// photos are taken.
export function localTimeToIso(local: string, offset: string | null): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const asUtc = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!);
  if (Number.isNaN(asUtc)) return null;
  let offsetMin: number;
  if (offset) {
    const o = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
    if (!o) return null;
    offsetMin = (o[1] === "-" ? -1 : 1) * (Number(o[2]) * 60 + Number(o[3]));
  } else {
    // Two passes handle the hours around a daylight-saving change.
    offsetMin = newYorkOffsetMinutes(asUtc);
    offsetMin = newYorkOffsetMinutes(asUtc - offsetMin * 60_000);
  }
  return new Date(asUtc - offsetMin * 60_000).toISOString();
}
