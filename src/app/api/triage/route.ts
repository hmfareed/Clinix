import { NextRequest, NextResponse } from "next/server";
import { checkEmergencyRules } from "@/lib/safety/triage-engine";
import { logAuditEvent } from "@/lib/audit/audit";
import { auth } from "@/lib/auth/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();

    const result = checkEmergencyRules({
      text: body.text,
      symptoms: body.symptoms,
      age: body.age,
      allergies: body.allergies,
      currentMedicines: body.currentMedicines,
      pregnancy: body.pregnancy,
      vitals: body.vitals,
    });

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");

    if (result.emergencyDetected) {
      await logAuditEvent({
        actorId: session?.user?.id,
        actorRole: (session?.user as unknown as { role?: string })?.role || "anonymous",
        action: "triage_emergency_triggered",
        outcome: "success",
        ip: clientIp,
        metadata: {
          matchedRuleIds: result.matchedRuleIds,
          ruleSetVersion: result.ruleSetVersion,
        },
      });
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("[TRIAGE API ERROR]", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to evaluate triage rules.",
          safeAction: "If you feel this is an emergency, call 112 immediately.",
        },
      },
      { status: 500 }
    );
  }
}
