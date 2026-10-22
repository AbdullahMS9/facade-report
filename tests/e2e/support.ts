import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const status = JSON.parse(
  execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }),
) as { API_URL: string; SERVICE_ROLE_KEY: string; MAILPIT_URL: string };

export const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function testEmail(label: string): string {
  return `${label}-${randomUUID().slice(0, 8)}@example.test`;
}

// Waits for the sign-in code emailed to `to` and returns it.
export async function signInCode(to: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const q = encodeURIComponent(`to:"${to}" subject:"Your Facade Report sign-in code"`);
    const res = (await (await fetch(`${status.MAILPIT_URL}/api/v1/search?query=${q}`)).json()) as { messages: { ID: string }[] };
    const id = res.messages[0]?.ID;
    if (id) {
      const msg = (await (await fetch(`${status.MAILPIT_URL}/api/v1/message/${id}`)).json()) as { Text: string };
      const code = /\b(\d{6})\b/.exec(msg.Text)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No sign-in code arrived for ${to}`);
}

// Deletes the test user and their firm (cascades to all firm data).
export async function deleteUserAndFirm(email: string): Promise<void> {
  const { data } = await admin.auth.admin.listUsers();
  const user = data.users.find((u) => u.email === email);
  if (!user) return;
  const { data: m } = await admin.from("memberships").select("firm_id").eq("user_id", user.id).maybeSingle();
  if (m) {
    for (const path of await listFirmFiles(m.firm_id)) await admin.storage.from("photos").remove([path]);
    await admin.from("firms").delete().eq("id", m.firm_id);
  }
  await admin.auth.admin.deleteUser(user.id);
}

// Every file under a firm's folder in the photos bucket (<firm>/<project>/<photo>/<file>).
export async function listFirmFiles(firmId: string): Promise<string[]> {
  const out: string[] = [];
  const bucket = admin.storage.from("photos");
  for (const project of (await bucket.list(firmId)).data ?? []) {
    for (const photo of (await bucket.list(`${firmId}/${project.name}`)).data ?? []) {
      for (const file of (await bucket.list(`${firmId}/${project.name}/${photo.name}`)).data ?? []) {
        out.push(`${firmId}/${project.name}/${photo.name}/${file.name}`);
      }
    }
  }
  return out;
}

export async function firmIdFor(email: string): Promise<string> {
  const { data } = await admin.auth.admin.listUsers();
  const user = data.users.find((u) => u.email === email)!;
  const { data: m } = await admin.from("memberships").select("firm_id").eq("user_id", user.id).single();
  return m!.firm_id;
}

// Inserts an EXIF block with DateTimeOriginal ("YYYY:MM:DD HH:MM:SS") right
// after the JPEG start marker. Little-endian, one tag. For fictional test images.
export function withExifDate(jpeg: Buffer, dateTimeOriginal: string): Buffer {
  const text = Buffer.from(dateTimeOriginal + "\0", "ascii"); // 20 bytes
  const tiff = Buffer.alloc(8 + 18 + 18 + text.length);
  tiff.write("II", 0, "ascii");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4); // IFD0 at 8
  // IFD0: one entry, ExifIFD pointer → 26
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x8769, 10);
  tiff.writeUInt16LE(4, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt32LE(26, 18);
  tiff.writeUInt32LE(0, 22);
  // Exif IFD at 26: DateTimeOriginal, ASCII, data at 44
  tiff.writeUInt16LE(1, 26);
  tiff.writeUInt16LE(0x9003, 28);
  tiff.writeUInt16LE(2, 30);
  tiff.writeUInt32LE(text.length, 32);
  tiff.writeUInt32LE(44, 36);
  tiff.writeUInt32LE(0, 40);
  text.copy(tiff, 44);
  const body = Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);
  const header = Buffer.from([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 255]);
  return Buffer.concat([jpeg.subarray(0, 2), header, body, jpeg.subarray(2)]);
}
