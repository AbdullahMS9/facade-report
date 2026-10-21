import { FISP_RULES } from "./config";

export interface ElevationInput {
  facesStreet: boolean;
  frontageFt: number;
}

export interface CloseupRequirements {
  // Required count per elevation, same order as the input.
  byElevation: number[];
  // Minimum close-ups for the whole building.
  buildingMinimum: number;
}

// §103-04(c)(2)(iv): minimum close-ups for an elevation fronting a public
// right-of-way = floor(L / 60) + 1. Returns 0 for 0 ft so the checker can
// flag the missing frontage instead of guessing.
export function requiredCloseups(frontageFt: number, rules = FISP_RULES): number {
  if (!Number.isFinite(frontageFt) || frontageFt < 0) {
    throw new RangeError(`Frontage must be 0 or more feet: ${frontageFt}`);
  }
  if (frontageFt === 0) return 0;
  return Math.floor(frontageFt / rules.closeups.intervalFeet) + 1;
}

// Elevations not facing a street need only a representative sample, chosen by
// the QEWI, so they have no fixed count here. The building always needs at
// least one close-up overall. §103-04(c)(2)(iv).
export function closeupRequirements(
  elevations: readonly ElevationInput[],
  rules = FISP_RULES,
): CloseupRequirements {
  const byElevation = elevations.map((e) =>
    e.facesStreet ? requiredCloseups(e.frontageFt, rules) : 0,
  );
  const streetTotal = byElevation.reduce((sum, n) => sum + n, 0);
  return {
    byElevation,
    buildingMinimum: Math.max(streetTotal, rules.closeups.minimumPerBuilding),
  };
}
