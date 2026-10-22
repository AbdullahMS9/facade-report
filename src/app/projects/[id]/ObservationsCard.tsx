import Link from "next/link";
import { ClassificationBadge } from "@/components/Badges";
import { buildingStatus, type Classification } from "@/lib/rules";

// Building status = worst of the observations and unrepaired prior items
// (CLAUDE.md §2). Counts and quick links for field work.
export function ObservationsCard({
  projectId,
  observations,
  priorItems,
  projectPhotoCount,
}: {
  projectId: string;
  observations: { classification: Classification; photoCount: number }[];
  priorItems: { repaired: boolean | null }[];
  projectPhotoCount: number;
}) {
  const status = buildingStatus(
    observations.map((o) => o.classification),
    priorItems,
  );
  const count = (c: Classification) => observations.filter((o) => o.classification === c).length;
  const missingPhotos = observations.filter((o) => o.classification !== "safe" && o.photoCount === 0).length;
  const carried = priorItems.filter((p) => p.repaired === false).length;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Observations</h2>
        <span className="flex items-center gap-2 text-sm">
          Building status <ClassificationBadge value={status} />
        </span>
      </div>
      <p className="text-sm">
        {observations.length} observation{observations.length === 1 ? "" : "s"}: {count("unsafe")} UNSAFE, {count("swarmp")} SWARMP,{" "}
        {count("safe")} SAFE
        {carried ? ` · plus ${carried} prior item${carried === 1 ? "" : "s"} carried forward as UNSAFE` : ""}
      </p>
      {missingPhotos ? (
        <p className="text-sm text-red-700">
          {missingPhotos} SWARMP/UNSAFE observation{missingPhotos === 1 ? " needs" : "s need"} a photo.
        </p>
      ) : null}
      <Link
        href={`/projects/${projectId}/observations/new`}
        className="flex min-h-12 items-center justify-center rounded-lg bg-blue-700 px-4 font-medium text-white hover:bg-blue-800"
      >
        New observation
      </Link>
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/projects/${projectId}/observations`}
          className="flex min-h-12 items-center justify-center rounded-lg border border-neutral-300 px-3 text-center text-sm font-medium dark:border-neutral-600"
        >
          All observations
        </Link>
        <Link
          href={`/projects/${projectId}/photos`}
          className="flex min-h-12 items-center justify-center rounded-lg border border-neutral-300 px-3 text-center text-sm font-medium dark:border-neutral-600"
        >
          Project photos ({projectPhotoCount})
        </Link>
      </div>
    </section>
  );
}
