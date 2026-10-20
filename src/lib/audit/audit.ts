import crypto from "crypto";
import { connectToDatabase } from "@/lib/db/mongodb";
import AuditEvent, { AuditOutcome } from "@/models/AuditEvent";

export interface LogAuditParams {
  actorId?: string;
  actorRole?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  outcome: AuditOutcome;
  ip?: string | null;
  metadata?: Record<string, unknown>;
}

export function hashIp(ip: string | null | undefined): string | undefined {
  if (!ip) return undefined;
  return crypto.createHash("sha256").update(ip.trim()).digest("hex").slice(0, 32);
}

const REDACTED_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "tokenhash",
  "guesttoken",
  "transcript",
  "symptoms",
  "secret",
  "authorization",
]);

function sanitizeMetadata(data?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!data) return undefined;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export async function logAuditEvent(params: LogAuditParams): Promise<void> {
  const ipHash = hashIp(params.ip);
  const sanitizedMetadata = sanitizeMetadata(params.metadata);

  try {
    await connectToDatabase();
    await AuditEvent.create({
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      outcome: params.outcome,
      ipHash,
      metadata: sanitizedMetadata,
      at: new Date(),
    });
  } catch (err) {
    // Audit logging failure should be logged to stderr without bringing down user operations
    console.error("[AUDIT FAILURE] Could not record audit event to database:", {
      action: params.action,
      outcome: params.outcome,
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    });
  }
}
