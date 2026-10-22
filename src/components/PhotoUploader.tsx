"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { recordPhoto } from "@/app/projects/[id]/photo-actions";
import { PhotoError, preparePhoto, type PreparedPhoto } from "@/lib/photos/prepare";
import { uploadPhotoFiles } from "@/lib/photos/upload";
import type { PhotoKind } from "@/lib/schemas/photo";

type Item = { name: string; state: "working" | "done" | "error"; message?: string; warnings: string[] };

export function photoWarnings(p: Pick<PreparedPhoto, "tooSmall" | "takenAtSource" | "width" | "height">): string[] {
  const out: string[] = [];
  if (p.tooSmall) out.push(`Only ${p.width} × ${p.height} px. FISP photos must be at least 800 × 600.`);
  if (p.takenAtSource === "file") out.push("No camera date found; used the file date. Check it.");
  return out;
}

// Uploads one or more photos: prepare → upload both files → save the row.
export async function savePhoto(
  photo: PreparedPhoto,
  ctx: { firmId: string; projectId: string; kind: PhotoKind; observationId: string | null },
): Promise<void> {
  await uploadPhotoFiles(ctx.firmId, ctx.projectId, photo);
  const result = await recordPhoto(ctx.projectId, {
    id: photo.id,
    kind: ctx.kind,
    observation_id: ctx.observationId,
    original_ext: photo.originalExt as "jpg",
    original_type: photo.originalType as "image/jpeg",
    width: photo.width,
    height: photo.height,
    taken_at: photo.takenAt,
    taken_at_source: photo.takenAtSource,
    caption: "",
  });
  if (result.error) throw new Error(result.error);
}

// Camera or library picker for photos added straight to a project or observation.
export function PhotoUploader({
  firmId,
  projectId,
  kind,
  observationId = null,
  label = "Add photos",
}: {
  firmId: string;
  projectId: string;
  kind: PhotoKind;
  observationId?: string | null;
  label?: string;
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
    for (const [index, file] of list.entries()) {
      const update = (patch: Partial<Item>) =>
        setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
      try {
        const photo = await preparePhoto(file);
        await savePhoto(photo, { firmId, projectId, kind, observationId });
        update({ state: "done", warnings: photoWarnings(photo) });
      } catch (e) {
        update({ state: "error", message: e instanceof PhotoError || e instanceof Error ? e.message : "Upload failed." });
      }
    }
    if (cameraRef.current) cameraRef.current.value = "";
    if (libraryRef.current) libraryRef.current.value = "";
    router.refresh();
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
              {it.state === "working" ? `Uploading ${it.name}…` : it.state === "done" ? `Added ${it.name}` : it.message}
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
