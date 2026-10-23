"use client";

import { useActionState, useState } from "react";
import { Button, Field, Message } from "@/components/ui";
import { sendCode, verifyCode, type LoginState } from "./actions";

export function LoginForm({ next, defaultEmail }: { next: string; defaultEmail: string }) {
  const [sendState, sendAction, sending] = useActionState<LoginState, FormData>(sendCode, {
    step: "email",
    email: defaultEmail,
  });
  const [verifyState, verifyAction, verifying] = useActionState<LoginState, FormData>(verifyCode, {
    step: "code",
    email: "",
  });
  const [changingEmail, setChangingEmail] = useState(false);

  const onCodeStep = sendState.step === "code" && !changingEmail;

  if (!onCodeStep) {
    return (
      <form action={(fd) => { setChangingEmail(false); sendAction(fd); }} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <Field
          label="Work email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={sendState.email ?? defaultEmail}
        />
        {sendState.step === "email" && sendState.error ? <Message tone="error">{sendState.error}</Message> : null}
        <Button type="submit" disabled={sending}>
          {sending ? "Sending…" : "Email me a sign-in code"}
        </Button>
      </form>
    );
  }

  const email = sendState.email;
  return (
    <form action={verifyAction} className="flex flex-col gap-4">
      <Message tone="info">
        We emailed {email}. Tap the sign-in link in the email, or enter the code here. It expires in 1 hour.
      </Message>
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="next" value={next} />
      <Field
        label="Sign-in code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6,10}"
        maxLength={10}
        required
        autoFocus
      />
      {verifyState.error ? <Message tone="error">{verifyState.error}</Message> : null}
      <Button type="submit" disabled={verifying}>
        {verifying ? "Checking…" : "Sign in"}
      </Button>
      <Button type="button" variant="secondary" onClick={() => setChangingEmail(true)}>
        Use a different email or resend
      </Button>
    </form>
  );
}
