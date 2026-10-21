"use client";

import { useActionState } from "react";
import { Button, Message } from "@/components/ui";
import { acceptInvitation } from "./actions";

export function AcceptForm({ token, firmName }: { token: string; firmName: string }) {
  const [state, action, pending] = useActionState(acceptInvitation, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {state.error ? <Message tone="error">{state.error}</Message> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Joining…" : `Join ${firmName}`}
      </Button>
    </form>
  );
}
