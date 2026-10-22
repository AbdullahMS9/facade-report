import "server-only";
import type { CheckerInput } from "@/lib/rules";
import { todayInNewYork } from "@/lib/today";
import { getProject, type Db } from "./queries";

export type ProjectWithBuilding = NonNullable<Awaited<ReturnType<typeof getProject>>["data"]>;

// Everything the checker needs for one project (CLAUDE.md §3.7).
export async function checkerInput(db: Db, project: ProjectWithBuilding): Promise<CheckerInput> {
  const b = project.buildings!;
  const [elevations, observations, photos, priorItems] = await Promise.all([
    db.from("elevations").select("id, name, faces_street, frontage_ft, closeups(id, probes(count))").eq("project_id", project.id),
    db
      .from("observations")
      .select("id, element, floor, classification, recommended_repair, repair_by_date, cause, photos(count)")
      .eq("project_id", project.id)
      .order("created_at"),
    db.from("photos").select("id, kind, width, height, taken_at, taken_at_source").eq("project_id", project.id),
    db.from("prior_items").select("id, description, repaired").eq("project_id", project.id).order("created_at"),
  ]);
  return {
    today: todayInNewYork(),
    cycle: project.cycle,
    building: {
      address: b.address,
      block: b.block,
      lot: b.lot,
      bin: b.bin,
      materials: b.materials,
      isCavityWall: b.is_cavity_wall,
      ownerName: b.owner_name,
      ownerAddress: b.owner_address,
    },
    project: {
      qewiChosen: Boolean(project.qewi_id),
      examStart: project.exam_start,
      examEnd: project.exam_end,
      finalInspectionDate: project.final_visual_date,
      closeupCompleteDate: project.closeup_complete_date,
      unsafeNotifiedOn: project.unsafe_notified_on,
      publicProtectionNote: project.public_protection_note,
      probeWaiver: project.probe_waiver,
    },
    elevations: (elevations.data ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      facesStreet: e.faces_street,
      frontageFt: Number(e.frontage_ft),
      closeups: e.closeups.map((c) => ({ id: c.id, probeCount: c.probes[0]?.count ?? 0 })),
    })),
    observations: (observations.data ?? []).map((o) => ({
      id: o.id,
      label: o.floor ? `${o.element}, floor ${o.floor}` : o.element,
      classification: o.classification,
      recommendedRepair: o.recommended_repair,
      repairByDate: o.repair_by_date,
      cause: o.cause,
      photoCount: o.photos[0]?.count ?? 0,
    })),
    photos: (photos.data ?? []).map((p) => ({
      id: p.id,
      kind: p.kind,
      width: p.width,
      height: p.height,
      takenAt: p.taken_at,
      takenAtSource: p.taken_at_source,
    })),
    priorItems: priorItems.data ?? [],
  };
}

