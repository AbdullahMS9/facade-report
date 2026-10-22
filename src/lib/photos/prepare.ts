"use client";

import { readExif } from "./exif";
import { DISPLAY_MAX_EDGE, fitWithin, meetsMinimumSize } from "./size";
import { localTimeToIso } from "./time";

export interface PreparedPhoto {
  id: string;
  original: File;
  originalExt: string;
  originalType: string;
  display: Blob; // upright JPEG, longest side ≤ 2000 px
  width: number; // original, upright
  height: number;
  takenAt: string | null; // ISO instant
  takenAtSource: "exif" | "file";
  tooSmall: boolean; // under 800 × 600 (CLAUDE.md §3.6)
}

export class PhotoError extends Error {}

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

// Reads the capture date, makes an upright display copy, and checks the size.
// Runs in the browser before upload.
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const originalType = file.type || "image/jpeg";
  const originalExt = EXT_BY_TYPE[originalType];
  if (!originalExt) throw new PhotoError(`${file.name}: only JPEG, PNG, WebP or HEIC photos can be added.`);
  if (file.size > 25 * 1024 * 1024) throw new PhotoError(`${file.name} is over 25 MB.`);

  const exif = originalType === "image/jpeg" ? readExif(await file.arrayBuffer()) : null;
  const exifTime = exif?.dateTimeOriginal ? localTimeToIso(exif.dateTimeOriginal, exif.offset) : null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoError(
      `${file.name} can't be read in this browser. On iPhone, set Camera › Formats to "Most Compatible" (JPEG).`,
    );
  }

  const { width, height } = bitmap;
  const target = fitWithin(width, height, DISPLAY_MAX_EDGE);
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PhotoError("This browser can't process photos.");
  ctx.drawImage(bitmap, 0, 0, target.width, target.height);
  bitmap.close();
  const display = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!display) throw new PhotoError(`${file.name}: couldn't make a display copy.`);

  return {
    id: crypto.randomUUID(),
    original: file,
    originalExt,
    originalType,
    display,
    width,
    height,
    takenAt: exifTime ?? (file.lastModified ? new Date(file.lastModified).toISOString() : null),
    takenAtSource: exifTime ? "exif" : "file",
    tooSmall: !meetsMinimumSize(width, height),
  };
}
