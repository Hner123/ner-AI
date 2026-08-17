# The Android app

NerKyot on Android is a **Trusted Web Activity**: a real installable app that
renders `chat.heineraboka.site` through Chrome, full screen, with its own
launcher icon and its own place in the app switcher. There is no second
codebase — the app is a shell around the site you already deploy, so **shipping
a change to the server ships it to the app**. No rebuild, no store review.

It's built on GitHub's machines rather than locally, because an Android SDK
plus Gradle caches runs 6–8GB and the deployment machine hasn't got it spare.

## Building it

1. Go to **Actions → Build Android app → Run workflow** on GitHub.
2. Wait ~5 minutes.
3. Download the **`nerkyot-android`** artifact. It contains:
   - `app-release-signed.apk` — install this on a phone
   - `app-release-bundle.aab` — only needed for the Play Store

To install: put the APK on the phone (send it, or open the artifact link on the
device), tap it, and allow installing from this source when prompted.

## First build: keep the signing key

The first run has no signing key, so it generates one and uploads it as a
second artifact named **`SIGNING-KEY-store-this-somewhere-safe`** (kept for one
day only).

Download it and **store it somewhere you won't lose it**. Android refuses to
update an app signed with a different key, so a lost key means everyone has to
uninstall and reinstall — and if the app ever reaches the Play Store, a lost
key means the listing can never be updated again.

Then add it to the repository so later builds reuse it — *Settings → Secrets and
variables → Actions*:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the contents of `android.keystore.base64` |
| `ANDROID_KEYSTORE_PASSWORD` | your own password, if you'd rather not use the default |

Set the password secret **before** the first build if you want one — changing it
later means a new key, and a new key means a reinstall.

## Removing the URL bar

Until the site vouches for the app, Chrome keeps a URL bar pinned above it. To
remove it, tell the site which app to trust.

The build prints the certificate fingerprint in its summary. Put it on the
server in `.env.docker`:

```bash
ANDROID_PACKAGE_NAME=site.heineraboka.chat
ANDROID_CERT_FINGERPRINT="the fingerprint from the build summary"
```

Then `docker compose up -d --build`, and check it's live:

```bash
curl https://chat.heineraboka.site/.well-known/assetlinks.json
```

It should list your package name and fingerprint. Reinstall the app (Chrome
caches the check per install) and the URL bar is gone.

## Releasing an update

Only needed when the *shell* changes — a new icon, name, or colour. Ordinary
app changes ship with the server.

Run the workflow again with a higher **versionCode** (an integer that must
increase every time) and a **versionName** for people to read. Distribute the
new APK; phones will install it over the old one, since it's the same key.

## Notes

- **The app needs the server.** It renders the live site, so it doesn't work
  offline — the same as the browser.
- **It has its own cookie jar.** Signing in on the phone's Chrome doesn't sign
  you in inside the app; you log in once there and it sticks.
- **`minSdkVersion` is 23** (Android 6.0, 2015). Older phones can't install it.
- **iOS can't do this.** Apple has no equivalent, so iPhone users install the
  web app from Safari instead — see the README.
