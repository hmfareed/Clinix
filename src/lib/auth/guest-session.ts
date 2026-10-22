import crypto from "crypto";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import { connectToDatabase, tryConnectToDatabase } from "@/lib/db/mongodb";
import AssessmentSession, { IAssessmentSession } from "@/models/AssessmentSession";

export const GUEST_COOKIE_NAME = "clinix_guest_token";
export const GUEST_TTL_HOURS = 24;

const inMemoryGuestSessions = new Map<string, any>();

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
  const rawToken = generateGuestToken();
  const tokenHash = hashGuestToken(rawToken);
  const expiresAt = new Date(Date.now() + GUEST_TTL_HOURS * 60 * 60 * 1000);

  const dbAvailable = await tryConnectToDatabase();
  if (!dbAvailable) {
    const sessionObj: any = {
      _id: new mongoose.Types.ObjectId(),
      ownerType: "guest",
      guestTokenHash: tokenHash,
      status: "active",
      language,
      triageState: "initial",
      expiresAt,
      save: async function () {
        return this;
      },
    };
    inMemoryGuestSessions.set(tokenHash, sessionObj);
    return { session: sessionObj, rawToken };
  }

  try {
    await connectToDatabase();
    const session = await AssessmentSession.create({
      ownerType: "guest",
      guestTokenHash: tokenHash,
      status: "active",
      language,
      triageState: "initial",
      expiresAt,
    });

    return { session, rawToken };
  } catch (err) {
    console.warn("[GUEST SESSION FALLBACK] DB connection failed, using in-memory guest session:", err);
    const sessionObj: any = {
      _id: new mongoose.Types.ObjectId(),
      ownerType: "guest",
      guestTokenHash: tokenHash,
      status: "active",
      language,
      triageState: "initial",
      expiresAt,
      save: async function () {
        return this;
      },
    };
    inMemoryGuestSessions.set(tokenHash, sessionObj);
    return { session: sessionObj, rawToken };
  }
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
  const tokenHash = hashGuestToken(rawToken);

  const mem = inMemoryGuestSessions.get(tokenHash);
  if (mem) {
    if (mem.expiresAt > new Date() && mem.status === "active") {
      return mem;
    }
    return null;
  }

  const dbAvailable = await tryConnectToDatabase();
  if (!dbAvailable) return null;

  try {
    await connectToDatabase();
    const session = await AssessmentSession.findOne({
      guestTokenHash: tokenHash,
      ownerType: "guest",
      expiresAt: { $gt: new Date() },
    });
    return session;
  } catch (err) {
    console.warn("[GET GUEST SESSION ERROR]", err);
    return null;
  }
}

export async function revokeGuestSession(rawToken: string): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashGuestToken(rawToken);

  if (inMemoryGuestSessions.has(tokenHash)) {
    const s = inMemoryGuestSessions.get(tokenHash);
    s.status = "abandoned";
    s.expiresAt = new Date();
  }

  if (await tryConnectToDatabase()) {
    try {
      await connectToDatabase();
      await AssessmentSession.updateOne(
        { guestTokenHash: tokenHash },
        { $set: { status: "abandoned", expiresAt: new Date() } }
      );
    } catch {
      // Ignore
    }
  }
}
