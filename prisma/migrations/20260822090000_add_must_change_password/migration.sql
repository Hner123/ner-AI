-- Accounts issued by an admin start with a temporary password the admin knows,
-- so the app forces the holder to set their own before it lets them in.
-- Existing accounts default to false: they chose their own passwords already.
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
