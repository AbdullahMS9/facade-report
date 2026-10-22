import Link from "next/link";
import { Button, Field, PageShell } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { ActionForm } from "@/components/ActionForm";
import { Select } from "@/components/fields";
import { addInspector, removeInspector, revokeInvitation } from "./actions";
import { InviteForm } from "./InviteForm";

const ROLE_LABEL = { qewi: "QEWI", staff: "Staff" } as const;

export default async function TeamPage() {
  const { supabase, user, membership } = await requireMember();
  const isQewi = membership.role === "qewi";

  const { data: members } = await supabase.rpc("firm_members");
  const { data: inspectors } = await supabase
    .from("inspectors")
    .select("id, name, license_type, license_number")
    .order("name");
  const { data: invitations } = isQewi
    ? await supabase
        .from("invitations")
        .select("id, email, role, token, expires_at")
        .is("accepted_at", null)
        .order("created_at")
    : { data: [] };
  const siteUrl = publicEnv().NEXT_PUBLIC_SITE_URL;

  return (
    <PageShell title="Team">
      <Link href="/" className="text-sm underline">← {membership.firmName}</Link>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Members</h2>
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-700 dark:border-neutral-700">
          {(members ?? []).map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-3 px-3 py-3">
              <span className="break-all">
                {m.email}
                {m.user_id === user.id ? " (you)" : ""}
              </span>
              <span className="shrink-0 text-sm font-medium">{ROLE_LABEL[m.role]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Inspectors (QEWIs)</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Licensed QEWIs who can sign this firm&apos;s reports. Each project names one.
        </p>
        {inspectors && inspectors.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {inspectors.map((i) => (
              <li key={i.id} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
                <div className="flex justify-between gap-3">
                  <span>{i.name}</span>
                  <span className="shrink-0 text-sm">{i.license_type} {i.license_number}</span>
                </div>
                {isQewi ? (
                  <form action={removeInspector}>
                    <input type="hidden" name="id" value={i.id} />
                    <Button type="submit" variant="danger" className="w-full">Remove</Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">No inspectors yet.</p>
        )}
        {isQewi ? (
          <ActionForm action={addInspector} submitLabel="Add inspector" pendingLabel="Adding…" resetOnSuccess>
            <Field label="Name" name="name" required maxLength={200} />
            <Select label="License type" name="license_type" defaultValue="PE">
              <option value="PE">PE (Professional Engineer)</option>
              <option value="RA">RA (Registered Architect)</option>
            </Select>
            <Field label="License number" name="license_number" required maxLength={50} />
            <Select
              label="Team member (optional)"
              name="user_id"
              defaultValue=""
              hint="Link the license to their Facade Report account."
            >
              <option value="">Not linked</option>
              {(members ?? []).map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.email}</option>
              ))}
            </Select>
          </ActionForm>
        ) : null}
      </section>

      {isQewi ? (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Pending invitations</h2>
            {invitations && invitations.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {invitations.map((inv) => {
                  const expired = new Date(inv.expires_at) < new Date();
                  return (
                    <li key={inv.id} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
                      <div className="flex justify-between gap-3">
                        <span className="break-all">{inv.email}</span>
                        <span className="shrink-0 text-sm">{ROLE_LABEL[inv.role]}</span>
                      </div>
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">
                        {expired ? "Expired. Revoke it and send a new one." : `Link: ${siteUrl}/invite/${inv.token}`}
                      </span>
                      <form action={revokeInvitation}>
                        <input type="hidden" name="id" value={inv.id} />
                        <Button type="submit" variant="danger" className="w-full">Revoke</Button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">No pending invitations.</p>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Invite someone</h2>
            <InviteForm />
          </section>
        </>
      ) : (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Only your firm&apos;s QEWI can invite people.
        </p>
      )}
    </PageShell>
  );
}
