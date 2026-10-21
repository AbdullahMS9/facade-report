// All FISP rule values in one place. Citations are to 1 RCNY §103-04
// (PDF dated Feb 3, 2026). Rules change (e.g. Local Law 49 of 2025, Cycle 11
// proposals), so change values here rather than in the rule functions.

export type BlockDigit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface FispRules {
  cycle: { referenceCycle: number; referenceStartYear: number; lengthYears: number };
  filingWindow: {
    opensMonth: number;
    opensDay: number;
    lengthYears: number;
    offsetYearsByBlockDigit: Record<BlockDigit, number>;
    endIsInclusive: boolean;
  };
  closeups: { intervalFeet: number; minimumPerBuilding: number };
  probes: { firstCycle: number; requiredInEvenCycles: boolean };
  filingLimits: {
    daysAfterFinalInspection: number;
    yearsAfterCloseup: number;
    refileDaysAfterRejection: number;
  };
}

export const FISP_RULES: Readonly<FispRules> = {
  cycle: {
    // Cycle 10 began Feb 21, 2025; cycles are five years long.
    // §103-04(c)(4)(ii) five-year cycle; (c)(4)(v) staggered windows.
    referenceCycle: 10,
    referenceStartYear: 2025,
    lengthYears: 5,
  },

  filingWindow: {
    // §103-04(c)(4)(v): windows start and end on February 21.
    opensMonth: 2,
    opensDay: 21,
    lengthYears: 2,
    // Years after the cycle start year that the window opens, by the last
    // digit of the tax block number. §103-04(c)(4)(v)(A)–(C).
    offsetYearsByBlockDigit: {
      4: 0, 5: 0, 6: 0, 9: 0, // (A) years ending 0 and 5
      0: 1, 7: 1, 8: 1, //       (B) years ending 1 and 6
      1: 2, 2: 2, 3: 2, //       (C) years ending 2 and 7
    },
    // ASSUMPTION (unconfirmed): a filing on the closing Feb 21 is on time.
    endIsInclusive: true,
  },

  closeups: {
    // §103-04(c)(2)(iv): one more close-up per 60 ft of elevation fronting a
    // public right-of-way. Table thresholds not verified from the PDF text;
    // formula from CLAUDE.md §3.2.
    intervalFeet: 60,
    // §103-04(c)(2)(iv): minimum one physical examination per building.
    minimumPerBuilding: 1,
  },

  probes: {
    // §103-04(c)(2)(v): "Starting with the ninth cycle, probes must be
    // performed on all cavity wall construction, and, at a minimum, during
    // every subsequent odd-numbered cycle."
    firstCycle: 9,
    // UNCONFIRMED: rule text only mandates odd cycles; other DOB material says
    // probes are currently required. Confirm with a QEWI (CLAUDE.md §3.3).
    requiredInEvenCycles: true,
  },

  filingLimits: {
    // §103-04(c)(4)(viii): file within 60 days of the final inspection date.
    daysAfterFinalInspection: 60,
    // §103-04(c)(4)(ix): no more than 1 year after close-up completion.
    yearsAfterCloseup: 1,
    // §103-04(c)(4)(x): revised report within 45 days of DOB rejection.
    refileDaysAfterRejection: 45,
  },
};
