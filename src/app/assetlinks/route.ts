import { NextResponse } from "next/server";

/**
 * Digital Asset Links — served at /.well-known/assetlinks.json via a rewrite
 * in next.config.ts (a literal `.well-known` directory in app/ is not routable).
 *
 * This is what proves the Android app and this website are the same product.
 * Chrome fetches it when the app launches: if the app's signing certificate is
 * listed here, the app runs full screen. If it isn't, everything still works
 * but Chrome keeps a URL bar pinned to the top, which rather gives the game
 * away.
 *
 * Both values come from the signing key the APK was built with — see
 * ANDROID.md. Nothing here is secret: the fingerprint is a public hash of the
 * certificate, and it is meant to be published.
 */
export function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME;
  const fingerprint = process.env.ANDROID_CERT_FINGERPRINT;

  if (!packageName || !fingerprint) {
    // Deliberately empty rather than absent: Chrome treats a malformed file as
    // a failed check, and an empty list says "no app is associated yet", which
    // is exactly true before the first APK is signed.
    return NextResponse.json([], {
      headers: { "content-type": "application/json" },
    });
  }

  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: packageName,
          // Accepts several, comma-separated: a release key and Play's own
          // upload key have different fingerprints, and both must be listed
          // if the app is ever distributed through the Play Store.
          sha256_cert_fingerprints: fingerprint
            .split(",")
            .map((f) => f.trim().toUpperCase())
            .filter(Boolean),
        },
      },
    ],
    { headers: { "content-type": "application/json" } },
  );
}
