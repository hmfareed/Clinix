import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { connectToDatabase } from "@/lib/db/mongodb";
import User, { UserRole, UserStatus } from "@/models/User";
import { verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/validation/auth";
import { logAuditEvent } from "@/lib/audit/audit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        await connectToDatabase();
        const user = await User.findOne({ email }).select("+passwordHash");

        if (!user || !user.passwordHash) {
          await logAuditEvent({
            action: "auth_login_failed",
            outcome: "denied",
            metadata: { reason: "User not found or no password" },
          });
          return null;
        }

        if (user.status !== "active") {
          await logAuditEvent({
            actorId: String(user._id),
            actorRole: user.role,
            action: "auth_login_blocked",
            outcome: "denied",
            metadata: { status: user.status },
          });
          return null;
        }

        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
          await logAuditEvent({
            actorId: String(user._id),
            actorRole: user.role,
            action: "auth_login_failed",
            outcome: "denied",
            metadata: { reason: "Invalid password" },
          });
          return null;
        }

        await logAuditEvent({
          actorId: String(user._id),
          actorRole: user.role,
          action: "auth_login_success",
          outcome: "success",
        });

        return {
          id: String(user._id),
          email: user.email,
          name: user.name || user.email.split("@")[0],
          role: user.role,
          status: user.status,
          emailVerified: user.emailVerified,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as unknown as { role: UserRole }).role;
        token.status = (user as unknown as { status: UserStatus }).status;
        token.emailVerified = (user as unknown as { emailVerified: Date | null }).emailVerified;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        (session.user as unknown as { role: UserRole }).role = token.role as UserRole;
        (session.user as unknown as { status: UserStatus }).status = token.status as UserStatus;
        (session.user as unknown as { emailVerified: Date | null }).emailVerified =
          token.emailVerified as Date | null;
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
});
