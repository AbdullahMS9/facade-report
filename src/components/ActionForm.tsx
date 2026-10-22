"use client";

import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import type { FormState } from "@/lib/schemas";
import { Button, Message } from "./ui";

// A form wired to a server action. Unlike a plain <form action>, it keeps what
// the user typed when the server returns an error, so long forms aren't lost.
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Saving…",
  successMessage,
  resetOnSuccess = false,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  successMessage?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, dispatch, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => dispatch(formData));
      }}
    >
      {children}
      {state.error ? <Message tone="error">{state.error}</Message> : null}
      {state.warning ? <Message tone="info">{state.warning}</Message> : null}
      {state.ok && successMessage && !state.warning ? <Message tone="success">{successMessage}</Message> : null}
      <Button type="submit" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}
