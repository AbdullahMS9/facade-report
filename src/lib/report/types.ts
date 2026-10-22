import type { PriorFiling } from "@/lib/opendata/facades";
import type { Classification, IsoDate } from "@/lib/rules";

// Everything the Word report needs, as plain data (CLAUDE.md §3.5).
// Gathered on the server by data.ts; turned into a document by build.ts.

export type PhotoKind = "condition" | "elevation" | "inspector" | "probe" | "typical";

export interface ReportPhoto {
  id: string;
  kind: PhotoKind;
  observationId: string | null;
  takenAtText: string | null; // "Sep 21, 2026, 10:30 AM" (New York)
  width: number; // display copy
  height: number;
  data: Uint8Array | null; // display JPEG; null if it couldn't be loaded
  createdAt: string;
}

export interface ReportObservation {
  id: string;
  elevationId: string | null;
  elevationName: string | null;
  floor: string | null;
  element: string;
  condition: string;
  classification: Classification;
  cause: string | null;
  recommendedRepair: string | null;
  repairByDate: IsoDate | null;
}

export interface ReportData {
  generatedOn: IsoDate;
  blockers: number; // checker blockers; > 0 marks the report DRAFT
  firmName: string;
  building: {
    address: string;
    borough: string; // label, e.g. "Manhattan"
    block: number | null;
    lot: number | null;
    bin: string | null;
    crossStreet: string | null;
    isLandmark: boolean | null;
    stories: number | null;
    heightFt: number | null;
    yearBuilt: number | null;
    coNumber: string | null;
    use: string | null;
    materials: string[];
    materialsNotes: string | null;
    isCavityWall: boolean | null;
    ownerName: string | null;
    ownerAddress: string | null;
    ownerPhone: string | null;
    ownerPrincipalName: string | null;
    ownerPrincipalTitle: string | null;
  };
  project: {
    cycle: number;
    reportType: string; // label
    examStart: IsoDate | null;
    examEnd: IsoDate | null;
    closeupCompleteDate: IsoDate | null;
    finalInspectionDate: IsoDate | null;
    unsafeNotifiedOn: IsoDate | null;
    publicProtectionNote: string | null;
    probeWaiver: string | null; // label
    probeWaiverNote: string | null;
  };
  qewi: { name: string; licenseType: string; licenseNumber: string } | null;
  status: Classification;
  elevations: {
    id: string;
    name: string;
    facesStreet: boolean;
    frontageFt: number;
    setbacksNote: string | null;
    closeups: {
      id: string;
      locationNote: string;
      inspectedOn: IsoDate;
      method: string; // label
      probes: { locationNote: string; probedOn: IsoDate; tieType: string | null; tieSpacing: string | null; tieCondition: string | null }[];
    }[];
  }[];
  observations: ReportObservation[];
  photos: ReportPhoto[];
  priorFilings: PriorFiling[];
  priorFilingsFetchedAt: string | null;
  priorItems: { description: string; locationNote: string | null; repaired: boolean | null }[];
}
