# NerKyot

A ChatGPT/Claude-style chat app: accounts + private conversation history for
multiple people, all sharing one gateway connection. It's a Next.js frontend
over the [Tooken-Pool GDS AI Gateway](../Tooken-Pool) — it never talks to
OpenAI/Anthropic/etc. directly, only to the gateway's OpenAI-compatible
`/v1/chat/completions`.

**Closed by design — no public signup.** Accounts are created by whoever runs
this app, one at a time, via a CLI script (`npm run create-user`). There is no
`/signup` page and no public account-creation endpoint.

```
Browser
  → NerKyot (Next.js: accounts, conversation history, model picker)
    → Tooken-Pool gateway (gds_live_... key, held server-side only)
      → OpenAI / Anthropic / MiniMax / Codex / Claude OAuth
```

## Design

Five interchangeable looks, switchable at **Settings → Appearance** by any
signed-in user (it's a per-browser preference, stored in `localStorage`):

| Direction | Typography | Character |
|---|---|---|
| **Console** | IBM Plex Mono + Plex Sans | Terminal heritage, amber, 6px corners |
| **Reader** | Newsreader + Public Sans | Serif replies, forest green |
| **Precision** | Archivo + JetBrains Mono | Swiss, 2px corners, signal red |
| **Cushion** | Manrope | Soft, 18px corners, muted teal |
| **Familiar** | Inter | ChatGPT-style: white canvas, grey sidebar, 24px corners |

Each direction is a block of CSS variables in
[globals.css](src/app/globals.css) keyed on `[data-design="…"]`, covering
palette, three type roles (`--f-ui` chrome / `--f-body` messages / `--f-data`
figures) and `--radius`. Components never name a typeface — they use
`font-ui` / `font-body` / `font-data`, so a direction remaps all of them at
once. Two details worth knowing before editing:

- **Every direction needs its own `.dark[data-design="x"]` block.** `.dark` and
  `[data-design="x"]` have equal specificity, so without the combined selector
  a light palette wins in dark mode.
- **The choice is applied by a pre-paint script** in
  [layout.tsx](src/app/layout.tsx), otherwise the page flashes the default
  direction before hydration.

**Familiar** deliberately mimics ChatGPT. Inter stands in for OpenAI's Söhne /
OpenAI Sans, which are licensed and can't be self-hosted — same neo-grotesque
idea, and the closest free equivalent. Its `--chat-ai` equals `--background`
so replies read as plain text rather than bubbles, and `--border` sits a hair
off the background so the outline every bubble carries stays invisible.

All eight typefaces are self-hosted, but a browser only downloads the files it
actually renders — the inactive directions cost a few KB of CSS and nothing
more.

**Familiar is the default**, so it owns the bare `:root` / `.dark` blocks —
which double as the no-JS fallback. Those blocks must stay **first** in the
file: `:root` and `[data-design="x"]` have equal specificity, so a later
`:root` would override whichever direction the user actually picked. Model ids
show verbatim (`gpt-5.6-terra`) — the same
string you put in `ALLOWED_MODELS`. Chat surfaces have their own
`--chat-user` / `--chat-ai` / `--brand` tokens rather than reusing `--primary`,
so bubble styling and button styling move independently.

## Stack

- **Next.js 16** (App Router, TypeScript) + Tailwind + shadcn/ui (Base UI)
- **Vercel AI SDK** (`ai`, `@ai-sdk/react`, `@ai-sdk/openai-compatible`) for
  streaming chat against the gateway's OpenAI-compatible endpoint
- **Auth.js v5** (Credentials provider — email/password, bcrypt) for accounts
- **Prisma 7** + Postgres (own database, unrelated to the gateway's DB) for
  users/conversations/messages

## How it's wired to the gateway

- One (or a few) `gds_live_...` virtual key(s) live **only** in this app's
  server env (`GDS_GATEWAY_KEY`) — never sent to the browser. Every signed-in
  user's requests are proxied through it server-side
  ([src/app/api/chat/route.ts](src/app/api/chat/route.ts)).
- `ALLOWED_MODELS` must be a subset of that key's `model_whitelist` in the
  gateway's dashboard, or picking that model 403s.
- The gateway's own token budget / daily limit / rate limit apply across
  **all** of this app's users combined, since they share the key. Multi-tenant
  isolation happens at the NerKyot layer (accounts, private history) — not at
  the gateway layer.
- If you want per-user budgets instead, create a separate gateway key per
  user and extend the `User`/`Conversation` model to reference one — not
  implemented here.

## Local development

```bash
npm install

# Local Postgres without Docker (Prisma-managed):
npx prisma dev -d --name ner-ai   # prints a DATABASE_URL to use

cp .env.example .env              # fill in DATABASE_URL, AUTH_SECRET, GDS_GATEWAY_URL/KEY
npx prisma migrate dev            # creates the schema
npm run dev                       # http://localhost:3000
```

Without a real `GDS_GATEWAY_URL`/`GDS_GATEWAY_KEY`, everything works except
actual model replies (accounts, conversations, sidebar, rename/delete) — a
failed chat request surfaces as a toast instead of a crash.

## Signing out

Sign-out is a **form POST to `/logout`** ([route.ts](src/app/logout/route.ts)),
not a client-side `signOut()` call, and that is load-bearing.

Every server request that resolves the session re-issues the session cookie —
including each RSC payload Next prefetches for the sidebar's links. Clearing
the cookie from inside the running page is therefore a race it can lose:
sweeping the mouse toward the sign-out button prefetches conversations, and one
of those responses landing after the signout mints a fresh token from the copy
the browser still holds. The user is sent to `/login` believing they're out,
while their browser still holds a working session. That reproduced in roughly
3 of 4 desktop attempts.

Two things fix it, and both are needed:

- The form POST **navigates**, so the old document and its in-flight prefetches
  are gone before the cookie is cleared.
- The sidebar's conversation links set `prefetch={false}`, so hovering them on
  the way to the button no longer fires authenticated requests at all.

With both, 12 of 12 runs signed out cleanly, including a deliberate sweep
across every link first. Don't swap this back to `signOut()` in an onClick.

## Install it on a phone

There's no separate mobile app and no second codebase — this one installs to a
home screen. On iOS: Safari → Share → **Add to Home Screen**. On Android:
Chrome offers **Install app**. It then launches with its own icon, fullscreen,
with no browser chrome, and stays signed in.

Three details make that work, and they're easy to break:

- **`public/sw.js` caches nothing, deliberately.** It exists only because
  Chrome on Android won't offer to install a web app without a registered
  service worker that has a fetch handler — without it you get a bookmark, not
  an app. It intercepts navigations only and passes them straight through, so
  the streaming `/api/chat` response is untouched. Adding caching here would
  buy offline access at the price of serving a stale build after a deploy.
- **`body` carries `env(safe-area-inset-*)` padding** ([globals.css](src/app/globals.css)).
  Launched fullscreen there's no browser chrome keeping content clear of the
  notch and the home indicator. It resolves to `0px` in a normal tab, so it
  costs nothing there.
- **`theme-color` is synced at runtime**, not fixed in the manifest
  ([theme-color-sync.tsx](src/components/theme-color-sync.tsx)). The manifest
  allows one static colour, which would be wrong for nine of the ten
  combinations of five designs × light/dark.

Both `mobile-web-app-capable` (standardised, emitted by Next) and
`apple-mobile-web-app-capable` (legacy) are set — current iOS launches
standalone from the manifest's `display`, older versions only understand
Apple's original tag.

Icons are generated from IBM Plex Mono, the same face the Console direction
uses, so the home-screen icon matches the app it opens.

## Creating spreadsheets and documents

Ask for a spreadsheet or a document and you get a real file back — a genuine
`.xlsx` or `.docx`, not a markdown table. It arrives as a download chip in the
reply and keeps working when you reopen the conversation months later.

The model calls a tool ([ai-tools.ts](src/lib/ai-tools.ts)); the server builds
the file with `exceljs` / `docx` ([documents.ts](src/lib/documents.ts)) and
stores the bytes in Postgres. There's no object storage in this deployment, and
regenerating a file on demand would cost another model call and wouldn't be
byte-identical, so the bytes are kept.

Numbers go in as numbers, so Excel can total them — a spreadsheet full of
text-formatted figures is useless. Headers are bold and frozen, and columns are
sized to their contents.

Three things worth knowing before changing this:

- **`stopWhen: stepCountIs(2)`** in the chat route is a limit, not a default.
  One round of tool calls, then the model must write its reply. At four steps a
  single "put this in Excel" produced **four spreadsheets** — the model kept
  refining the filename and never got round to answering, leaving a reply that
  was nothing but download chips.
- **The route appends missing links on persist.** The model is asked to echo
  the link and normally does; without the fallback, a turn where it forgets
  leaves the bytes orphaned in the database with nothing pointing at them.
- **`/api/files/[id]` checks ownership**, not just the id. A cuid is
  unguessable but isn't authorisation — a link pasted into a group chat would
  otherwise hand over whatever the spreadsheet contains.

Editing an uploaded `.xlsx` isn't built yet. Editing a `.docx` while keeping
its formatting isn't realistically possible in JavaScript — `mammoth` only
reads — so that would mean regenerating the document and losing its styling.

## Scrolling during a reply

The transcript follows a streaming reply only while the reader is already at
the bottom. Scroll up and it stays put, with a **Jump to reply** button as the
way back; return to the bottom and following resumes on its own. Sending a
message always jumps to the bottom, since that's an explicit "show me the
newest".

Two details are load-bearing, both found by testing:

- **The auto-follow scroll is instant, not smooth.** An animated scroll keeps
  firing scroll events with positions near the bottom for as long as it runs,
  so "is the reader at the bottom?" reads true throughout — and it overrides
  the wheel mid-gesture. Streaming re-renders every few hundred milliseconds,
  so there was always an animation in flight to fight with.
- **An upward wheel or a touch drag stops following immediately**, rather than
  waiting to infer it from scroll position. Position alone is a value the next
  streamed chunk is about to overwrite.

## Message actions

Hovering a reply reveals **copy** and **regenerate** underneath it (both are
always visible on touch, where hover never fires). Copy yields the raw
markdown, so it pastes into an editor as source; code blocks get their own
copy button that yields just the code, without the fences. When a turn fails
outright there's no reply to hang an action off, so a **Try again** row
appears in its place — the error toast is gone by the time anyone reacts to it.

Regenerate is offered on the newest reply only: replacing an older one would
strand every turn recorded after it. The route detects the SDK's
`regenerate-message` trigger and deletes the superseded row, otherwise the
discarded answer reappears next to the new one on reload.

## Web search

The globe in the composer turns on **OpenAI's hosted web search** for that
message: OpenAI runs the search on their side and injects the results into the
prompt before the model answers, so there is no third-party search key, no
crawler and no extra container here. Answers come back citing their sources as
inline links (opened in a new tab).

It's **off by default and opt-in per message**, because searching roughly
doubles-to-triples the request: ~4.7k prompt tokens for an ordinary message on
`gpt-5.6-*` versus ~8–16k with search, all against the one shared gateway key.
Turning it on in the empty state carries into the conversation it creates (via
`?search=1`), so follow-ups keep searching until you switch it off.

Mechanically, the flag rides in as `web_search_options` on the request body,
merged by the fetch middleware in [gateway.ts](src/lib/gateway.ts) — *not* via
`providerOptions`, which the openai-compatible provider validates against a
fixed schema (`user`/`reasoningEffort`/`textVerbosity`/`strictJsonSchema`) and
silently strips unknown keys from.

## Settings

**`/settings`** is open to every signed-in user and holds the two personal
things: **your own token usage** (total, last 7 days, requests, chats, and a
breakdown by model) and **Appearance**. Admins additionally get a link through
to user management.

Usage is read per-user from `UsageEvent`, so someone only ever sees their own
figures — the shared-key totals for everyone stay in the admin view.

## Handing over a new account

An admin creates an account with a password they choose, so that password is
temporary by definition — the admin knows it. The holder is made to replace it
before they can use anything: their first sign-in lands on a prompt they can't
dismiss, where they set their own password and the name shown beside their
avatar. Their email stays as issued; it's the login identifier, so changing it
is an admin's job.

- The gate is a **server component in the root layout**
  ([account-setup-gate.tsx](src/components/account-setup-gate.tsx)) that reads
  `mustChangePassword` from the database on every render. Deciding this
  client-side would mean it could be skipped by editing state, and it would
  flash the app before hydration.
- It is **not** a Dialog: those close on Escape and on an outside click.
- **Reusing the issued password is refused** — accepting it would leave the
  admin knowing the password, which is the only thing this flow exists to stop.
- Existing accounts default to `false`, so nobody already using the app is
  prompted.
- The admin list marks accounts that haven't been claimed yet, since those are
  the ones you can still sign in as.

Verified end to end: prompt appears, blocks clicks to the app underneath,
survives Escape and a reload, refuses the issued password, applies the display
name, and the issued password stops working once replaced.

## Admin settings

Admins get a gear icon in the sidebar linking to **`/admin`**, where they can
add users, set anyone's password, promote/demote admins, delete accounts
(which also deletes that user's conversations), and see **tokens used per
user** plus a pool total.

Usage is recorded as one `UsageEvent` row per completed model call, attributed
to the user rather than the conversation — so someone deleting their chats
doesn't zero out (or hide) their consumption. Counts come from the provider's
reported usage via the AI SDK, so they reflect the same tokens the gateway
bills against the shared key.

Authorization is enforced server-side in every admin route via `getAdmin()`
([src/lib/admin.ts](src/lib/admin.ts)), which re-reads `isAdmin` from the
database rather than trusting the session JWT — otherwise a revoked admin
would keep their access until the token expired. Non-admins get a 404 on
`/admin` and a 403 from `/api/admin/*`. Admins can't delete or demote
themselves (that could leave the instance with no admin at all).

## Sessions

The login form's **"Keep me signed in"** controls how long a session lasts:
ticked (the default) gives 30 days, unticked gives 12 hours.

Auth.js takes `session.maxAge` from static config, so the cookie itself always
carries the 30-day lifetime and the short case can't be expressed there.
Instead the token records an absolute `expiresAt` at sign-in, and the `jwt`
callback in [src/auth.config.ts](src/auth.config.ts) returns `null` once that
passes — which drops the session even though the cookie is still in the
browser. The check runs in the proxy too, so an expired session can't reach a
protected page.

## Creating accounts

Admins can add users from `/admin`. To create the *first* admin — or to
recover if no admin is left — use the CLI:

```bash
npm run create-user -- someone@example.com "a-real-password" "Their Name"
```

(`"Their Name"` is optional.) Against the Docker deployment, run it inside the
container instead so it uses the right `DATABASE_URL`:

```bash
docker compose exec ner-ai npm run create-user -- someone@example.com "a-real-password"
```

Add `--admin` to make them an admin (see "Admin settings" above).

## Environment variables

See [.env.example](.env.example) for the full list with comments:

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (this app's own DB) |
| `AUTH_SECRET` | Session-signing secret — `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `GDS_GATEWAY_URL` | Base URL of your deployed Tooken-Pool gateway |
| `GDS_GATEWAY_KEY` | A `gds_live_...` key from the gateway's `/admin/keys` or dashboard, shared by all users |
| `ALLOWED_MODELS` | Comma-separated model ids offered in the UI — must be in that key's whitelist |

## Production (Docker)

Requires Docker Desktop (with the WSL2 backend on Windows) —
<https://www.docker.com/products/docker-desktop/>.

Uses a **separate env file**, `.env.docker`, from `.env` (used by
`npm run dev`) — the only real difference is `DATABASE_URL`: inside the
compose network Postgres is reached by its service name (`postgres`), not
`localhost`. Same convention as `.env.example`; copy it to `.env.docker` and
fill in the same values (`AUTH_SECRET`, `GDS_GATEWAY_URL`, `GDS_GATEWAY_KEY`,
`ALLOWED_MODELS`) but leave `DATABASE_URL` pointed at `postgres:5432` as shown
in the example.

```bash
docker compose up -d --build
docker compose exec ner-ai npx prisma migrate deploy   # same shape as Tooken-Pool's `alembic upgrade head`
```

`.env`/`.env.docker` are excluded from the build context (`.dockerignore`) so
neither the gateway key nor the auth secret ever end up baked into an image
layer — they only reach the container at *runtime* via `env_file`.

Front it with HTTPS (Caddy/nginx) the same way as the gateway; there's no
built-in TLS termination here either.

```bash
docker compose ps                    # service status
docker compose logs -f ner-ai
docker compose down                  # stop
docker compose down -v               # stop + wipe the Postgres volume
```

## Project layout

```
src/
  app/
    login/                    the only auth page — no signup
    chat/                     protected app shell (layout = sidebar, [id] = conversation)
    admin/                    admin-only settings (user management)
    api/
      auth/[...nextauth]/     Auth.js handlers
      conversations/          CRUD for the sidebar
      chat/                   streaming proxy to the gateway (the core route)
      admin/users/            admin-only user CRUD (403s for non-admins)
  lib/admin.ts                 getAdmin() — the server-side admin gate
  auth.config.ts               Edge-safe NextAuth config (used by proxy.ts)
  auth.ts                      full config incl. Credentials provider (Node-only: bcrypt+Prisma)
  proxy.ts                     route protection (Next's renamed "middleware" convention)
  lib/
    db.ts                      Prisma client (pg driver adapter)
    gateway.ts                 AI SDK provider pointed at the gateway (server-only — never import from a "use client" file)
    messages.ts                DB Message <-> AI SDK UIMessage conversion
  components/
    auth/, chat/                UI
prisma/schema.prisma            User / Conversation / Message / UsageEvent
scripts/create-user.ts          the only way to create an account (npm run create-user)
```

## Responsive layout

The `md` breakpoint (768px) is the switch. Above it, the sidebar is a fixed
256px column. Below it, that column is hidden and
[mobile-nav.tsx](src/components/chat/mobile-nav.tsx) renders a top bar whose
menu button opens the same `SidebarContent` in a drawer, closing itself
whenever a link inside is followed.

Three mobile-specific details worth knowing before changing this:

- **`h-dvh`, not `h-screen`** on `<body>` — a phone's address bar shrinks the
  viewport, and `100vh` pushes the composer below the fold.
- **The per-chat "…" menu is always visible below `md`.** It's hover-revealed
  on desktop, and hover doesn't exist on touch, so hiding it there would make
  rename and delete unreachable.
- **Inputs stay at 16px until `md`.** iOS zooms the page when a focused input
  is smaller than that.

## Document attachments

The composer also accepts **PDF, Word (.docx), Excel (.xlsx)** and plain-text
formats (csv, md, json, yaml, source code). Because the gateway's provider
adapters only understand text and images, a raw document forwarded as a file
part would reach the model as garbage — so documents are **extracted to text
server-side** (`src/lib/extract.ts` via `POST /api/extract`, using `unpdf`,
`mammoth` and `exceljs`) and sent as text. This mirrors what the gateway's own
playground and OpenClaw do.

The extracted text travels as a `data-doc` message part, so the bubble shows a
compact filename chip while the model receives the full contents (expanded via
`convertDataPart` in the chat route). Extraction is capped at 100k characters
per file (flagged as "truncated" when hit) and 15MB per upload. Legacy `.doc`
/`.xls` and unknown types are rejected with a readable message.

## Image attachments

The composer accepts images by paste, drag-and-drop, or the paperclip button
(`src/components/chat/composer.tsx`) — converted client-side to `data:` URLs
and sent as `FileUIPart`s, which `@ai-sdk/openai-compatible` serializes as
standard OpenAI `image_url` content blocks (matching what the gateway's
provider adapters already expect, so no gateway-side change was needed).
Attachments are persisted (`Message.attachments`, JSONB) so they survive
reopening a conversation, not just the live session. 8MB per-image cap,
client-side.

## Known follow-ups

Not implemented — flagging since they're natural next steps, not oversights:

- **Per-user gateway keys/budgets** (see "How it's wired to the gateway" above).
