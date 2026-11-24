"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { Emblem } from "@/components/brand/emblem";
import { SettingsDialog } from "@/components/admin/settings-dialog";
import { SessionProvider } from "@/components/session";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL } from "@/lib/permissions";
import type { Session } from "@/lib/types";

export function Shell({ session, children }: { session: Session; children: React.ReactNode }) {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }

  return (
    <SessionProvider session={session}>
      <div className="flex h-screen min-h-0 flex-col bg-obsidian">
        <header className="shrink-0 border-b border-white/8 bg-ink/90">
          <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
            <Link href="/board" className="flex min-w-0 items-center gap-2.5">
              <Emblem className="h-8 w-8" />
              <span className="min-w-0">
                <span className="block font-display text-sm tracking-[0.22em] text-gold">BCSO</span>
                <span className="hidden text-[10px] uppercase tracking-[0.18em] text-fog sm:block">Investigation Portal</span>
              </span>
            </Link>
            <nav className="ml-3 hidden items-center sm:flex">
              <Link
                href="/board"
                className={`rounded-md px-3 py-1.5 text-sm ${pathname.startsWith("/board") || pathname.startsWith("/cases") ? "bg-panel text-foreground" : "text-fog hover:text-foreground"}`}
              >
                Case board
              </Link>
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden text-right sm:block">
                <div className="font-mono text-xs tracking-[0.14em] text-gold-bright">{session.badge}</div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-fog">{ROLE_LABEL[session.role]}</div>
              </div>
              <div className="font-mono text-xs tracking-[0.12em] text-gold-bright sm:hidden">{session.badge}</div>
              {session.role === "admin" ? (
                <Button variant="ghost" size="icon" aria-label="Portal settings" onClick={() => setSettingsOpen(true)}>
                  <Settings />
                </Button>
              ) : null}
              <Button variant="secondary" size="sm" onClick={signOut} disabled={signingOut}>
                <LogOut />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
        </header>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
      {session.role === "admin" ? <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} /> : null}
    </SessionProvider>
  );
}
