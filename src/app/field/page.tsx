"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CaptureForm } from "@/components/CaptureForm";
import { PhotoUploader } from "@/components/PhotoUploader";
import { Message, PageShell } from "@/components/ui";
import { offlineDb, type OutboxObservation, type OutboxPhoto, type ProjectSnapshot } from "@/lib/offline/db";
import { useLiveQuery, useOnline } from "@/lib/offline/hooks";
import { discardObservation, discardPhoto } from "@/lib/offline/outbox";
import { syncNow } from "@/lib/offline/sync";
import { PHOTO_KIND_LABEL } from "@/lib/schemas/photo";
import { formatDateTime } from "@/lib/today";

// Field mode: works with no signal. Everything here comes from the phone's
// own storage (projects saved while online, plus the outbox). The service
// worker serves this page when the network is down. Links use <a>, so they
// go through the service worker too.
export default function FieldPage() {
  return (
    <PageShell title="Field mode">
      <Suspense fallback={<p>Loading…</p>}>
        <FieldApp />
      </Suspense>
    </PageShell>
  );
}

type Outbox = { observations: OutboxObservation[]; photos: Omit<OutboxPhoto, "original" | "display">[] };

function FieldApp() {
  const projectId = useSearchParams().get("project");
  const online = useOnline();
  const projects = useLiveQuery<ProjectSnapshot[] | null>(
    () => offlineDb().projects.orderBy("savedAt").reverse().toArray(),
    [],
    null,
  );
  const outbox = useLiveQuery<Outbox>(
    async () => ({
      observations: await offlineDb().observations.orderBy("createdAt").toArray(),
      // Leave the image blobs out of what's held in memory here.
      photos: (await offlineDb().photos.toArray()).map((p) => {
        const { original, display, ...rest } = p;
        void original;
        void display;
        return rest;
      }),
    }),
    [],
    { observations: [], photos: [] },
  );

  if (projects === null) return <p>Loading…</p>;
  const project = projects.find((p) => p.id === projectId);

  return (
    <div className="flex flex-col gap-6">
      <p className={`text-sm font-medium ${online ? "text-green-800" : "text-amber-800"}`}>
        {online ? "Online." : "Offline. Observations are saved on this phone and sync later."}
      </p>

      {project ? (
        <ProjectCapture project={project} online={online} />
      ) : (
        <ProjectList projects={projects} outbox={outbox} online={online} />
      )}

      <OutboxList outbox={outbox} projects={projects} online={online} />
    </div>
  );
}

function ProjectList({ projects, outbox, online }: { projects: ProjectSnapshot[]; outbox: Outbox; online: boolean }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Projects on this phone</h2>
      {projects.length === 0 ? (
        <p className="text-sm">
          None yet. Open a project once while online and it&apos;s saved here for offline use.
          {online ? (
            <>
              {" "}
              <Link href="/" className="underline">Go to projects</Link>
            </>
          ) : null}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((p) => {
            const waiting =
              outbox.observations.filter((o) => o.projectId === p.id).length +
              outbox.photos.filter((ph) => ph.projectId === p.id).length;
            return (
              <li key={p.id}>
                <a
                  href={`/field?project=${p.id}`}
                  className="flex flex-col gap-0.5 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700"
                >
                  <span className="font-medium">{p.address}</span>
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    Cycle {p.cycle} · saved {formatDateTime(new Date(p.savedAt).toISOString())}
                    {waiting ? ` · ${waiting} waiting to sync` : ""}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ProjectCapture({ project, online }: { project: ProjectSnapshot; online: boolean }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <a href="/field" className="inline-flex min-h-12 items-center text-sm underline">← Projects on this phone</a>
        <h2 className="text-xl font-semibold">{project.address}</h2>
        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          Elevations and drops as of {formatDateTime(new Date(project.savedAt).toISOString())}.
          {online ? (
            <>
              {" "}
              <a href={`/projects/${project.id}`} className="underline">Open full project</a>
            </>
          ) : null}
        </p>
      </div>
      <h3 className="text-lg font-semibold">New observation</h3>
      <CaptureForm
        mode="field"
        project={{
          projectId: project.id,
          firmId: project.firmId,
          elevations: project.elevations,
          finalInspectionDate: project.finalInspectionDate,
        }}
      />
      <h3 className="text-lg font-semibold">Project photos</h3>
      {(["elevation", "inspector", "typical", "probe"] as const).map((kind) => (
        <details key={kind} className="rounded-lg border border-neutral-200 px-3 dark:border-neutral-700">
          <summary className="flex min-h-12 cursor-pointer items-center text-sm font-medium">{PHOTO_KIND_LABEL[kind]} photos</summary>
          <div className="pb-3">
            <PhotoUploader
              firmId={project.firmId}
              projectId={project.id}
              kind={kind}
              label={`Choose ${PHOTO_KIND_LABEL[kind].toLowerCase()} photos`}
              refresh={false}
            />
          </div>
        </details>
      ))}
    </section>
  );
}

function OutboxList({ outbox, projects, online }: { outbox: Outbox; projects: ProjectSnapshot[]; online: boolean }) {
  const total = outbox.observations.length + outbox.photos.length;
  if (total === 0) return <p className="text-sm text-neutral-600 dark:text-neutral-400">Nothing waiting to sync.</p>;
  const address = (id: string) => projects.find((p) => p.id === id)?.address ?? "Unknown project";
  const blockedPhotos = outbox.photos.filter((p) => p.blocked);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Waiting to sync ({total})</h2>
      <ul className="flex flex-col gap-2">
        {outbox.observations.map((o) => (
          <li key={o.id} className="flex flex-col gap-1 rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-700">
            <span className="font-medium">{o.summary || "Observation"}</span>
            <span className="text-neutral-600 dark:text-neutral-400">
              {address(o.projectId)} · {outbox.photos.filter((p) => p.observationId === o.id).length} photo(s)
            </span>
            {o.lastError ? <span className={o.blocked ? "text-red-700" : "text-amber-700"}>{o.lastError}</span> : null}
            {o.blocked ? (
              <button
                type="button"
                className="min-h-12 self-start text-red-700 underline"
                onClick={() => {
                  if (window.confirm("Discard this observation and its photos from this phone?")) void discardObservation(o.id);
                }}
              >
                Discard
              </button>
            ) : null}
          </li>
        ))}
        {outbox.photos.filter((p) => !p.observationId).length > 0 ? (
          <li className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-700">
            {outbox.photos.filter((p) => !p.observationId).length} project photo(s)
          </li>
        ) : null}
        {blockedPhotos.map((p) => (
          <li key={p.id} className="flex flex-col gap-1 rounded-lg border border-red-200 p-3 text-sm">
            <span className="text-red-700">{p.lastError}</span>
            <button type="button" className="min-h-12 self-start text-red-700 underline" onClick={() => void discardPhoto(p.id)}>
              Discard photo
            </button>
          </li>
        ))}
      </ul>
      {online ? (
        <button
          type="button"
          className="min-h-12 rounded-lg border border-neutral-300 font-medium dark:border-neutral-600"
          onClick={() => void syncNow(true)}
        >
          Sync now
        </button>
      ) : (
        <Message tone="info">These will send automatically when the phone is back online.</Message>
      )}
    </section>
  );
}
