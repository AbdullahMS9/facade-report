import { FISP_RULES } from "./config";

// §103-04(c)(2)(v): whether cavity wall probes are required this cycle.
// Even-cycle behavior is a config flag pending QEWI confirmation.
export function probesRequiredInCycle(cycle: number, rules = FISP_RULES): boolean {
  if (!Number.isInteger(cycle) || cycle < 1) {
    throw new RangeError(`Cycle must be a whole number of 1 or more: ${cycle}`);
  }
  if (cycle < rules.probes.firstCycle) return false;
  return cycle % 2 === 1 || rules.probes.requiredInEvenCycles;
}
