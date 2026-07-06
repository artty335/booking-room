import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  // Page routes only. Excludes:
  // - api: handles its own 401s so client fetch() gets JSON, not an HTML redirect
  // - _next static/image internals
  // - static assets in public/ (images, icons) — otherwise the auth guard
  //   redirects e.g. /205.png to /login and the image renders broken, even on
  //   the public login page.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
