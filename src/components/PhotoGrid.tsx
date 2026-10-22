import { deletePhoto } from "@/app/projects/[id]/photo-actions";
import { meetsMinimumSize } from "@/lib/photos/size";
import { formatDateTime } from "@/lib/today";
import { ConfirmDelete } from "./ConfirmDelete";

export type GridPhoto = {
  id: string;
  display_path: string;
  width: number;
  height: number;
  taken_at: string | null;
  taken_at_source: "exif" | "file" | null;
};

// Thumbnails from short-lived signed URLs; QEWI can delete.
export function PhotoGrid({
  photos,
  urls,
  projectId,
  canDelete,
}: {
  photos: GridPhoto[];
  urls: Map<string, string>;
  projectId: string;
  canDelete: boolean;
}) {
  if (photos.length === 0) return <p className="text-sm text-neutral-600 dark:text-neutral-400">No photos yet.</p>;
  return (
    <ul className="grid grid-cols-2 gap-3">
      {photos.map((p) => {
        const url = urls.get(p.display_path);
        const small = !meetsMinimumSize(p.width, p.height);
        return (
          <li key={p.id} className="flex flex-col gap-1">
            {url ? (
              // Signed URLs expire, so Next's image optimizer (which caches) isn't used.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={`Photo taken ${p.taken_at ? formatDateTime(p.taken_at) : "on an unknown date"}`} className="aspect-[4/3] w-full rounded-md object-cover" />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-md bg-neutral-100 text-xs">Missing file</div>
            )}
            <span className="text-xs text-neutral-600 dark:text-neutral-400">
              {p.taken_at ? formatDateTime(p.taken_at) : "No date"}
              {p.taken_at_source === "file" ? " (file date)" : ""}
            </span>
            {small ? <span className="text-xs text-amber-700">Under 800 × 600 ({p.width} × {p.height})</span> : null}
            {canDelete ? (
              <ConfirmDelete action={deletePhoto.bind(null, projectId, p.id)} label="Delete" warning="Delete this photo? This can't be undone." />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
