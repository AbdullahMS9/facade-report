import { rollUpStatus } from "./classification";
import type { Classification } from "./types";

// A condition from the previous report that required repair.
export interface PriorItem {
  // null = the inspector has not yet said whether it was repaired.
  repaired: boolean | null;
}

export type PriorItemResolution =
  | { status: "repaired" }
  | { status: "carried_forward"; classification: "unsafe" }
  | { status: "unresolved" };

// §103-04(a) "Unsafe condition" and (c)(6)(iii): a prior SWARMP condition not
// corrected at the current inspection must be reported as unsafe.
// §103-04(c)(3)(iii)(N): the same applies to any prior item requiring repair.
export function resolvePriorItem(item: PriorItem): PriorItemResolution {
  if (item.repaired === null) return { status: "unresolved" };
  if (item.repaired) return { status: "repaired" };
  return { status: "carried_forward", classification: "unsafe" };
}

// Classifications added to this report by unrepaired prior items.
export function carriedForwardClassifications(items: readonly PriorItem[]): Classification[] {
  return items.flatMap((item) => {
    const r = resolvePriorItem(item);
    return r.status === "carried_forward" ? [r.classification] : [];
  });
}

// Building status for this report: current conditions plus carried-forward
// prior items. Unresolved prior items do not change the status; the checker
// blocks filing until each one is resolved.
export function buildingStatus(
  conditions: readonly Classification[],
  priorItems: readonly PriorItem[],
): Classification {
  return rollUpStatus([...conditions, ...carriedForwardClassifications(priorItems)]);
}
