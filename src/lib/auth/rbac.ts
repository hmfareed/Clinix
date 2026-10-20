import { NextResponse } from "next/server";
import { auth } from "./auth";
import { UserRole } from "@/models/User";
import { isMfaVerifiedForUser } from "./mfa";

export const NON_PATIENT_ROLES: UserRole[] = [
  "support_admin",
  "clinical_reviewer",
  "system_admin",
  "auditor",
];

export interface RbacAuthSuccess {
  authorized: true;
  user: {
    id: string;
    email: string;
    name?: string;
    role: UserRole;
  };
}

export interface RbacAuthFailure {
  authorized: false;
  response: NextResponse;
}

export type RbacResult = RbacAuthSuccess | RbacAuthFailure;

export async function requireAdminAuth(
  allowedRoles: UserRole[] = NON_PATIENT_ROLES
): Promise<RbacResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Administrative authentication required.",
          },
        },
        { status: 401 }
      ),
    };
  }

  const role = (session.user as unknown as { role?: UserRole }).role || "patient";

  // 1. Role verification: Patients can never access admin resources
  if (role === "patient" || !allowedRoles.includes(role)) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: `Access denied. Your role '${role}' lacks authorization for this resource. Required roles: ${allowedRoles.join(", ")}.`,
          },
        },
        { status: 403 }
      ),
    };
  }

  // 2. Multi-Factor Authentication (MFA) requirement for non-patient roles
  // Allow bypassing MFA verification in test environments when explicitly flagged
  const isTestEnv = process.env.NODE_ENV === "test";
  const mfaValid = isTestEnv || (await isMfaVerifiedForUser(session.user.id));

  if (!mfaValid) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: {
            code: "MFA_REQUIRED",
            message: "Multi-Factor Authentication (MFA) verification required for non-patient roles.",
            redirectUrl: "/admin/mfa",
          },
        },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    user: {
      id: session.user.id,
      email: session.user.email || "",
      name: session.user.name || undefined,
      role,
    },
  };
}
