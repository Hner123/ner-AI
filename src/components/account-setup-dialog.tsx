"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Shown to someone whose account was created for them, over everything else,
 * until they pick their own password.
 *
 * Not a Dialog component: those close on Escape and on an outside click, and
 * this one deliberately has no way out. It's rendered server-side only when the
 * account is actually flagged, so it can't be dismissed by fiddling with client
 * state either.
 */
export function AccountSetupDialog({
  email,
  initialName,
}: {
  email: string;
  initialName: string;
}) {
  const [name, setName] = useState(initialName);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && password !== confirm;
  const ready = password.length >= 8 && password === confirm && name.trim().length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/account/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not save that");
        return;
      }
      // A full reload, not router.refresh(): the whole app is rendered behind
      // this and should come back without the account flagged.
      window.location.reload();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-background/95 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="bg-card w-full max-w-md space-y-5 rounded-lg border p-6 shadow-lg"
      >
        <div className="space-y-1.5">
          <h1 className="font-ui text-lg font-medium">Set up your account</h1>
          <p className="text-muted-foreground text-sm">
            This account was created for you, so the password you signed in with is known
            to whoever set it up. Choose your own to continue.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="font-ui text-xs">Signing in as</Label>
          <p className="bg-muted text-muted-foreground font-data rounded-md border px-3 py-2 text-sm">
            {email}
          </p>
          <p className="text-muted-foreground text-xs">
            Ask an admin if this needs changing.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="setup-name" className="font-ui text-xs">
            Display name
          </Label>
          <Input
            id="setup-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="How your name should appear"
            autoComplete="name"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="setup-password" className="font-ui text-xs">
            New password
          </Label>
          <Input
            id="setup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
          />
          {tooShort && <p className="text-destructive text-xs">At least 8 characters.</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="setup-confirm" className="font-ui text-xs">
            Confirm password
          </Label>
          <Input
            id="setup-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
          {mismatch && <p className="text-destructive text-xs">These don&apos;t match.</p>}
        </div>

        <Button type="submit" disabled={!ready || saving} className="w-full">
          {saving ? "Saving…" : "Save and continue"}
        </Button>
      </form>
    </div>
  );
}
