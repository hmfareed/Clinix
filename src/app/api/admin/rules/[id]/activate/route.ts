import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdminAuth } from "@/lib/auth/rbac";
import { connectToDatabase } from "@/lib/db/mongodb";
import TriageRuleSet from "@/models/TriageRuleSet";
import { logAuditEvent } from "@/lib/audit/audit";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdminAuth(["clinical_reviewer"]);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Rule set not found." } },
        { status: 404 }
      );
    }

    await connectToDatabase();

    const targetRuleSet = await TriageRuleSet.findById(id);
    if (!targetRuleSet) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Rule set not found." } },
        { status: 404 }
      );
    }

    if (targetRuleSet.approvalStatus !== "approved") {
      return NextResponse.json(
        {
          error: {
            code: "APPROVAL_REQUIRED",
            message: `Rule set '${targetRuleSet.version}' is in status '${targetRuleSet.approvalStatus}' and cannot be activated without clinical reviewer approval.`,
          },
        },
        { status: 400 }
      );
    }

    // Deactivate all rule sets
    await TriageRuleSet.updateMany({}, { $set: { isActive: false } });

    // Activate selected rule set
    targetRuleSet.isActive = true;
    await targetRuleSet.save();

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    await logAuditEvent({
      actorId: authResult.user.id,
      actorRole: authResult.user.role,
      action: "rule_set_activated",
      resourceType: "TriageRuleSet",
      resourceId: id,
      outcome: "success",
      ip: clientIp,
      metadata: { version: targetRuleSet.version, activatedBy: authResult.user.email },
    });

    return NextResponse.json({
      success: true,
      message: `Rule set '${targetRuleSet.version}' is now the ACTIVE triage rule set.`,
      data: {
        id: String(targetRuleSet._id),
        version: targetRuleSet.version,
        isActive: true,
      },
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

    console.error("[RuleActivateAPI] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to activate rule set." } },
      { status: 500 }
    );
  }
}
