// A calendar date with no time or time zone: "YYYY-MM-DD".
export type IsoDate = string;

// §103-04(a) definitions: safe, SWARMP, unsafe.
export const CLASSIFICATIONS = ["safe", "swarmp", "unsafe"] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];
