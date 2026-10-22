import { z } from "zod";
import { optionalText } from ".";

export const PHOTO_KINDS = ["condition", "elevation", "inspector", "probe", "typical"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

export const PHOTO_KIND_LABEL: Record<PhotoKind, string> = {
  condition: "Condition",
  elevation: "Elevation",
  inspector: "Inspector at work",
  probe: "Probe",
  typical: "Typical condition",
};

// What the browser sends after uploading both files. Paths are rebuilt on the
// server from the firm, project and photo id, never taken from the client.
export const recordPhotoSchema = z.object({
  id: z.uuid(),
  kind: z.enum(PHOTO_KINDS),
  observation_id: z.uuid().nullable(),
  original_ext: z.enum(["jpg", "png", "webp", "heic", "heif"]),
  original_type: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]),
  width: z.number().int().positive().max(20000),
  height: z.number().int().positive().max(20000),
  taken_at: z.iso.datetime().nullable(),
  taken_at_source: z.enum(["exif", "file"]),
  caption: optionalText("caption", 500),
});
export type RecordPhotoInput = z.input<typeof recordPhotoSchema>;
