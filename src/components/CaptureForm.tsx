"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ObservationFields, type ElevationOption } from "@/components/ObservationFields";
import { photoWarnings } from "@/components/PhotoUploader";
import { Button, Message } from "@/components/ui";
import { offlineDb } from "@/lib/offline/db";
import { queueObservation } from "@/lib/offline/outbox";
import { syncNow } from "@/lib/offline/sync";
import { PhotoError, preparePhoto, type PreparedPhoto } from "@/lib/photos/prepare";
import { firstError } from "@/lib/schemas";
import { observationSchema } from "@/lib/schemas/observation";

export type CaptureProject = {
  projectId: string;
  firmId: string;
  elevations: ElevationOption[];
  finalInspectionDate: string | null;
};

type Picked = { photo: PreparedPhoto; preview: string };

// Photos first, then the condition. Everything is saved on this phone first
// and then synced, so it works the same with or without a signal.
// "online": after saving, waits for sync and opens the observation.
// "field": after saving, clears the form for the next one; syncs in the background.
export function CaptureForm({ project, mode }: { project: CaptureProject; mode: "online" | "field" }) {
  const [round, setRound] = useState(0); // remounts the form for the next observation
  const [savedNote, setSavedNote] = useState<string | null>(null);
  return (
    <>
      {savedNote ? <Message tone="success">{savedNote}</Message> : null}
      <CaptureFormInner
        key={round}
        project={project}
        mode={mode}
        onSavedLocally={(note) => {
          setSavedNote(note);
          setRound((r) => r + 1);
          window.scrollTo({ top: 0 });
        }}
      />
    </>
  );
}

function CaptureFormInner({
  project,
  mode,
  onSavedLocally,
}: {
  project: CaptureProject;
  mode: "online" | "field";
  onSavedLocally: (note: string) => void;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Picked[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const previews = useRef<string[]>([]);

  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // Takes a copy: the input's FileList empties when the input is reset.
  async function addFiles(files: File[]) {
    if (!files.length) return;
    setPreparing(true);
    const next: Picked[] = [];
    const errs: string[] = [];
    for (const file of files) {
      try {
        const photo = await preparePhoto(file);
        const preview = URL.createObjectURL(photo.display);
        previews.current.push(preview);
        next.push({ photo, preview });
      } catch (e) {
        errs.push(e instanceof PhotoError ? e.message : `${file.name} couldn't be read.`);
      }
    }
    setPicked((p) => [...p, ...next]);
    setProblems(errs);
    setPreparing(false);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const values: Record<string, string> = {};
    for (const [k, v] of new FormData(event.currentTarget)) if (typeof v === "string") values[k] = v;

    // Check now, so nothing invalid sits in the outbox.
    const check = observationSchema.safeParse(values);
    if (!check.success) {
      setError(firstError(check.error));
      return;
    }
    setSaving(true);
    setError(null);
    setStatus("Saving on this phone…");
    let id: string;
    try {
      id = await queueObservation({
        firmId: project.firmId,
        projectId: project.projectId,
        values,
        photos: picked.map((p) => p.photo),
      });
    } catch {
      setError("Couldn't save on this phone. Is storage full?");
      setSaving(false);
      setStatus(null);
      return;
    }

    if (mode === "field") {
      void syncNow();
      onSavedLocally("Saved on this phone. It will sync when there's a connection.");
      return;
    }

    setStatus(picked.length ? `Uploading ${picked.length} photo(s)…` : "Sending…");
    await syncNow(true);
    const db = offlineDb();
    const stillWaiting = (await db.observations.get(id)) || (await db.photos.where("observationId").equals(id).count()) > 0;
    if (!stillWaiting) {
      router.push(`/projects/${project.projectId}/observations/${id}`);
      return;
    }
    onSavedLocally("Saved on this phone, but it couldn't be sent yet. It will sync automatically when the connection is back.");
  }

  const photoInput = (id: string, camera: boolean) => (
    <input
      id={id}
      type="file"
      accept={camera ? "image/*" : "image/jpeg,image/png,image/webp,image/heic,image/heif"}
      capture={camera ? "environment" : undefined}
      multiple={!camera}
      className="sr-only"
      aria-label={camera ? "Take photo" : "Choose photos"}
      onChange={(e) => {
        void addFiles([...(e.currentTarget.files ?? [])]);
        e.currentTarget.value = "";
      }}
    />
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Photos</legend>
        <div className="grid grid-cols-2 gap-2">
          <label htmlFor="capture-camera" className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg bg-blue-700 px-3 font-medium text-white">
            Take photo
          </label>
          <label
            htmlFor="capture-library"
            className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg border border-neutral-300 px-3 font-medium dark:border-neutral-600"
          >
            Choose photos
          </label>
        </div>
        {photoInput("capture-camera", true)}
        {photoInput("capture-library", false)}
        {preparing ? <p className="text-sm">Preparing photos…</p> : null}
        {problems.map((p) => (
          <Message key={p} tone="error">{p}</Message>
        ))}
        {picked.length > 0 ? (
          <ul className="grid grid-cols-3 gap-2">
            {picked.map(({ photo, preview }) => (
              <li key={photo.id} className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Selected photo" className="aspect-square w-full rounded-md object-cover" />
                {photoWarnings(photo).map((w) => (
                  <span key={w} className="text-xs text-amber-700">{w}</span>
                ))}
                <button
                  type="button"
                  className="min-h-12 text-xs underline"
                  disabled={saving}
                  onClick={() => setPicked((all) => all.filter((p) => p.photo.id !== photo.id))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Every SWARMP and UNSAFE condition needs at least one photo.</p>
        )}
      </fieldset>

      <ObservationFields elevations={project.elevations} finalInspectionDate={project.finalInspectionDate} />

      {error ? <Message tone="error">{error}</Message> : null}
      {status ? <p className="text-sm" aria-live="polite">{status}</p> : null}
      <Button type="submit" disabled={saving || preparing}>
        {saving ? "Saving…" : "Save observation"}
      </Button>
    </form>
  );
}
