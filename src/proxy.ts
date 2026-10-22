import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/db/session";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Everything except static files, images, the service worker and the manifest.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
