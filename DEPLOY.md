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

Docker must be installed and running on the server, and **port 3000 must be
free** — check with `sudo lsof -i :3000` (nothing should be listening).

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
| `GDS_GATEWAY_KEY` | a `gds_live_…` key from the gateway dashboard |
| `ALLOWED_MODELS` | must be a subset of that key's `model_whitelist` |

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

**Back up Postgres.** The database holds every account and conversation, and
lives in the `pgdata` volume. Nothing else does.

```bash
docker compose exec postgres pg_dump -U ner_ai ner_ai | gzip > nerkyot-$(date +%F).sql.gz
```

**Updating.**

```bash
git pull
docker compose up -d --build
docker compose exec ner-ai npx prisma migrate deploy   # only if migrations changed
```

Env-only change? `docker compose up -d --force-recreate` is enough — no rebuild.

**Never run `docker compose down -v`** unless you intend to erase the database.
