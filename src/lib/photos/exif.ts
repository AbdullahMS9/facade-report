// Minimal EXIF reader for JPEG photos: the capture date and orientation.
// CLAUDE.md §3.6 needs dated photos; we read the date the camera recorded.

export interface ExifInfo {
  // "YYYY-MM-DDTHH:MM:SS", camera's local time (no zone)
  dateTimeOriginal: string | null;
  // e.g. "-04:00" when the camera recorded it (OffsetTimeOriginal)
  offset: string | null;
  // 1–8, EXIF orientation; 1 = upright
  orientation: number | null;
}

const EMPTY: ExifInfo = { dateTimeOriginal: null, offset: null, orientation: null };

const TAG_ORIENTATION = 0x0112;
const TAG_DATETIME = 0x0132;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_OFFSET_TIME_ORIGINAL = 0x9011;

// Never throws: anything unreadable returns empty fields.
export function readExif(buffer: ArrayBuffer): ExifInfo {
  try {
    return parse(new DataView(buffer));
  } catch {
    return EMPTY;
  }
}

function parse(view: DataView): ExifInfo {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return EMPTY; // not a JPEG
  let pos = 2;
  while (pos + 4 <= view.byteLength) {
    if (view.getUint8(pos) !== 0xff) return EMPTY;
    const marker = view.getUint8(pos + 1);
    if (marker === 0xda || marker === 0xd9) return EMPTY; // image data / end: no EXIF before it
    const size = view.getUint16(pos + 2);
    if (marker === 0xe1 && readAscii(view, pos + 4, 4) === "Exif") {
      return parseTiff(view, pos + 10);
    }
    pos += 2 + size;
  }
  return EMPTY;
}

function parseTiff(view: DataView, tiff: number): ExifInfo {
  const order = view.getUint16(tiff);
  const little = order === 0x4949; // "II"
  if (!little && order !== 0x4d4d) return EMPTY; // "MM"
  const u16 = (at: number) => view.getUint16(at, little);
  const u32 = (at: number) => view.getUint32(at, little);
  if (u16(tiff + 2) !== 42) return EMPTY;

  const entries = (ifd: number) => {
    const count = u16(ifd);
    const out = new Map<number, number>(); // tag → entry offset
    for (let i = 0; i < count; i++) {
      const entry = ifd + 2 + i * 12;
      out.set(u16(entry), entry);
    }
    return out;
  };
  const ascii = (entry: number) => {
    const count = u32(entry + 4);
    const at = count > 4 ? tiff + u32(entry + 8) : entry + 8;
    return readAscii(view, at, count).replace(/\0+$/, "").trim();
  };

  const ifd0 = entries(tiff + u32(tiff + 4));
  const orientationEntry = ifd0.get(TAG_ORIENTATION);
  const orientation = orientationEntry !== undefined ? u16(orientationEntry + 8) : null;

  let raw: string | null = null;
  let offset: string | null = null;
  const exifPointer = ifd0.get(TAG_EXIF_IFD);
  if (exifPointer !== undefined) {
    const exif = entries(tiff + u32(exifPointer + 8));
    const dto = exif.get(TAG_DATETIME_ORIGINAL);
    if (dto !== undefined) raw = ascii(dto);
    const off = exif.get(TAG_OFFSET_TIME_ORIGINAL);
    if (off !== undefined) offset = ascii(off);
  }
  if (!raw) {
    const dt = ifd0.get(TAG_DATETIME);
    if (dt !== undefined) raw = ascii(dt);
  }

  return {
    dateTimeOriginal: raw ? toIsoLocal(raw) : null,
    offset: offset && /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : null,
    orientation: orientation && orientation >= 1 && orientation <= 8 ? orientation : null,
  };
}

// "2026:05:01 14:03:22" → "2026-05-01T14:03:22"; anything else → null
function toIsoLocal(raw: string): string | null {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(raw);
  if (!m || m[1] === "0000") return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
}

function readAscii(view: DataView, at: number, length: number): string {
  let s = "";
  for (let i = 0; i < length && at + i < view.byteLength; i++) s += String.fromCharCode(view.getUint8(at + i));
  return s;
}
