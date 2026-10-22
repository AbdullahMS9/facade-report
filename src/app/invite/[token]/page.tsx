import Link from "next/link";
import { Message, PageShell } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { tokenSchema } from "@/lib/schemas";
import { SignOutButton } from "@/components/SignOutButton";
import { AcceptForm } from "./AcceptForm";

export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token: rawToken } = await props.params;
  const token = tokenSchema.safeParse(rawToken);
  const { supabase, user, membership } = await getSession();

  const preview = token.success
    ? (await supabase.rpc("invitation_preview", { p_token: token.data })).data?.[0]
    : undefined;

  if (!token.success || !preview) {
    return (
      <PageShell title="Invitation not found">
        <Message tone="error">This invitation link is not valid. Ask your QEWI to send a new one.</Message>
      </PageShell>
    );
  }
  if (preview.status !== "open") {
    return (
      <PageShell title="Invitation unavailable">
        <Message tone="error">
          {preview.status === "used"
            ? "This invitation has already been used."
            : "This invitation has expired. Ask your QEWI to send a new one."}
        </Message>
        {user ? <Link href="/" className="underline">Go to Facade Report</Link> : null}
      </PageShell>
    );
  }

  const path = `/invite/${token.data}`;
  return (
    <PageShell title={`Join ${preview.firm_name}`}>
      <p>
        {preview.firm_name} invited <strong>{preview.email}</strong> to Facade Report.
      </p>

      {!user ? (
        <Link
          href={`/login?next=${encodeURIComponent(path)}&email=${encodeURIComponent(preview.email)}`}
          className="flex min-h-12 items-center justify-center rounded-lg bg-blue-700 px-4 font-medium text-white"
        >
          Sign in as {preview.email}
        </Link>
      ) : user.email?.toLowerCase() !== preview.email ? (
        <>
          <Message tone="error">
            You&apos;re signed in as {user.email}, but this invitation is for {preview.email}. Sign
            out, then sign in with the invited email.
          </Message>
          <SignOutButton />
        </>
      ) : membership ? (
        <Message tone="error">
          You already belong to {membership.firmName}. A user can only be in one firm.
        </Message>
      ) : (
        <AcceptForm token={token.data} firmName={preview.firm_name} />
      )}
    </PageShell>
  );
}
