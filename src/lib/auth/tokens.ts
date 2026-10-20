import crypto from "crypto";
import { connectToDatabase } from "@/lib/db/mongodb";
import VerificationToken, { TokenType } from "@/models/VerificationToken";

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createVerificationToken(
  identifier: string,
  type: TokenType,
  expiresInMinutes = 60
): Promise<string> {
  await connectToDatabase();
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  // Remove any pre-existing tokens of this type for this identifier
  await VerificationToken.deleteMany({ identifier, type });

  await VerificationToken.create({
    identifier,
    tokenHash,
    type,
    expiresAt,
  });

  return rawToken;
}

export async function verifyAndConsumeToken(
  rawToken: string,
  type: TokenType
): Promise<{ valid: boolean; identifier?: string; message?: string }> {
  await connectToDatabase();
  const tokenHash = hashToken(rawToken);

  const record = await VerificationToken.findOne({
    tokenHash,
    type,
    expiresAt: { $gt: new Date() },
  });

  if (!record) {
    return { valid: false, message: "Invalid or expired token." };
  }

  const identifier = record.identifier;
  // Consume token so it cannot be used again
  await VerificationToken.deleteOne({ _id: record._id });

  return { valid: true, identifier };
}
