import { describe, expect, it } from "vitest";
import { readExif } from "./exif";
import { fitWithin, meetsMinimumSize } from "./size";
import { localTimeToIso } from "./time";

// Builds a tiny JPEG header with an EXIF block, in either byte order.
function jpegWithExif(opts: {
  little?: boolean;
  orientation?: number;
  dateTimeOriginal?: string;
  offset?: string;
  dateTime?: string;
}): ArrayBuffer {
  const little = opts.little ?? true;
  const tiff: number[] = [];
  const u16 = (v: number) => (little ? [v & 255, v >> 8] : [v >> 8, v & 255]);
  const u32 = (v: number) =>
    little ? [v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24] : [v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255];
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0)).concat(0);

  type Entry = { tag: number; type: number; value: number[] }; // value: raw bytes (ascii) or short
  const ifd0: Entry[] = [];
  const exif: Entry[] = [];
  if (opts.orientation) ifd0.push({ tag: 0x0112, type: 3, value: u16(opts.orientation) });
  if (opts.dateTime) ifd0.push({ tag: 0x0132, type: 2, value: ascii(opts.dateTime) });
  if (opts.dateTimeOriginal) exif.push({ tag: 0x9003, type: 2, value: ascii(opts.dateTimeOriginal) });
  if (opts.offset) exif.push({ tag: 0x9011, type: 2, value: ascii(opts.offset) });
  if (exif.length) ifd0.push({ tag: 0x8769, type: 4, value: [] });

  const ifdSize = (n: number) => 2 + n * 12 + 4;
  const ifd0At = 8;
  const exifAt = ifd0At + ifdSize(ifd0.length);
  let dataAt = exifAt + (exif.length ? ifdSize(exif.length) : 0);
  const data: number[] = [];

  const writeIfd = (entries: Entry[]) => {
    tiff.push(...u16(entries.length));
    for (const e of entries) {
      tiff.push(...u16(e.tag), ...u16(e.type));
      if (e.tag === 0x8769) {
        tiff.push(...u32(1), ...u32(exifAt));
      } else if (e.type === 3) {
        tiff.push(...u32(1), ...e.value, 0, 0);
      } else if (e.value.length <= 4) {
        tiff.push(...u32(e.value.length), ...e.value, ...Array(4 - e.value.length).fill(0));
      } else {
        tiff.push(...u32(e.value.length), ...u32(dataAt));
        data.push(...e.value);
        dataAt += e.value.length;
      }
    }
    tiff.push(...u32(0));
  };

  tiff.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(ifd0At));
  writeIfd(ifd0);
  if (exif.length) writeIfd(exif);
  tiff.push(...data);

  const app1Body = [...ascii("Exif"), 0, ...tiff]; // "Exif\0\0"
  const app1 = [0xff, 0xe1, (app1Body.length + 2) >> 8, (app1Body.length + 2) & 255, ...app1Body];
  const app0 = [0xff, 0xe0, 0, 4, 0, 0]; // a dummy segment before EXIF
  return new Uint8Array([0xff, 0xd8, ...app0, ...app1, 0xff, 0xda, 0, 2, 0xff, 0xd9]).buffer;
}

describe("readExif", () => {
  it("reads date, offset and orientation (little-endian)", () => {
    const info = readExif(jpegWithExif({ orientation: 6, dateTimeOriginal: "2026:05:01 14:03:22", offset: "-04:00" }));
    expect(info).toEqual({ dateTimeOriginal: "2026-05-01T14:03:22", offset: "-04:00", orientation: 6 });
  });

  it("reads big-endian files", () => {
    const info = readExif(jpegWithExif({ little: false, orientation: 3, dateTimeOriginal: "2025:12:31 23:59:59" }));
    expect(info).toEqual({ dateTimeOriginal: "2025-12-31T23:59:59", offset: null, orientation: 3 });
  });

  it("falls back to the IFD0 DateTime", () => {
    expect(readExif(jpegWithExif({ dateTime: "2026:01:02 03:04:05" })).dateTimeOriginal).toBe("2026-01-02T03:04:05");
  });

  it("ignores blank camera dates", () => {
    expect(readExif(jpegWithExif({ dateTimeOriginal: "0000:00:00 00:00:00" })).dateTimeOriginal).toBeNull();
  });

  it("returns empty fields for non-JPEGs and broken data", () => {
    const empty = { dateTimeOriginal: null, offset: null, orientation: null };
    expect(readExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toEqual(empty);
    expect(readExif(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 50, 0x45]).buffer)).toEqual(empty);
    expect(readExif(new ArrayBuffer(0))).toEqual(empty);
  });
});

describe("localTimeToIso", () => {
  it("uses the recorded offset", () => {
    expect(localTimeToIso("2026-05-01T14:03:22", "-04:00")).toBe("2026-05-01T18:03:22.000Z");
  });

  it("assumes New York time without an offset (summer and winter)", () => {
    expect(localTimeToIso("2026-07-01T09:00:00", null)).toBe("2026-07-01T13:00:00.000Z");
    expect(localTimeToIso("2026-01-15T09:00:00", null)).toBe("2026-01-15T14:00:00.000Z");
  });

  it("handles the day clocks change", () => {
    // Mar 8, 2026: clocks jump at 2am. 3:30am is EDT (-4).
    expect(localTimeToIso("2026-03-08T03:30:00", null)).toBe("2026-03-08T07:30:00.000Z");
  });

  it("rejects bad input", () => {
    expect(localTimeToIso("May 1", null)).toBeNull();
    expect(localTimeToIso("2026-05-01T14:03:22", "EDT")).toBeNull();
  });
});

describe("photo size", () => {
  it("checks 800 × 600 in either orientation", () => {
    expect(meetsMinimumSize(800, 600)).toBe(true);
    expect(meetsMinimumSize(600, 800)).toBe(true);
    expect(meetsMinimumSize(799, 600)).toBe(false);
    expect(meetsMinimumSize(1200, 599)).toBe(false);
  });

  it("fits the longest side within the limit without upscaling", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1500, height: 2000 });
    expect(fitWithin(1200, 900)).toEqual({ width: 1200, height: 900 });
  });
});
