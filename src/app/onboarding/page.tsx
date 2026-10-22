import { redirect } from "next/navigation";
import { PageShell } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";
import { CreateFirmForm } from "./CreateFirmForm";

export default async function OnboardingPage() {
  const { user, membership } = await requireUser();
  if (membership) redirect("/");

  return (
    <PageShell title="Set up your firm">
      <p>
        Signed in as <strong>{user.email}</strong>. Create your firm to start. You&apos;ll be its
        QEWI and can invite your team.
      </p>
      <CreateFirmForm />
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Joining a firm that already uses Facade Report? Ask its QEWI to invite this email, then
        open the link in the invitation.
      </p>
      <SignOutButton />
    </PageShell>
  );
}
