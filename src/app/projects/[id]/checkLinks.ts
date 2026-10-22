import type { CheckId, CheckResult, RelatedKind } from "@/lib/rules";

// Where to go to fix each check (UI only; the rules don't know about URLs).
export function checkLink(projectId: string, check: CheckResult): { href: string; label: string } {
  const base = `/projects/${projectId}`;
  const byId: Record<CheckId, { href: string; label: string }> = {
    building_identifiers: { href: `${base}/building`, label: "Building" },
    wall_materials: { href: `${base}/building`, label: "Building" },
    owner_info: { href: `${base}/building`, label: "Building" },
    closeups_required: { href: base, label: "Elevations" },
    probes: { href: `${base}/building`, label: "Building" },
    condition_photos: { href: `${base}/observations`, label: "Observations" },
    repairs: { href: `${base}/observations`, label: "Observations" },
    causes: { href: `${base}/observations`, label: "Observations" },
    typical_photos: { href: `${base}/photos`, label: "Project photos" },
    inspector_photo: { href: `${base}/photos`, label: "Project photos" },
    elevation_photos: { href: `${base}/photos`, label: "Project photos" },
    photo_quality: { href: `${base}/photos`, label: "Project photos" },
    photo_dates: { href: `${base}/photos`, label: "Project photos" },
    prior_items: { href: `${base}/prior-items`, label: "Prior-cycle items" },
    unsafe_notice: { href: `${base}/details`, label: "Project details" },
    filing_deadline: { href: `${base}/details`, label: "Project details" },
    qewi_chosen: { href: `${base}/details`, label: "Project details" },
    exam_dates: { href: `${base}/details`, label: "Project details" },
  };
  // A couple of checks point somewhere else depending on what's missing.
  if (check.id === "probes" && check.related.length) return { href: base, label: "Elevations" };
  if (check.id === "probes" && /waiver/.test(check.fix)) return { href: `${base}/details`, label: "Project details" };
  if (check.id === "closeups_required" && /No elevations/.test(check.message)) {
    return { href: `${base}/elevations/new`, label: "Add elevation" };
  }
  if (check.id === "filing_deadline" && /block/.test(check.message)) return { href: `${base}/building`, label: "Building" };
  return byId[check.id];
}

export function relatedLink(projectId: string, kind: RelatedKind, id: string): string | null {
  const base = `/projects/${projectId}`;
  if (kind === "observation") return `${base}/observations/${id}`;
  if (kind === "elevation") return `${base}/elevations/${id}`;
  if (kind === "prior_item") return `${base}/prior-items`;
  return null; // photos: the check-level link goes to the photos page
}
