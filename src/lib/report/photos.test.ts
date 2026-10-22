import { describe, expect, it } from "vitest";
import { fitBox, numberPhotos, photoRefs } from "./photos";
import type { ReportData, ReportPhoto } from "./types";

const photo = (id: string, kind: ReportPhoto["kind"], createdAt: string, observationId: string | null = null): ReportPhoto => ({
  id,
  kind,
  observationId,
  takenAtText: "Sep 21, 2026, 10:30 AM",
  width: 2000,
  height: 1500,
  data: null,
  createdAt,
});

const data: Pick<ReportData, "photos" | "observations" | "elevations"> = {
  elevations: [
    { id: "north", name: "North", facesStreet: true, frontageFt: 75, setbacksNote: null, closeups: [] },
    { id: "east", name: "East", facesStreet: false, frontageFt: 40, setbacksNote: null, closeups: [] },
  ],
  observations: [
    { id: "o-east", elevationId: "east", elevationName: "East", floor: "3", element: "Lintel", condition: "Rust", classification: "swarmp", cause: null, recommendedRepair: null, repairByDate: null },
    { id: "o-north", elevationId: "north", elevationName: "North", floor: "Roof", element: "Parapet", condition: "Loose", classification: "unsafe", cause: null, recommendedRepair: null, repairByDate: null },
    { id: "o-none", elevationId: null, elevationName: null, floor: null, element: "Sign", condition: "Loose bolt", classification: "safe", cause: null, recommendedRepair: null, repairByDate: null },
  ],
  photos: [
    photo("typ", "typical", "2026-09-21T10:00:00Z"),
    photo("c-east", "condition", "2026-09-21T09:00:00Z", "o-east"),
    photo("c-north-2", "condition", "2026-09-21T09:05:00Z", "o-north"),
    photo("c-north-1", "condition", "2026-09-21T09:01:00Z", "o-north"),
    photo("insp", "inspector", "2026-09-21T11:00:00Z"),
    photo("elev", "elevation", "2026-09-21T12:00:00Z"),
    photo("c-none", "condition", "2026-09-21T08:00:00Z", "o-none"),
    photo("probe", "probe", "2026-09-21T08:00:00Z"),
  ],
};

describe("numberPhotos", () => {
  it("orders by kind, then conditions by elevation and observation", () => {
    expect(numberPhotos(data).map((p) => p.id)).toEqual([
      "elev",
      "insp",
      "c-north-1",
      "c-north-2",
      "c-east",
      "c-none",
      "probe",
      "typ",
    ]);
  });

  it("labels condition photos with their status and location", () => {
    const byId = new Map(numberPhotos(data).map((p) => [p.id, p]));
    expect(byId.get("c-north-1")!.caption).toBe("Photo 3. UNSAFE – Parapet, floor Roof, North elevation. Taken Sep 21, 2026, 10:30 AM.");
    expect(byId.get("c-none")!.caption).toBe("Photo 6. SAFE – Sign. Taken Sep 21, 2026, 10:30 AM.");
    expect(byId.get("insp")!.caption).toBe("Photo 2. QEWI or staff performing close-up inspection. Taken Sep 21, 2026, 10:30 AM.");
  });

  it("says when a date is missing", () => {
    const [p] = numberPhotos({ ...data, photos: [{ ...photo("x", "typical", "2026-01-01"), takenAtText: null }] });
    expect(p!.caption).toBe("Photo 1. Typical condition. Date not recorded.");
  });
});

describe("photoRefs / fitBox", () => {
  it("lists photo numbers for an observation", () => {
    const n = numberPhotos(data);
    expect(photoRefs(n, "o-north")).toBe("Photos 3, 4");
    expect(photoRefs(n, "o-east")).toBe("Photo 5");
    expect(photoRefs(n, "missing")).toBe("No photo");
  });

  it("fits within a box without upscaling", () => {
    expect(fitBox(2000, 1500, 480, 340)).toEqual({ width: 453, height: 340 });
    expect(fitBox(1500, 2000, 480, 340)).toEqual({ width: 255, height: 340 });
    expect(fitBox(300, 200, 480, 340)).toEqual({ width: 300, height: 200 });
  });
});
