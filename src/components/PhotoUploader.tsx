"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { offlineDb } from "@/lib/offline/db";
import { queuePhotos } from "@/lib/offline/outbox";
import { syncNow } from "@/lib/offline/sync";
import { PhotoError, preparePhoto, type PreparedPhoto } from "@/lib/photos/prepare";
import type { PhotoKind } from "@/lib/schemas/photo";

type Item = { name: string; state: "working" | "done" | "error"; message?: string; warnings: string[] };

export function photoWarnings(p: Pick<PreparedPhoto, "tooSmall" | "takenAtSource" | "width" | "height">): string[] {
  const out: string[] = [];
  if (p.tooSmall) out.push(`Only ${p.width} × ${p.height} px. FISP photos must be at least 800 × 600.`);
  if (p.takenAtSource === "file") out.push("No camera date found; used the file date. Check it.");
  return out;
}

// Camera or library picker for photos added straight to a project or observation.
export function PhotoUploader({
  firmId,
  projectId,
  kind,
  observationId = null,
  label = "Add photos",
  refresh = true,
}: {
  firmId: string;
  projectId: string;
  kind: PhotoKind;
  observationId?: string | null;
  label?: string;
  // Off in field mode, where the page doesn't come from the server.
  refresh?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const busy = items.some((i) => i.state === "working");

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files];
    setItems(list.map((f) => ({ name: f.name, state: "working", warnings: [] })));
    // Indexed like `list`: camera files often share a name (image.jpg).
    const preparedAt: (PreparedPhoto | null)[] = list.map(() => null);
    for (const [index, file] of list.entries()) {
      const update = (patch: Partial<Item>) =>
        setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
      try {
        const photo = await preparePhoto(file);
        preparedAt[index] = photo;
        update({ warnings: photoWarnings(photo) });
      } catch (e) {
        update({ state: "error", message: e instanceof PhotoError ? e.message : `${file.name} couldn't be read.` });
      }
    }
    // Saved on the phone first, then sent (works the same offline).
    const prepared = preparedAt.filter((p): p is PreparedPhoto => p !== null);
    if (prepared.length) {
      await queuePhotos({ firmId, projectId, kind, observationId, photos: prepared });
      await syncNow(true);
      const waiting = new Set((await offlineDb().photos.toArray()).map((p) => p.id));
      setItems((prev) =>
        prev.map((it, i) => {
          const photo = preparedAt[i];
          if (it.state === "error" || !photo) return it;
          return waiting.has(photo.id)
            ? { ...it, state: "done", message: `${it.name} saved on this phone; it will upload when the connection is back.` }
            : { ...it, state: "done" };
        }),
      );
    }
    if (cameraRef.current) cameraRef.current.value = "";
    if (libraryRef.current) libraryRef.current.value = "";
    if (refresh) router.refresh();
  }

  const inputId = `photos-${kind}-${observationId ?? "project"}`;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <label
          htmlFor={`${inputId}-camera`}
          className={`flex min-h-12 cursor-pointer items-center justify-center rounded-lg bg-blue-700 px-3 text-center font-medium text-white ${busy ? "opacity-50" : ""}`}
        >
          Take photo
        </label>
        <label
          htmlFor={`${inputId}-library`}
          className={`flex min-h-12 cursor-pointer items-center justify-center rounded-lg border border-neutral-300 px-3 text-center font-medium dark:border-neutral-600 ${busy ? "opacity-50" : ""}`}
        >
          {label}
        </label>
      </div>
      <input
        ref={cameraRef}
        id={`${inputId}-camera`}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={busy}
        onChange={(e) => handle(e.currentTarget.files)}
      />
      <input
        ref={libraryRef}
        id={`${inputId}-library`}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        className="sr-only"
        disabled={busy}
        aria-label={label}
        onChange={(e) => handle(e.currentTarget.files)}
      />
      {items.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm" aria-live="polite">
          {items.map((it, i) => (
            <li key={i} className={it.state === "error" ? "text-red-700" : ""}>
              {it.state === "working" ? `Uploading ${it.name}…` : it.state === "done" ? (it.message ?? `Added ${it.name}`) : it.message}
              {it.warnings.map((w) => (
                <span key={w} className="block text-amber-700">{w}</span>
              ))}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
