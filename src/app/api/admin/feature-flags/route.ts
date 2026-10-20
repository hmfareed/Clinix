import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/rbac";
import { getAllFeatureFlags, setFeatureFlag } from "@/lib/governance/feature-flags";
import { logAuditEvent } from "@/lib/audit/audit";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdminAuth();
    if (!authResult.authorized) {
      return authResult.response;
    }

    const flags = await getAllFeatureFlags();
    return NextResponse.json({ success: true, data: flags });
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

    console.error("[AdminFeatureFlagsGET] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to retrieve feature flags." } },
      { status: 500 }
    );
  }
}
