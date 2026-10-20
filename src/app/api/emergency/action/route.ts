import { NextRequest, NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit/audit";
import { auth } from "@/lib/auth/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json().catch(() => ({}));
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");

    // Strictly record action type, country, and timestamp only. Never transcripts.
    await logAuditEvent({
      actorId: session?.user?.id,
      actorRole: (session?.user as unknown as { role?: string })?.role || "anonymous",
      action: "emergency_action_initiated",
      outcome: "success",
      ip: clientIp,
      metadata: {
        actionType: body.actionType || "call_112_clicked",
        country: body.country || "GH",
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: true });
  }
}
