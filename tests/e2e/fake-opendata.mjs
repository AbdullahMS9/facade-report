// Stand-in for the NYC Open Data facade API during Playwright runs.
// Returns fictional filings for any query (CLAUDE.md §8: no real data in tests).
import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_OPENDATA_PORT ?? 4010);

const ROWS = [
  {
    tr6_no: "TR6-000001-9A-I1",
    cycle: "9",
    filing_type: "Initial",
    filing_status: "SWARMP",
    current_status: "SWARMP",
    prior_status: "SAFE",
    filing_date: "2021-03-15T00:00:00.000",
    field_inspection_completed_date: "2021-02-20T00:00:00.000",
    qewi_name: "SAM SAMPLE",
    qewi_nys_lic_no: "RA - 000999",
  },
  {
    tr6_no: "TR6-000001-8A-I1",
    cycle: "8",
    filing_type: "Initial",
    filing_status: "SAFE",
    current_status: "SAFE",
    filing_date: "2016-05-02T00:00:00.000",
  },
];

createServer((req, res) => {
  if (req.url?.startsWith("/health")) {
    res.writeHead(200).end("ok");
    return;
  }
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(ROWS));
}).listen(PORT, "127.0.0.1", () => console.log(`fake Open Data on ${PORT}`));
