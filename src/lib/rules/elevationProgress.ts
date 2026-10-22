import { FISP_RULES } from "./config";
import { requiredCloseups } from "./closeups";
import { probesRequiredInCycle } from "./probes";

export interface ElevationProgressInput {
  facesStreet: boolean;
  frontageFt: number;
  closeupCount: number;
}

export interface ElevationProgress {
  // Fixed minimum for street elevations; null for non-street elevations,
  // where the QEWI picks a representative sample (§103-04(c)(2)(iv)).
  required: number | null;
  recorded: number;
  // Drops still needed to reach the minimum (0 when met or not fixed).
  short: number;
}

export function elevationProgress(input: ElevationProgressInput, rules = FISP_RULES): ElevationProgress {
  const required = input.facesStreet ? requiredCloseups(input.frontageFt, rules) : null;
  return {
    required,
    recorded: input.closeupCount,
    short: required === null ? 0 : Math.max(0, required - input.closeupCount),
  };
}

// Probes apply to cavity wall buildings in cycles that require them
// (§103-04(c)(2)(v)). The waivers in that section (recent tie repair, new
// building, DOB-accepted alternate method) are not modeled yet.
// Unknown cavity wall status (null) is treated as "not known to apply".
export function probesApply(isCavityWall: boolean | null, cycle: number, rules = FISP_RULES): boolean {
  return isCavityWall === true && probesRequiredInCycle(cycle, rules);
}
