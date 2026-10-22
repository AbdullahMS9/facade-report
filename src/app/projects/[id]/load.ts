import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { getProject } from "@/lib/db/queries";

// Loads a project the signed-in user can see, or shows 404.
export async function loadProject(rawId: string) {
  const session = await requireMember();
  const id = z.uuid().safeParse(rawId);
  if (!id.success) notFound();
  const { data: project } = await getProject(session.supabase, id.data);
  if (!project || !project.buildings) notFound();
  return { ...session, project, building: project.buildings };
}
