import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getGuestTokenFromCookies, hashGuestToken } from "@/lib/auth/guest-session";
import { AssistantAuthContext } from "@/services/clinix-assistant-service";

export async function resolveAssistantAuth(
  req?: NextRequest
): Promise<AssistantAuthContext & { isAuthenticated: boolean }> {
  try {
    const session = await auth();
    if (session?.user?.id) {
      return {
        userId: session.user.id,
        isAuthenticated: true,
      };
    }
  } catch {
    // If session resolution fails, fallback to guest token
  }

  // 1. Try cookie
  let rawToken = await getGuestTokenFromCookies();

  // 2. Fallback to header if present
  if (!rawToken && req) {
    rawToken = req.headers.get("x-guest-token") || req.headers.get("X-Guest-Token") || null;
  }

  if (rawToken) {
    const guestTokenHash = hashGuestToken(rawToken);
    return {
      guestTokenHash,
      isAuthenticated: false,
    };
  }

  return {
    isAuthenticated: false,
  };
}
