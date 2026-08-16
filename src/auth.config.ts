import type { NextAuthConfig } from "next-auth";

// Edge-safe config shared by src/auth.ts (full config, Node runtime) and
// src/middleware.ts (Edge runtime). Keep this free of Node-only deps
// (Prisma, bcrypt) — the Credentials provider that needs them lives only in
// src/auth.ts, never here, so middleware's session check never pulls them in.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // In production Auth.js validates the incoming Host header against a
  // known canonical URL and rejects anything else (UntrustedHost) — fine
  // behind a single fixed domain, but this app is meant to run behind
  // whatever host/proxy it's deployed at (Docker on localhost today, a real
  // domain via Caddy/nginx later) without hardcoding one. No per-tenant
  // host-based security depends on this app, so trusting the host is safe.
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.isAdmin = user.isAdmin ?? false;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      // Display-only (e.g. whether to show the Admin nav link). Authorization
      // is never decided from this: the JWT is minted at login and would keep
      // asserting isAdmin after the flag is revoked, so server-side admin
      // checks re-read the flag from the database — see src/lib/admin.ts.
      session.user.isAdmin = token.isAdmin ?? false;
      return session;
    },
  },
};
