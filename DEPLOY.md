# Deploying NerKyot to chat.heineraboka.site

Everything runs in Docker behind Caddy, the same shape as the gateway.

---

## 1. DNS

Point the name at the server, then confirm it resolves before touching Caddy —
Caddy can't issue a certificate for a name that doesn't reach it.

```
A    chat.heineraboka.site    <server IP>
```

```bash
dig +short chat.heineraboka.site   # should print the server IP
```

## 2. Get the code onto the server

```bash
git clone https://github.com/Hner123/ner-AI && cd ner-AI
```

Docker must be installed and running on the server. The app publishes port
3000 on loopback by default — check whether that's free:

```bash
sudo ss -lptn 'sport = :3000'
```

If something already has it, pick another host port (the app still listens on
3000 *inside* the container — only the host side moves):

```bash
echo "APP_PORT=3080" > .env
```

That file is read by Docker Compose itself, which is why this one value lives
in `.env` rather than `.env.docker`. Whatever you choose has to match the port
in your Caddy block.

## 3. Configure

```bash
cp .env.docker.example .env.docker
nano .env.docker
```

Fill in, in this order:

Generate the two secrets first (`openssl` is on every server; Node isn't,
since everything here runs in containers):

```bash
echo "AUTH_SECRET=$(openssl rand -base64 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
```

`openssl rand -hex` for the database password on purpose: that value also goes
*inside* `DATABASE_URL`, and base64 can emit `/` `+` `=`, which would break the
URL and produce a confusing authentication failure.

| Value | Notes |
|---|---|
| `POSTGRES_PASSWORD` | paste the **same** value into `DATABASE_URL` too |
| `AUTH_SECRET` | **generate a fresh one** — never reuse the development value |
| `AUTH_URL` | your public `https://…` address, no trailing slash (see below) |
| `GDS_GATEWAY_KEY` | a `gds_live_…` key from the gateway dashboard |
| `ALLOWED_MODELS` | must be a subset of that key's `model_whitelist` |

`AUTH_URL` matters because the container never sees your domain — Caddy
forwards it a request for `localhost:3000`. Without it, Auth.js builds
absolute URLs against that, and anything it redirects lands the browser on
`https://localhost:3000`, which is nothing at all on a phone. Check it with:

```bash
curl -s https://your-domain/api/auth/csrf -c /tmp/j >/dev/null && \
curl -s -b /tmp/j -X POST https://your-domain/api/auth/signout \
  -H 'X-Auth-Return-Redirect: 1' \
  --data-urlencode "csrfToken=$(curl -s -b /tmp/j https://your-domain/api/auth/csrf | sed -E 's/.*"csrfToken":"([^"]+)".*/\1/')" \
  --data-urlencode 'callbackUrl=/login'
```

It should print your own domain. If it prints `localhost:3000`, `AUTH_URL`
isn't reaching the container — check it's in `.env.docker` and that you
recreated the container (`docker compose up -d`), not just restarted it.

## 4. Start it

```bash
docker compose up -d --build
docker compose exec ner-ai npx prisma migrate deploy
```

## 5. Put Caddy in front

Add the block from [Caddyfile.example](Caddyfile.example) to your Caddyfile,
then reload. **`flush_interval -1` is required** — without it Caddy buffers the
response and streamed replies arrive all at once, seconds late, looking like
the app has frozen. (Same setting the gateway needs, same reason.)

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy          # or: docker compose exec caddy caddy reload ...
```

## 6. Create your account

There is no signup page — accounts only exist because an admin makes them.

```bash
docker compose exec ner-ai npm run create-user -- you@gds.ph "a-strong-password" "Your Name" --admin
```

Then sign in at <https://chat.heineraboka.site> and add everyone else from
**Settings** (the gear in the sidebar).

## 7. Check it actually works

```bash
curl -I https://chat.heineraboka.site/login     # 200, and https
docker compose logs -f ner-ai
```

In the browser: sign in, send a message, and confirm the reply **streams in
word by word**. If it appears all at once after a pause, `flush_interval -1`
isn't applied.

---

## Before you share the link

- [ ] `AUTH_SECRET` is new, not the development value.
- [ ] `POSTGRES_PASSWORD` is long and random, and matches inside `DATABASE_URL`.
- [ ] No account is still using a password that was typed into a chat window or
      a shared doc — including the first admin. Change it from Settings.
- [ ] `docker compose ps` shows port `127.0.0.1:3000`, **not** `0.0.0.0:3000`.
      If it's on `0.0.0.0`, the app is reachable over plain HTTP on the
      server's IP, bypassing TLS entirely.
- [ ] `.env.docker` is not in git (`git check-ignore .env.docker` prints it).

## Ongoing

**Everyone shares one gateway key.** Its token budget, daily cap and rate
limit apply to all users combined — one person can exhaust the quota for
everyone. Settings shows tokens per user so you can see who's consuming what.
Anyone with an account can spend from that budget, so only create accounts for
people you'd hand the key to.

**Backups run themselves.** The database holds every account and conversation
and lives in the `pgdata` volume — nothing else does. The `backup` service in
the compose stack dumps it every 24h into `./backups/` and prunes anything
older than 7 days. It takes one immediately on startup (so a broken setup
shows up at deploy time, not at 3am), skips that if a dump under an hour old
already exists, and retries in 15 minutes rather than a full day if an attempt
fails. Tune with `BACKUP_KEEP_DAYS`, `BACKUP_INTERVAL_SECONDS` and
`BACKUP_RETRY_SECONDS` in `.env.docker`.

Check on it:

```bash
docker compose logs backup | tail    # what it's been doing
ls -lh backups/                      # what it has
```

**Copy them off the server.** A backup that only exists on the machine it's
protecting is not a backup — if that disk dies, both go together. Pull them
down periodically:

```bash
scp 'you@your-server:~/ner-AI/backups/*.sql.gz' ./
```

Dumps contain every message and every password hash, so keep them somewhere
you'd be comfortable keeping the database itself. `./backups/` is gitignored.

**Restore.** Verify a backup restores *before* you need it — into a scratch
database, so the live one is untouched:

```bash
docker compose exec postgres createdb -U ner_ai restore_test
gunzip -c backups/nerkyot-YYYYMMDD-HHMMSS.sql.gz | docker compose exec -T postgres psql -U ner_ai -d restore_test
docker compose exec postgres psql -U ner_ai -d restore_test -c 'SELECT count(*) FROM "Message";'
docker compose exec postgres dropdb -U ner_ai restore_test
```

To restore for real, over the live database:

```bash
docker compose stop ner-ai                                   # stop writes first
docker compose exec postgres dropdb -U ner_ai ner_ai
docker compose exec postgres createdb -U ner_ai ner_ai
gunzip -c backups/nerkyot-YYYYMMDD-HHMMSS.sql.gz | docker compose exec -T postgres psql -U ner_ai -d ner_ai
docker compose start ner-ai
```

**Updating.**

```bash
git pull
docker compose up -d --build
docker compose exec ner-ai npx prisma migrate deploy   # only if migrations changed
```

Env-only change? `docker compose up -d --force-recreate` is enough — no rebuild.

**Never run `docker compose down -v`** unless you intend to erase the database.
