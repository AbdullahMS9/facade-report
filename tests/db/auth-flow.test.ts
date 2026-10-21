import { afterAll, describe, expect, it } from "vitest";
import {
  anonClient,
  cleanup,
  createFirm,
  createUser,
  latestEmail,
  testEmail,
  trackUserByEmail,
} from "./helpers";

// The sign-in flow the app uses: email → 6-digit code → session.
const SUBJECT_CODE = "Your Facade Report sign-in code";
const firmIds: string[] = [];

afterAll(async () => {
  await cleanup(firmIds);
});

async function signInWithCode(email: string) {
  const db = anonClient();
  const sent = await db.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  expect(sent.error).toBeNull();
  await trackUserByEmail(email);

  const mail = await latestEmail(email, SUBJECT_CODE);
  const code = /\b(\d{6})\b/.exec(mail.text)?.[1];
  expect(code, "6-digit code in email").toBeDefined();

  const verified = await db.auth.verifyOtp({ email, token: code!, type: "email" });
  expect(verified.error).toBeNull();
  return { db, user: verified.data.user! };
}

describe("sign-in with an emailed code", () => {
  it("signs up a new user and confirms their email", async () => {
    const email = testEmail("new");
    const { user } = await signInWithCode(email);
    expect(user.email).toBe(email);
    expect(user.email_confirmed_at).toBeTruthy();
  });

  it("signs in a returning user", async () => {
    const email = testEmail("returning");
    await signInWithCode(email);
    await new Promise((r) => setTimeout(r, 1_100));
    const again = await signInWithCode(email);
    expect(again.user.email).toBe(email);
  });

  it("rejects a wrong code", async () => {
    const email = testEmail("wrong");
    const db = anonClient();
    await db.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    await trackUserByEmail(email);
    const { error } = await db.auth.verifyOtp({ email, token: "000000", type: "email" });
    expect(error).not.toBeNull();
  });
});

describe("invited user", () => {
  it("gets an invite email with our link, signs in with a code, and joins", async () => {
    const qewi = await createUser("inviter");
    const firm = await createFirm(qewi, "Fictional Facade Engineers C");
    firmIds.push(firm);

    const email = testEmail("invitee");
    const inv = await qewi.db
      .from("invitations")
      .insert({ firm_id: firm, email, invited_by: qewi.id })
      .select("token")
      .single();
    expect(inv.error).toBeNull();
    const token = inv.data!.token;

    // What the team page's invite action does, with the service role.
    const { admin } = await import("./helpers");
    const invited = await admin.auth.admin.inviteUserByEmail(email, {
      data: { invite_token: token, firm_name: "Fictional Facade Engineers C" },
    });
    expect(invited.error).toBeNull();
    await trackUserByEmail(email);

    const inviteMail = await latestEmail(email, "You've been invited to Facade Report");
    expect(inviteMail.html).toContain(`/invite/${token}`);
    expect(inviteMail.html).toContain("Fictional Facade Engineers C");

    // Supabase spaces out emails to one address (max_frequency in config.toml).
    await new Promise((r) => setTimeout(r, 1_100));
    const { db } = await signInWithCode(email);
    const accepted = await db.rpc("accept_invitation", { p_token: token });
    expect(accepted.error).toBeNull();
    const firms = await db.from("firms").select("id");
    expect(firms.data?.map((f) => f.id)).toEqual([firm]);
  });
});

describe("password sign-up can't skip email confirmation", () => {
  it("gives no session until the email is confirmed", async () => {
    const email = testEmail("pw");
    const db = anonClient();
    const { data } = await db.auth.signUp({ email, password: "password-123456" });
    await trackUserByEmail(email);
    expect(data.session).toBeNull();
  });
});
