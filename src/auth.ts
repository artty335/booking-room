import NextAuth from "next-auth";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, profile }) {
      if (!profile?.sub) return false;
      await prisma.user.upsert({
        where: { lineUserId: profile.sub },
        update: {
          displayName: user.name ?? "LINE user",
          pictureUrl: user.image,
        },
        create: {
          lineUserId: profile.sub,
          displayName: user.name ?? "LINE user",
          pictureUrl: user.image,
        },
      });
      return true;
    },
    // Role is only refreshed on sign-in (JWT is stateless), so a role
    // promotion in the DB needs the user to log out/in to take effect.
    async jwt({ token, profile }) {
      if (profile?.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { lineUserId: profile.sub },
        });
        if (dbUser) {
          token.userId = dbUser.id;
          token.role = dbUser.role;
        }
      }
      return token;
    },
  },
});
