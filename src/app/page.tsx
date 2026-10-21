import Link from "next/link";
import { PageShell } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { signOut } from "./auth-actions";

export default async function Home() {
  const { user, membership } = await requireMember();

  return (
    <PageShell title={membership.firmName}>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {user.email} · {membership.role === "qewi" ? "QEWI" : "Staff"}
      </p>
      <p>Projects are coming next. For now you can manage your team.</p>
      <Link
        href="/team"
        className="flex min-h-12 items-center justify-center rounded-lg border border-neutral-300 px-4 font-medium dark:border-neutral-600"
      >
        Team
      </Link>
      <form action={signOut}>
        <button type="submit" className="min-h-12 text-sm underline">Sign out</button>
      </form>
    </PageShell>
  );
}
