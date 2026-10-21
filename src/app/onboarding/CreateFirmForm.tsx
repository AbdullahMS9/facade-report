"use client";

import { useActionState } from "react";
import { Button, Field, Message } from "@/components/ui";
import { createFirm } from "./actions";

export function CreateFirmForm() {
  const [state, action, pending] = useActionState(createFirm, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Firm name" name="name" required maxLength={200} autoComplete="organization" />
      {state.error ? <Message tone="error">{state.error}</Message> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create firm"}
      </Button>
    </form>
  );
}
