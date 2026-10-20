import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { createMfaVerificationToken, verifyMfaPasscode } from "@/lib/auth/mfa";
import { logAuditEvent } from "@/lib/audit/audit";
import { NON_PATIENT_ROLES } from "@/lib/auth/rbac";

const mfaVerifySchema = z.object({
  code: z.string().min(6).max(8),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
        { status: 401 }
      );
    }

    const role = (session.user as unknown as { role?: string })?.role;
    if (!role || !NON_PATIENT_ROLES.includes(role as any)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "MFA is only applicable to administrative roles." } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parseResult = mfaVerifySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: "Please provide a valid 6-digit MFA code." } },
        { status: 400 }
      );
    }

    const { code } = parseResult.data;
    const isValid = verifyMfaPasscode(code);

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");

    if (!isValid) {
      await logAuditEvent({
        actorId: session.user.id,
        actorRole: role,
        action: "mfa_verification_failed",
        outcome: "denied",
        ip: clientIp,
      });

      return NextResponse.json(
        { error: { code: "INVALID_MFA_CODE", message: "Invalid verification code. Please check your authenticator." } },
        { status: 400 }
      );
    }

    // Success: Generate verification token and set cookie
    const token = createMfaVerificationToken(session.user.id);

    await logAuditEvent({
      actorId: session.user.id,
      actorRole: role,
      action: "mfa_verification_success",
      outcome: "success",
      ip: clientIp,
    });

    const response = NextResponse.json({
      success: true,
      message: "Multi-Factor Authentication verified successfully.",
    });

    response.cookies.set({
      name: "clinix_mfa_verified",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/admin",
      sameSite: "strict",
      maxAge: 8 * 60 * 60, // 8 hours
    });

    return response;
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

    console.error("[MfaVerifyAPI] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to process MFA verification." } },
      { status: 500 }
    );
  }
}
