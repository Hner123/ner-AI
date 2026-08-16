/**
 * Create a login for someone — the only way to get an account, since there's
 * no public signup. Run locally (uses .env) or inside the container:
 *
 *   npm run create-user -- someone@example.com "a-real-password" "Their Name"
 *   npm run create-user -- boss@example.com "a-real-password" "Boss" --admin
 *   docker compose exec ner-ai npm run create-user -- someone@example.com "a-real-password"
 *
 * NOTE: --admin only sets the User.isAdmin flag. Nothing in the app reads it
 * yet (there is no admin UI or elevated permission), so today it's purely a
 * marker for future use.
 */
import "dotenv/config"; // no-ops if .env is absent (e.g. inside Docker, where env vars are already injected)
import bcrypt from "bcryptjs";

import { prisma } from "../src/lib/db";

async function main() {
  const args = process.argv.slice(2);
  const isAdmin = args.includes("--admin");
  const [emailArg, password, ...nameParts] = args.filter((a) => a !== "--admin");
  const name = nameParts.join(" ").trim() || undefined;

  if (!emailArg || !password) {
    console.error('Usage: npm run create-user -- <email> <password> ["name"] [--admin]');
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exitCode = 1;
    return;
  }

  const email = emailArg.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`A user with email ${email} already exists.`);
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { email, name, passwordHash, isAdmin } });

  console.log(`Created user ${user.email} (id: ${user.id}, isAdmin: ${user.isAdmin}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
