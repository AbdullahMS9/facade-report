import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { checkerInput } from "@/lib/db/checkerInput";
import { getProject } from "@/lib/db/queries";
import { runChecks, summarizeChecks } from "@/lib/rules";

// Loads a project the signed-in user can see, or shows 404. Cached per
// request, so the layout and the page share one lookup.
export const loadProject = cache(async (rawId: string) => {
  const session = await requireMember();
  const id = z.uuid().safeParse(rawId);
  if (!id.success) notFound();
  const { data: project } = await getProject(session.supabase, id.data);
  if (!project || !project.buildings) notFound();
  return { ...session, project, building: project.buildings };
});

// Checker results for a project, cached per request.
export const loadChecks = cache(async (rawId: string) => {
  const { supabase, project } = await loadProject(rawId);
  const results = runChecks(await checkerInput(supabase, project));
  return { results, ...summarizeChecks(results) };
});
