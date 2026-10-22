import Link from "next/link";
import { ClassificationBadge } from "@/components/Badges";
import { BackLink, PageShell } from "@/components/ui";
import { listObservations } from "@/lib/db/queries";
import { signedUrls } from "@/lib/photos/signed";
import { checkRepairDate } from "@/lib/rules";
import { CLASSIFICATIONS, CLASSIFICATION_LABEL } from "@/lib/schemas/observation";
import { loadProject } from "../load";

export default async function ObservationsPage(props: PageProps<"/projects/[id]/observations">) {
  const { id } = await props.params;
  const search = await props.searchParams;
  const filter = CLASSIFICATIONS.find((c) => c === search.c) ?? null;
  const { supabase, project, building } = await loadProject(id);
  const { data } = await listObservations(supabase, project.id);
  const all = data ?? [];
  const shown = filter ? all.filter((o) => o.classification === filter) : all;
  const urls = await signedUrls(supabase, shown.flatMap((o) => (o.photos[0] ? [o.photos[0].display_path] : [])));

  // Group by elevation, in elevation order; "No elevation" last.
  const groups = new Map<string, { name: string; order: number; items: typeof shown }>();
  for (const o of shown) {
    const key = o.elevation_id ?? "none";
    const group = groups.get(key) ?? {
      name: o.elevations?.name ?? "No elevation",
      order: o.elevations?.sort_order ?? Number.MAX_SAFE_INTEGER,
      items: [],
    };
    group.items.push(o);
    groups.set(key, group);
  }

  const chip = (value: string | null, label: string, count: number) => (
    <Link
      href={value ? `?c=${value}` : "?"}
      aria-current={filter === value ? "page" : undefined}
      className={`inline-flex min-h-12 items-center rounded-full border px-3 text-sm ${filter === value ? "border-blue-700 bg-blue-50 font-semibold text-blue-900" : "border-neutral-300 dark:border-neutral-600"}`}
    >
      {label} ({count})
    </Link>
  );

  return (
    <PageShell title="Observations">
      <BackLink href={`/projects/${project.id}`}>{building.address}</BackLink>
      <Link
        href={`/projects/${project.id}/observations/new`}
        className="flex min-h-12 items-center justify-center rounded-lg bg-blue-700 px-4 font-medium text-white hover:bg-blue-800"
      >
        New observation
      </Link>
      <nav aria-label="Filter by classification" className="flex flex-wrap gap-2">
        {chip(null, "All", all.length)}
        {CLASSIFICATIONS.map((c) => chip(c, CLASSIFICATION_LABEL[c], all.filter((o) => o.classification === c).length))}
      </nav>

      {shown.length === 0 ? <p>No observations{filter ? ` classified ${CLASSIFICATION_LABEL[filter]}` : ""} yet.</p> : null}

      {[...groups.values()]
        .sort((a, b) => a.order - b.order)
        .map((g) => (
          <section key={g.name} className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{g.name}</h2>
            <ul className="flex flex-col gap-2">
              {g.items.map((o) => {
                const thumb = o.photos[0] ? urls.get(o.photos[0].display_path) : undefined;
                const repair = checkRepairDate({
                  classification: o.classification,
                  repairBy: o.repair_by_date,
                  finalInspectionDate: project.final_visual_date,
                });
                const missingPhoto = o.classification !== "safe" && o.photos.length === 0;
                return (
                  <li key={o.id}>
                    <Link
                      href={`/projects/${project.id}/observations/${o.id}`}
                      className="flex gap-3 rounded-lg border border-neutral-200 p-3 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                    >
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="size-16 shrink-0 rounded-md object-cover" />
                      ) : (
                        <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-xs text-neutral-500 dark:bg-neutral-800">
                          No photo
                        </div>
                      )}
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <ClassificationBadge value={o.classification} />
                          <span className="font-medium">{o.element}</span>
                          {o.floor ? <span className="text-sm text-neutral-600 dark:text-neutral-400">Floor {o.floor}</span> : null}
                        </span>
                        <span className="line-clamp-2 text-sm">{o.condition}</span>
                        {missingPhoto ? <span className="text-xs text-red-700">Needs a photo</span> : null}
                        {!repair.ok && repair.issue !== "no_final_inspection" ? (
                          <span className="text-xs text-amber-700">Check repair date</span>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
    </PageShell>
  );
}
