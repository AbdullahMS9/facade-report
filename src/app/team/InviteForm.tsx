"use client";

import { useActionState } from "react";
import { Button, Field, Message } from "@/components/ui";
import { inviteMember, type InviteState } from "./actions";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteMember, { status: "idle" });

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Email" name="email" type="email" inputMode="email" autoComplete="off" required />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Role</legend>
        <label className="flex min-h-12 items-center gap-3">
          <input type="radio" name="role" value="staff" defaultChecked className="size-5" />
          <span>Staff: field photos and notes</span>
        </label>
        <label className="flex min-h-12 items-center gap-3">
          <input type="radio" name="role" value="qewi" className="size-5" />
          <span>QEWI: reviews, signs and manages the team</span>
        </label>
      </fieldset>
      {state.status === "error" ? <Message tone="error">{state.error}</Message> : null}
      {state.status === "sent" ? (
        <Message tone="success">
          {state.emailSent
            ? `Invitation emailed to ${state.email}.`
            : `Invitation created for ${state.email}, but no email was sent (they may already have an account).`}{" "}
          You can also share this link: <span className="break-all font-mono">{state.link}</span>
        </Message>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send invitation"}
      </Button>
    </form>
  );
}
