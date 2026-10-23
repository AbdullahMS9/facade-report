import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { safeNextPath } from "@/lib/schemas";

// Finishes sign-in from an emailed link. Supabase sends people here with
// ?code= (PKCE: the link must be opened in the browser that asked for it) or
// with ?token_hash=&type=. The 6-digit code on /login is the main path; links
// are a stopgap while hosted emails can't carry a code (CLAUDE.md §9).
const LINK_TYPES: EmailOtpType[] = ["magiclink", "signup", "invite", "email"];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  const failed = () => {
    const url = new URL("/login", request.nextUrl.origin);
    url.searchParams.set("link", "failed");
    if (next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  };

  if (params.get("error")) return failed(); // e.g. expired link
  const supabase = await createClient();
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type && LINK_TYPES.includes(type)) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }
  return ok ? NextResponse.redirect(new URL(next, request.nextUrl.origin)) : failed();
}
