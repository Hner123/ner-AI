import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";

// Built from the Edge-safe config only (no Credentials/Prisma/bcrypt) so this
// proxy can run on the Edge runtime — it only needs to read the JWT session,
// never touch the database.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  // Signed-in check only. Admin-specific authorization happens in the route /
  // page itself via getAdmin(), which re-reads the flag from the database.
  matcher: [
    "/chat/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/api/chat/:path*",
    "/api/conversations/:path*",
    "/api/admin/:path*",
    "/api/extract/:path*",
  ],
};
