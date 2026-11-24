"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Emblem } from "@/components/brand/emblem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api } from "@/lib/client";
import type { Role } from "@/lib/types";

const DEFAULTS: { role: string; password: string }[] = [
  { role: "General Patrol", password: "patrol412" },
  { role: "Detective", password: "detective08" },
  { role: "Administration", password: "sheriff01" },
];

export function LoginScreen() {
  const [badge, setBadge] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      await api<{ badge: string; role: Role }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ badge, password }),
      });
      window.location.assign("/board");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Sign-in failed.");
      setPending(false);
    }
  }

  return (
    <main className="tactical-grid flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-[440px]">
        <div className="rounded-lg border border-gold/25 bg-ink/95 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
          <div className="h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
          <div className="px-8 pb-8 pt-9 text-center">
            <Emblem detailed className="mx-auto h-24 w-24" />
            <p className="mt-5 font-display text-[13px] tracking-[0.32em] text-gold">BLAINE COUNTY</p>
            <h1 className="mt-1 font-display text-3xl tracking-[0.08em] text-foreground">SHERIFF&apos;S OFFICE</h1>
            <p className="mt-2 text-sm text-fog">Investigation portal · case files and the investigation board</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4 px-8 pb-8">
            <div className="space-y-2 text-left">
              <Label htmlFor="badge">Badge number</Label>
              <Input
                id="badge"
                name="badge"
                autoComplete="username"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="412"
                value={badge}
                onChange={(event) => setBadge(event.target.value)}
                className="font-mono tracking-[0.12em]"
                required
              />
            </div>
            <div className="space-y-2 text-left">
              <Label htmlFor="password">Role password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pr-10 font-mono"
                  required
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-fog hover:text-foreground"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error ? (
              <p className="rounded-md border border-status-crimson/30 bg-status-crimson/10 px-3 py-2 text-left text-sm text-status-crimson" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="h-11 w-full tracking-wide" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {pending ? "Checking credentials" : "Sign in"}
            </Button>
          </form>
          <div className="border-t border-white/8 px-8 py-4 text-left">
            <details className="group">
              <summary className="cursor-pointer text-[11px] uppercase tracking-[0.16em] text-fog">
                Factory default passwords
              </summary>
              <p className="mt-2 text-xs leading-5 text-fog">
                Any badge number signs in. These passwords apply only until an administrator rotates them.
              </p>
              <ul className="mt-2 space-y-1 font-mono text-xs text-foreground">
                {DEFAULTS.map((item) => (
                  <li key={item.role} className="flex justify-between gap-3">
                    <span className="text-fog">{item.role}</span>
                    <span>{item.password}</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </div>
        <p className="mt-4 text-center text-[10px] uppercase tracking-[0.22em] text-fog/80">
          Law enforcement sensitive · Blaine County records
        </p>
      </div>
    </main>
  );
}
