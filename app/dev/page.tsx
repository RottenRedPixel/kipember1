"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

const WORKFLOWS = [
  { label: "First Ember Flow", href: "/signup", desc: "Memory view with photo upload zone — no image yet" },
  { label: "Owner Add Flow", href: "/home?ember=owner-add", desc: "Owner adding content — voice, photo, note" },
  { label: "Contributor Add Flow", href: "/home?ember=contrib-add", desc: "Contributor sharing a memory" },
  { label: "Owner Add More Flow", href: "/home?ember=owner-add-more", desc: "Owner adding more content to a memory" },
  { label: "Contributor Add More Flow", href: "/home?ember=contrib-add-more", desc: "Contributor adding more to a memory" },
  { label: "Recording Flow", href: "/home?ember=recording", desc: "Mic controls, live waveform, transcript", soon: true },
  { label: "Invite Flow", href: "/home?ember=invite", desc: "Share invite link, contacts picker", soon: true },
  { label: "Story Circle Flow", href: "/home?ember=story-circle", desc: "Group conversation UI", soon: true },
  { label: "Review Flow", href: "/home?ember=review", desc: "Review/approve a contribution", soon: true },
];

const MODALS = [
  { label: "User Modal", href: "/home?m=user" },
  { label: "Share Modal", href: "/home?m=share" },
  { label: "Tend Modal", href: "/home?m=tend" },
  { label: "Play Overlay", href: "/home?m=play" },
];

const SCREENS = [
  { label: "Landing Page", href: "/" },
  { label: "Sign Up", href: "/signup" },
  { label: "Sign In", href: "/signin" },
  { label: "Memory View", href: "/home" },
];

export default function DevLauncher() {
  return (
    <div className="fixed inset-0 bg-neutral-950 text-white overflow-y-auto">
      <div className="max-w-md mx-auto px-5 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/home"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            <ChevronLeft size={22} color="#fff" strokeWidth={1.8} />
          </Link>
          <h1 className="text-xl font-bold">Dev Launcher</h1>
          <span className="text-xs text-white/30 ml-auto">delete after wiring</span>
        </div>

        {/* Workflows */}
        <Section title="Ember Chat Workflows">
          {WORKFLOWS.map((w) => (
            <LaunchLink key={w.href} href={w.href} label={w.label} desc={w.desc} soon={w.soon} />
          ))}
        </Section>

        {/* Screens */}
        <Section title="Screens">
          {SCREENS.map((s) => (
            <LaunchLink key={s.href} href={s.href} label={s.label} />
          ))}
        </Section>

        {/* Modals */}
        <Section title="Modals">
          {MODALS.map((m) => (
            <LaunchLink key={m.href} href={m.href} label={m.label} />
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function LaunchLink({ href, label, desc, soon }: { href: string; label: string; desc?: string; soon?: boolean }) {
  if (soon) {
    return (
      <div
        className="flex items-center justify-between px-4 py-3 rounded-xl"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div>
          <span className="text-sm font-medium text-white/30">{label}</span>
          {desc && <p className="text-xs text-white/15 mt-0.5">{desc}</p>}
        </div>
        <span className="text-[10px] uppercase tracking-wider text-white/20 font-semibold">soon</span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors"
      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div>
        <span className="text-sm font-medium text-white">{label}</span>
        {desc && <p className="text-xs text-white/40 mt-0.5">{desc}</p>}
      </div>
      <ChevronLeft size={16} color="rgba(255,255,255,0.3)" strokeWidth={1.8} className="rotate-180" />
    </Link>
  );
}
