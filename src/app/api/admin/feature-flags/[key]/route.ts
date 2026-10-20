import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth/rbac";
import { setFeatureFlag } from "@/lib/governance/feature-flags";
import { logAuditEvent } from "@/lib/audit/audit";

const updateFlagSchema = z.object({
  enabled: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  try {
    // Only system_admin or clinical_reviewer can toggle kill switches
    const authResult = await requireAdminAuth(["system_admin", "clinical_reviewer"]);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { key } = await context.params;
    const body = await req.json();
    const parseResult = updateFlagSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: "Invalid payload: enabled must be a boolean." } },
        { status: 400 }
      );
    }

    const { enabled } = parseResult.data;
    await setFeatureFlag(key, enabled, authResult.user.email);

    // Audit log kill switch actuation
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    await logAuditEvent({
      actorId: authResult.user.id,
      actorRole: authResult.user.role,
      action: enabled ? "feature_flag_enabled" : "kill_switch_activated",
      resourceType: "FeatureFlag",
      resourceId: key,
      outcome: "success",
      ip: clientIp,
      metadata: { key, enabled },
    });

    return NextResponse.json({
      success: true,
      message: `Feature flag '${key}' set to ${enabled ? "ENABLED" : "DISABLED (Kill Switch Active)"}.`,
      data: { key, enabled, updatedBy: authResult.user.email },
    });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      (String((error as { digest?: unknown }).digest).includes("PRERENDER") ||
       String((error as { digest?: unknown }).digest).includes("HANGING") ||
       String((error as { digest?: unknown }).digest).includes("DYNAMIC"))
    ) {
      throw error;
    }

    console.error("[AdminFeatureFlagPATCH] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update feature flag." } },
      { status: 500 }
    );
  }
}
