import { redirect } from "next/navigation";
import { Message, PageShell } from "@/components/ui";
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
      {params.link === "failed" ? (
        <Message tone="error">
          That sign-in link didn&apos;t work. It may have expired, or been opened in a different browser from the one
          you requested it in. Request a new one below.
        </Message>
      ) : null}
      <p>Sign in with your work email. We&apos;ll email you a sign-in code. No password needed.</p>
      <LoginForm next={next} defaultEmail={email} />
    </PageShell>
  );
}
