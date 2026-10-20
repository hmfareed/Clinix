import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Consent from "@/models/Consent";
import { consentRecordSchema } from "@/lib/validation/consent";
import { getGuestTokenFromCookies, hashGuestToken } from "@/lib/auth/guest-session";
import { logAuditEvent } from "@/lib/audit/audit";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const parsed = consentRecordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid consent payload.",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { type, policyVersion, status, scope } = parsed.data;
    await connectToDatabase();

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    let consent;

    if (session?.user?.id) {
      consent = await Consent.create({
        userId: session.user.id,
        type,
        policyVersion,
        status,
        scope,
        grantedAt: new Date(),
      });

      await logAuditEvent({
        actorId: session.user.id,
        actorRole: (session.user as unknown as { role?: string }).role || "patient",
        action: `consent_${status}`,
        resourceType: "consent",
        resourceId: String(consent._id),
        outcome: "success",
        ip: clientIp,
        metadata: { type, policyVersion },
      });
    } else {
      // Handle guest consent bound to guest session cookie
      const guestToken = await getGuestTokenFromCookies();
      const guestTokenHash = guestToken ? hashGuestToken(guestToken) : undefined;

      consent = await Consent.create({
        guestTokenHash,
        type,
        policyVersion,
        status,
        scope,
        grantedAt: new Date(),
      });

      await logAuditEvent({
        action: `guest_consent_${status}`,
        resourceType: "consent",
        resourceId: String(consent._id),
        outcome: "success",
        ip: clientIp,
        metadata: { type, policyVersion },
      });
    }

    return NextResponse.json({
      success: true,
      consent: {
        id: String(consent._id),
        type: consent.type,
        policyVersion: consent.policyVersion,
        status: consent.status,
        grantedAt: consent.grantedAt,
      },
    });
  } catch (error) {
    console.error("[CONSENT API ERROR]", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to record consent." } },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    await connectToDatabase();

    if (session?.user?.id) {
      const consents = await Consent.find({ userId: session.user.id }).sort({ grantedAt: -1 });
      return NextResponse.json({ consents });
    }

    const guestToken = await getGuestTokenFromCookies();
    if (guestToken) {
      const guestTokenHash = hashGuestToken(guestToken);
      const consents = await Consent.find({ guestTokenHash }).sort({ grantedAt: -1 });
      return NextResponse.json({ consents });
    }

    return NextResponse.json({ consents: [] });
  } catch (error) {
    console.error("[CONSENT GET ERROR]", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to retrieve consent records." } },
      { status: 500 }
    );
  }
}
