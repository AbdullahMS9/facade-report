import type { PreparedPhoto } from "./prepare";

// Storage layout: <firm>/<project>/<photo>/original.<ext> and display.jpg.
// The database checks the same layout (photos table constraints).
export function photoPaths(firmId: string, projectId: string, photo: Pick<PreparedPhoto, "id" | "originalExt">) {
  const dir = `${firmId}/${projectId}/${photo.id}`;
  return { original: `${dir}/original.${photo.originalExt}`, display: `${dir}/display.jpg` };
}
