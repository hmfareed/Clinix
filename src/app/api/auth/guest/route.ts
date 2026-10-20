import { NextRequest, NextResponse } from "next/server";
import {
  createGuestSession,
  getGuestTokenFromCookies,
  getGuestSessionByToken,
  revokeGuestSession,
  GUEST_COOKIE_NAME,
  GUEST_TTL_HOURS,
} from "@/lib/auth/guest-session";
import { logAuditEvent } from "@/lib/audit/audit";

export async function POST(req: NextRequest) {
  try {
    const { session, rawToken } = await createGuestSession();
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");

    await logAuditEvent({
      action: "guest_session_created",
      resourceType: "assessmentSession",
      resourceId: String(session._id),
      outcome: "success",
      ip: clientIp,
    });

    const response = NextResponse.json({
      success: true,
      sessionId: String(session._id),
      ownerType: "guest",
      status: session.status,
      expiresAt: session.expiresAt,
    });

    // Set secure, httpOnly cookie for 24 hours
    response.cookies.set({
      name: GUEST_COOKIE_NAME,
      value: rawToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: GUEST_TTL_HOURS * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[GUEST SESSION CREATE ERROR]", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to initialize guest triage session.",
        },
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const rawToken = await getGuestTokenFromCookies();
    if (!rawToken) {
      return NextResponse.json({ active: false, session: null });
    }

    const session = await getGuestSessionByToken(rawToken);
    if (!session) {
      return NextResponse.json({ active: false, session: null });
    }

    return NextResponse.json({
      active: true,
      session: {
        id: String(session._id),
        ownerType: session.ownerType,
        status: session.status,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
      },
    });
  } catch (error) {
    console.error("[GUEST SESSION GET ERROR]", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to read guest session." } },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const rawToken = await getGuestTokenFromCookies();
    if (rawToken) {
      await revokeGuestSession(rawToken);
    }

    const response = NextResponse.json({ success: true, message: "Guest session ended." });
    response.cookies.delete(GUEST_COOKIE_NAME);
    return response;
  } catch (error) {
    console.error("[GUEST SESSION DELETE ERROR]", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to end guest session." } },
      { status: 500 }
    );
  }
}
