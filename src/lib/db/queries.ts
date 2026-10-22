import "server-only";
import type { createClient } from "./server";

// Typed queries used by pages. All run as the signed-in user, so RLS applies.
export type Db = Awaited<ReturnType<typeof createClient>>;

export function listProjects(db: Db) {
  return db
    .from("projects")
    .select("id, cycle, report_type, status, final_visual_date, closeup_complete_date, updated_at, buildings(address, borough, block)")
    .order("updated_at", { ascending: false });
}

export function listBuildings(db: Db) {
  return db.from("buildings").select("id, address, borough, bin").order("address");
}

export function getProject(db: Db, id: string) {
  return db
    .from("projects")
    .select("*, buildings(*), inspectors(id, name, license_type, license_number)")
    .eq("id", id)
    .maybeSingle();
}

export function listInspectors(db: Db) {
  return db.from("inspectors").select("id, name, license_type, license_number").order("name");
}

export function listElevations(db: Db, projectId: string) {
  return db
    .from("elevations")
    .select("id, name, faces_street, frontage_ft, setbacks_note, sort_order, closeups(id, location_note, inspected_on, method, probes(id))")
    .eq("project_id", projectId)
    .order("sort_order")
    .order("created_at")
    .order("inspected_on", { referencedTable: "closeups" })
    .order("created_at", { referencedTable: "closeups" });
}

export function listObservations(db: Db, projectId: string) {
  return db
    .from("observations")
    .select("*, elevations(name, sort_order), photos(id, display_path, width, height, taken_at, taken_at_source)")
    .eq("project_id", projectId)
    .order("created_at");
}

export function getObservation(db: Db, projectId: string, observationId: string) {
  return db
    .from("observations")
    .select("*, photos(id, display_path, width, height, taken_at, taken_at_source)")
    .eq("project_id", projectId)
    .eq("id", observationId)
    .order("created_at", { referencedTable: "photos" })
    .maybeSingle();
}

export function getElevation(db: Db, projectId: string, elevationId: string) {
  return db
    .from("elevations")
    .select("*, closeups(*, probes(*))")
    .eq("project_id", projectId)
    .eq("id", elevationId)
    .order("inspected_on", { referencedTable: "closeups" })
    .order("probed_on", { referencedTable: "closeups.probes" })
    .maybeSingle();
}
