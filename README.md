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

The **"Console"** direction: terminal heritage. IBM Plex Mono carries the
interface chrome (sidebar, headers, model ids, table labels, token counts)
while IBM Plex Sans sets message text so long answers stay readable. Amber is
the single accent, reserved for the send button, the user avatar and the admin
badge; corners stay at 6px so nothing reads soft. Model ids show verbatim
(`gpt-5.6-terra`) — the same string you put in `ALLOWED_MODELS`.

Both fonts are **self-hosted** via `@fontsource` (imported in
[src/app/layout.tsx](src/app/layout.tsx)) — no Google CDN request, and they
work offline in Docker. The whole palette lives in `:root` / `.dark` in
[src/app/globals.css](src/app/globals.css); chat surfaces have their own
`--chat-user` / `--chat-ai` / `--brand` tokens so bubble styling and button
styling can move independently.

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
