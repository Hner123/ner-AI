import { redirect } from "next/navigation";

import { signOut } from "@/auth";

/**
 * Signing out happens here, on the server, reached by a form POST — not via
 * next-auth/react in the page.
 *
 * Every server request that resolves the session (any `auth()` call, which
 * includes each RSC payload Next prefetches for the sidebar's links) re-issues
 * the session cookie. Clearing it from inside the running app is therefore a
 * race: moving the mouse toward the sign-out button prefetches conversations,
 * and any of those responses landing after the signout mints a fresh token
 * from the copy the browser still holds, leaving the user quietly signed in.
 * That reproduced roughly three times in four on a desktop viewport.
 *
 * A form POST navigates, so the old document — and every prefetch it had in
 * flight — is gone before this handler runs. Nothing is left to re-mint.
 *
 * POST rather than GET so a stray <img src="/logout"> can't sign people out.
 */
export async function POST() {
  await signOut({ redirect: false });
  // Relative, so it lands on whatever host the user is actually on. An
  // absolute one would come from AUTH_URL and point at the container itself
  // when that isn't set.
  redirect("/login");
}
