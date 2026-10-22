import Link from "next/link";
import { closeupRequirements, elevationProgress } from "@/lib/rules";

type Elevation = {
  id: string;
  name: string;
  faces_street: boolean;
  frontage_ft: number;
  closeups: { id: string; probes: { id: string }[] }[];
};

// Elevations with drops recorded vs required (CLAUDE.md §3.2).
export function ElevationsCard({
  projectId,
  elevations,
  showProbes,
}: {
  projectId: string;
  elevations: Elevation[];
  showProbes: boolean;
}) {
  const totalDrops = elevations.reduce((n, e) => n + e.closeups.length, 0);
  const { buildingMinimum } = closeupRequirements(
    elevations.map((e) => ({ facesStreet: e.faces_street, frontageFt: Number(e.frontage_ft) })),
  );

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <h2 className="text-lg font-semibold">Elevations</h2>
      {elevations.length === 0 ? (
        <p className="text-sm">No elevations yet. Add each side of the building, starting with the street elevations.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-700">
          {elevations.map((e) => {
            const p = elevationProgress({
              facesStreet: e.faces_street,
              frontageFt: Number(e.frontage_ft),
              closeupCount: e.closeups.length,
            });
            const probes = e.closeups.reduce((n, c) => n + c.probes.length, 0);
            const needsAttention = p.short > 0 || p.required === 0;
            return (
              <li key={e.id}>
                <Link href={`/projects/${projectId}/elevations/${e.id}`} className="flex min-h-12 flex-col justify-center gap-0.5 py-2">
                  <span className="font-medium underline">{e.name}</span>
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    {e.faces_street ? `Street · ${Number(e.frontage_ft) > 0 ? `${Number(e.frontage_ft)} ft` : "frontage missing"}` : "Not a street elevation"}
                  </span>
                  <span className={`text-sm ${needsAttention ? "text-red-700" : ""}`}>
                    {p.required === null
                      ? `${p.recorded} drop${p.recorded === 1 ? "" : "s"} (sample)`
                      : p.required === 0
                        ? "Enter frontage to see drops required"
                        : `${p.recorded} of ${p.required} drops`}
                    {showProbes ? ` · ${probes} probe${probes === 1 ? "" : "s"}` : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className={`text-sm ${totalDrops < buildingMinimum ? "text-red-700" : "text-neutral-600 dark:text-neutral-400"}`}>
        Building: {totalDrops} drop{totalDrops === 1 ? "" : "s"} recorded, at least {buildingMinimum} required.
      </p>
      <Link
        href={`/projects/${projectId}/elevations/new`}
        className="flex min-h-12 items-center justify-center rounded-lg border border-neutral-300 px-4 font-medium dark:border-neutral-600"
      >
        Add elevation
      </Link>
    </section>
  );
}
