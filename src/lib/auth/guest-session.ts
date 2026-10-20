import crypto from "crypto";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/db/mongodb";
import AssessmentSession, { IAssessmentSession } from "@/models/AssessmentSession";

export const GUEST_COOKIE_NAME = "clinix_guest_token";
export const GUEST_TTL_HOURS = 24;

export function generateGuestToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashGuestToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createGuestSession(language = "en"): Promise<{
  session: IAssessmentSession;
  rawToken: string;
}> {
  await connectToDatabase();
  const rawToken = generateGuestToken();
  const tokenHash = hashGuestToken(rawToken);

  const expiresAt = new Date(Date.now() + GUEST_TTL_HOURS * 60 * 60 * 1000);

  const session = await AssessmentSession.create({
    ownerType: "guest",
    guestTokenHash: tokenHash,
    status: "active",
    language,
    triageState: "initial",
    expiresAt,
  });

  return { session, rawToken };
}

export async function getGuestTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(GUEST_COOKIE_NAME)?.value;
  return token || null;
}

export async function getGuestSessionByToken(
  rawToken: string
): Promise<IAssessmentSession | null> {
  if (!rawToken) return null;
  await connectToDatabase();
  const tokenHash = hashGuestToken(rawToken);

  const session = await AssessmentSession.findOne({
    guestTokenHash: tokenHash,
    ownerType: "guest",
    expiresAt: { $gt: new Date() },
  });

  return session;
}

export async function revokeGuestSession(rawToken: string): Promise<void> {
  if (!rawToken) return;
  await connectToDatabase();
  const tokenHash = hashGuestToken(rawToken);

  await AssessmentSession.updateOne(
    { guestTokenHash: tokenHash },
    { $set: { status: "abandoned", expiresAt: new Date() } }
  );
}
