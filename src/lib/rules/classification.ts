import type { Classification } from "./types";

const SEVERITY: Record<Classification, number> = { safe: 0, swarmp: 1, unsafe: 2 };

// §103-04(c)(3)(iii)(N): any unsafe → unsafe; else any SWARMP → SWARMP;
// else safe. An empty list is safe; the checker separately requires at least
// three typical-condition photos for a safe building.
export function rollUpStatus(classifications: readonly Classification[]): Classification {
  return classifications.reduce<Classification>(
    (worst, c) => (SEVERITY[c] > SEVERITY[worst] ? c : worst),
    "safe",
  );
}
