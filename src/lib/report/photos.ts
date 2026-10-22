import type { ReportData, ReportPhoto } from "./types";

export interface NumberedPhoto extends ReportPhoto {
  number: number;
  caption: string;
}

const KIND_ORDER = { elevation: 0, inspector: 1, condition: 2, probe: 3, typical: 4 } as const;
const KIND_CAPTION = {
  elevation: "Elevation",
  inspector: "QEWI or staff performing close-up inspection",
  probe: "Cavity wall probe",
  typical: "Typical condition",
} as const;
const CLASS = { safe: "SAFE", swarmp: "SWARMP", unsafe: "UNSAFE" } as const;

// Numbers every photo for the appendix (CLAUDE.md §3.5 item 17) in a fixed
// order: elevation, inspector, conditions (by elevation, then observation),
// probe, typical. Condition captions carry the status label (§3.6).
export function numberPhotos(data: Pick<ReportData, "photos" | "observations" | "elevations">): NumberedPhoto[] {
  const elevationOrder = new Map(data.elevations.map((e, i) => [e.id, i]));
  const observationOrder = new Map(data.observations.map((o, i) => [o.id, i]));
  const observations = new Map(data.observations.map((o) => [o.id, o]));
  const conditionKey = (p: ReportPhoto) => {
    const o = p.observationId ? observations.get(p.observationId) : undefined;
    const elevation = o?.elevationId ? (elevationOrder.get(o.elevationId) ?? 999) : 999;
    return [elevation, p.observationId ? (observationOrder.get(p.observationId) ?? 999) : 999];
  };

  const sorted = [...data.photos].sort((a, b) => {
    const kind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (kind) return kind;
    if (a.kind === "condition") {
      const [ae, ao] = conditionKey(a);
      const [be, bo] = conditionKey(b);
      if (ae !== be) return ae! - be!;
      if (ao !== bo) return ao! - bo!;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });

  return sorted.map((p, i) => {
    const taken = p.takenAtText ? ` Taken ${p.takenAtText}.` : " Date not recorded.";
    let what: string;
    if (p.kind === "condition") {
      const o = p.observationId ? observations.get(p.observationId) : undefined;
      what = o
        ? [`${CLASS[o.classification]} – ${o.element}`, o.floor && `floor ${o.floor}`, o.elevationName && `${o.elevationName} elevation`]
            .filter(Boolean)
            .join(", ")
        : "Condition";
    } else {
      what = KIND_CAPTION[p.kind];
    }
    return { ...p, number: i + 1, caption: `Photo ${i + 1}. ${what}.${taken}` };
  });
}

// "Photos 3, 4" / "Photo 3" / "No photo" for the conditions table.
export function photoRefs(numbered: NumberedPhoto[], observationId: string): string {
  const nums = numbered.filter((p) => p.observationId === observationId).map((p) => p.number);
  if (nums.length === 0) return "No photo";
  return `${nums.length === 1 ? "Photo" : "Photos"} ${nums.join(", ")}`;
}

// Scale to fit a box without upscaling (docx sizes are in pixels at 96 dpi).
export function fitBox(width: number, height: number, maxW: number, maxH: number) {
  const scale = Math.min(1, maxW / width, maxH / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
