"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ObservationFields, type ElevationOption } from "@/components/ObservationFields";
import { photoWarnings, savePhoto } from "@/components/PhotoUploader";
import { Button, Message } from "@/components/ui";
import { PhotoError, preparePhoto, type PreparedPhoto } from "@/lib/photos/prepare";
import { createObservation } from "../actions";

type Picked = { photo: PreparedPhoto; preview: string };

// Phone-first: take photos, fill in the condition, save. The observation is
// created first, then each photo is uploaded and linked to it.
export function NewObservationForm({
  projectId,
  firmId,
  elevations,
  finalInspectionDate,
}: {
  projectId: string;
  firmId: string;
  elevations: ElevationOption[];
  finalInspectionDate: string | null;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Picked[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
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
    setSaving(true);
    setError(null);

    // Retry after a failed upload: the observation already exists.
    let id = savedId;
    if (!id) {
      setStatus("Saving observation…");
      const result = await createObservation(projectId, new FormData(event.currentTarget));
      if (!result.id) {
        setError(result.error ?? "Something went wrong.");
        setSaving(false);
        setStatus(null);
        return;
      }
      id = result.id;
      setSavedId(id);
    }

    const failed: Picked[] = [];
    for (const [i, item] of picked.entries()) {
      setStatus(`Uploading photo ${i + 1} of ${picked.length}…`);
      try {
        await savePhoto(item.photo, { firmId, projectId, kind: "condition", observationId: id });
      } catch {
        failed.push(item);
      }
    }
    if (failed.length) {
      setPicked(failed);
      setError(`Observation saved, but ${failed.length} photo(s) didn't upload. Tap Save again to retry.`);
      setSaving(false);
      setStatus(null);
      return;
    }
    router.push(`/projects/${projectId}/observations/${id}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Photos</legend>
        <div className="grid grid-cols-2 gap-2">
          <label
            htmlFor="new-obs-camera"
            className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg bg-blue-700 px-3 font-medium text-white"
          >
            Take photo
          </label>
          <label
            htmlFor="new-obs-library"
            className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg border border-neutral-300 px-3 font-medium dark:border-neutral-600"
          >
            Choose photos
          </label>
        </div>
        <input
          id="new-obs-camera"
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            void addFiles([...(e.currentTarget.files ?? [])]);
            e.currentTarget.value = "";
          }}
        />
        <input
          id="new-obs-library"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          className="sr-only"
          aria-label="Choose photos"
          onChange={(e) => {
            void addFiles([...(e.currentTarget.files ?? [])]);
            e.currentTarget.value = "";
          }}
        />
        {preparing ? <p className="text-sm">Preparing photos…</p> : null}
        {problems.map((p) => (
          <Message key={p} tone="error">{p}</Message>
        ))}
        {picked.length > 0 ? (
          <ul className="grid grid-cols-3 gap-2">
            {picked.map(({ photo, preview }) => (
              <li key={photo.id} className="flex flex-col gap-1">
                {/* Local preview of the display copy, before upload. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Selected photo" className="aspect-square w-full rounded-md object-cover" />
                {photoWarnings(photo).map((w) => (
                  <span key={w} className="text-xs text-amber-700">{w}</span>
                ))}
                {!savedId ? (
                  <button
                    type="button"
                    className="min-h-12 text-xs underline"
                    onClick={() => setPicked((all) => all.filter((p) => p.photo.id !== photo.id))}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Every SWARMP and UNSAFE condition needs at least one photo.
          </p>
        )}
      </fieldset>

      <fieldset disabled={Boolean(savedId)} className="flex flex-col gap-4 disabled:opacity-60">
        <ObservationFields elevations={elevations} finalInspectionDate={finalInspectionDate} />
      </fieldset>

      {error ? <Message tone="error">{error}</Message> : null}
      {status ? <p className="text-sm" aria-live="polite">{status}</p> : null}
      <Button type="submit" disabled={saving || preparing}>
        {saving ? "Saving…" : "Save observation"}
      </Button>
    </form>
  );
}
