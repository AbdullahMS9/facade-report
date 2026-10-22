import "server-only";
import { checkerInput } from "@/lib/db/checkerInput";
import { getProject, type Db } from "@/lib/db/queries";
import { parseCachedFilings } from "@/lib/opendata/facades";
import { fitWithin } from "@/lib/photos/size";
import { buildingStatus, runChecks } from "@/lib/rules";
import { BOROUGH_LABEL } from "@/lib/schemas/building";
import { CLOSEUP_METHOD_LABEL } from "@/lib/schemas/elevation";
import { PROBE_WAIVER_LABEL, REPORT_TYPE_LABEL } from "@/lib/schemas/project";
import { formatDateTime, todayInNewYork } from "@/lib/today";
import type { ReportData } from "./types";

const DOWNLOADS_AT_ONCE = 6;

// Collects everything for the report as the signed-in user (RLS applies).
// Returns null if the project isn't visible.
export async function gatherReportData(db: Db, projectId: string, firmName: string): Promise<ReportData | null> {
  const { data: project } = await getProject(db, projectId);
  if (!project?.buildings) return null;
  const b = project.buildings;

  const [checks, elevations, observations, photos, cache, priorItems] = await Promise.all([
    checkerInput(db, project).then(runChecks),
    db
      .from("elevations")
      .select(
        "id, name, faces_street, frontage_ft, setbacks_note, closeups(id, location_note, inspected_on, method, probes(location_note, probed_on, tie_type, tie_spacing, tie_condition))",
      )
      .eq("project_id", project.id)
      .order("sort_order")
      .order("created_at")
      .order("inspected_on", { referencedTable: "closeups" })
      .order("probed_on", { referencedTable: "closeups.probes" }),
    db
      .from("observations")
      .select("id, elevation_id, floor, element, condition, classification, cause, recommended_repair, repair_by_date")
      .eq("project_id", project.id)
      .order("created_at"),
    db
      .from("photos")
      .select("id, kind, observation_id, display_path, width, height, taken_at, created_at")
      .eq("project_id", project.id),
    db.from("building_filings_cache").select("filings, fetched_at").eq("building_id", b.id).maybeSingle(),
    db.from("prior_items").select("description, location_note, repaired").eq("project_id", project.id).order("created_at"),
  ]);

  const elevationList = elevations.data ?? [];
  const elevationIndex = new Map(elevationList.map((e, i) => [e.id, i]));
  const elevationName = new Map(elevationList.map((e) => [e.id, e.name]));
  // Conditions in elevation order, then as recorded.
  const observationList = [...(observations.data ?? [])].sort(
    (x, y) =>
      (x.elevation_id ? (elevationIndex.get(x.elevation_id) ?? 999) : 999) -
      (y.elevation_id ? (elevationIndex.get(y.elevation_id) ?? 999) : 999),
  );

  const photoRows = photos.data ?? [];
  const images = await downloadAll(
    db,
    photoRows.map((p) => p.display_path),
  );

  return {
    generatedOn: todayInNewYork(),
    blockers: checks.filter((c) => !c.passed && c.severity === "blocker").length,
    firmName,
    building: {
      address: b.address,
      borough: BOROUGH_LABEL[b.borough],
      block: b.block,
      lot: b.lot,
      bin: b.bin,
      crossStreet: b.cross_street,
      isLandmark: b.is_landmark,
      stories: b.stories,
      heightFt: b.height_ft === null ? null : Number(b.height_ft),
      yearBuilt: b.year_built,
      coNumber: b.co_number,
      use: b.use,
      materials: b.materials,
      materialsNotes: b.materials_notes,
      isCavityWall: b.is_cavity_wall,
      ownerName: b.owner_name,
      ownerAddress: b.owner_address,
      ownerPhone: b.owner_phone,
      ownerPrincipalName: b.owner_principal_name,
      ownerPrincipalTitle: b.owner_principal_title,
    },
    project: {
      cycle: project.cycle,
      reportType: REPORT_TYPE_LABEL[project.report_type],
      examStart: project.exam_start,
      examEnd: project.exam_end,
      closeupCompleteDate: project.closeup_complete_date,
      finalInspectionDate: project.final_visual_date,
      unsafeNotifiedOn: project.unsafe_notified_on,
      publicProtectionNote: project.public_protection_note,
      probeWaiver: project.probe_waiver ? PROBE_WAIVER_LABEL[project.probe_waiver] : null,
      probeWaiverNote: project.probe_waiver_note,
    },
    qewi: project.inspectors
      ? {
          name: project.inspectors.name,
          licenseType: project.inspectors.license_type,
          licenseNumber: project.inspectors.license_number,
        }
      : null,
    status: buildingStatus(
      observationList.map((o) => o.classification),
      priorItems.data ?? [],
    ),
    elevations: elevationList.map((e) => ({
      id: e.id,
      name: e.name,
      facesStreet: e.faces_street,
      frontageFt: Number(e.frontage_ft),
      setbacksNote: e.setbacks_note,
      closeups: e.closeups.map((c) => ({
        id: c.id,
        locationNote: c.location_note,
        inspectedOn: c.inspected_on,
        method: CLOSEUP_METHOD_LABEL[c.method],
        probes: c.probes.map((p) => ({
          locationNote: p.location_note,
          probedOn: p.probed_on,
          tieType: p.tie_type,
          tieSpacing: p.tie_spacing,
          tieCondition: p.tie_condition,
        })),
      })),
    })),
    observations: observationList.map((o) => ({
      id: o.id,
      elevationId: o.elevation_id,
      elevationName: o.elevation_id ? (elevationName.get(o.elevation_id) ?? null) : null,
      floor: o.floor,
      element: o.element,
      condition: o.condition,
      classification: o.classification,
      cause: o.cause,
      recommendedRepair: o.recommended_repair,
      repairByDate: o.repair_by_date,
    })),
    photos: photoRows.map((p) => {
      const display = fitWithin(p.width, p.height);
      return {
        id: p.id,
        kind: p.kind,
        observationId: p.observation_id,
        takenAtText: p.taken_at ? formatDateTime(p.taken_at) : null,
        width: display.width,
        height: display.height,
        data: images.get(p.display_path) ?? null,
        createdAt: p.created_at,
      };
    }),
    priorFilings: parseCachedFilings(cache.data?.filings),
    priorFilingsFetchedAt: cache.data?.fetched_at ? formatDateTime(cache.data.fetched_at) : null,
    priorItems: (priorItems.data ?? []).map((i) => ({
      description: i.description,
      locationNote: i.location_note,
      repaired: i.repaired,
    })),
  };
}

// Display copies from storage, a few at a time. Missing files are left out
// (the report shows a placeholder).
async function downloadAll(db: Db, paths: string[]): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  for (let i = 0; i < paths.length; i += DOWNLOADS_AT_ONCE) {
    await Promise.all(
      paths.slice(i, i + DOWNLOADS_AT_ONCE).map(async (path) => {
        const { data } = await db.storage.from("photos").download(path);
        if (data) out.set(path, new Uint8Array(await data.arrayBuffer()));
      }),
    );
  }
  return out;
}

// "FISP Cycle 10 – 123 Example Street – 2026-10-22.docx", safe for a header.
export function reportFileName(data: Pick<ReportData, "project" | "building" | "generatedOn">): string {
  const address = data.building.address.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return `FISP Cycle ${data.project.cycle} – ${address} – ${data.generatedOn}.docx`;
}
