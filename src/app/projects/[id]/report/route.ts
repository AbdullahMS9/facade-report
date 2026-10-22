import { Packer } from "docx";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { buildReport } from "@/lib/report/build";
import { gatherReportData, reportFileName } from "@/lib/report/data";

// GET /projects/<id>/report → the Word report (CLAUDE.md §4 item 9).
export async function GET(_req: NextRequest, ctx: RouteContext<"/projects/[id]/report">) {
  const { id } = await ctx.params;
  const projectId = z.uuid().safeParse(id);
  if (!projectId.success) return new Response("Not found", { status: 404 });

  const { supabase, user, membership } = await getSession();
  if (!user || !membership) return new Response("Sign in to download reports.", { status: 401 });

  const data = await gatherReportData(supabase, projectId.data, membership.firmName);
  if (!data) return new Response("Not found", { status: 404 });

  const buffer = await Packer.toBuffer(buildReport(data));
  const name = reportFileName(data);
  const ascii = name.replace(/[^\x20-\x7e]/g, "-").replace(/"/g, "");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
