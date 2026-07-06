import type { NextAuthConfig } from "next-auth";
import LINE from "next-auth/providers/line";

// Lean subset of the auth config — no Prisma import here, since this is
// what src/proxy.ts uses just to check whether a session exists. DB-backed
// callbacks (signIn, jwt) live in src/auth.ts instead, which only runs in
// route handlers and server components.
export const authConfig = {
  providers: [
    LINE({
      clientId: process.env.LINE_LOGIN_CLIENT_ID,
      clientSecret: process.env.LINE_LOGIN_CLIENT_SECRET,
      // LINE's `email` scope requires separate approval in the console
      // (LINE Login tab -> OpenID Connect -> Email address permission).
      // We don't store email anywhere, so just drop it instead of waiting
      // on that approval — requesting it while unapproved makes LINE's
      // authorize endpoint hard-reject with a Bad Request page.
      authorization: { params: { scope: "openid profile" } },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
        session.user.role = token.role as "USER" | "ADMIN";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
