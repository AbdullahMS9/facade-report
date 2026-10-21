import { redirect } from "next/navigation";
import { PageShell } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { safeNextPath } from "@/lib/schemas";
import { LoginForm } from "./LoginForm";

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const next = safeNextPath(params.next);
  const email = typeof params.email === "string" ? params.email : "";

  const { user } = await getSession();
  if (user) redirect(next);

  return (
    <PageShell title="Sign in">
      <p>Sign in with your work email. We&apos;ll email you a code. No password needed.</p>
      <LoginForm next={next} defaultEmail={email} />
    </PageShell>
  );
}
