"use client";

import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Home, Share2, Scissors, Leaf, Play, Flame,
  Link2, MessageCircle, Mail, MoreHorizontal, X, ChevronDown, Sun, Moon, ChevronLeft,
} from "lucide-react";
import { TEND_ACTIONS } from "../tend/constants";
import WelcomeFlow from "./workflows/WelcomeFlow";
import OwnerAddFlow from "./workflows/OwnerAddFlow";
import ContributorAddFlow from "./workflows/ContributorAddFlow";
import OwnerAddMoreFlow from "./workflows/OwnerAddMoreFlow";
import ContributorAddMoreFlow from "./workflows/ContributorAddMoreFlow";

const TEST_IMAGE = "https://assets.dream.clubmed/pm_7531_679_679465-3wtke3lvb0-swhr.jpg";

const FacebookIcon = () => (
  <svg width={26} height={26} viewBox="0 0 24 24" fill="white">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const XIcon = () => (
  <svg width={26} height={26} viewBox="0 0 24 24" fill="white">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center pb-24">
      <Link href="/home" className="absolute inset-0" />
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
        style={{ background: "rgba(0,0,0,0.75)", WebkitBackdropFilter: "blur(5px)", backdropFilter: "blur(5px)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <Link href="/home" className="absolute top-3 right-3 text-white/50 z-10 w-8 h-8 flex items-center justify-center">
          <X size={18} />
        </Link>
        {children}
      </div>
    </div>
  );
}

function GridItem({ icon: Icon, label }: { icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }> | (() => React.JSX.Element); label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 cursor-pointer can-hover">
      <div className="w-11 h-11 flex items-center justify-center">
        <Icon size={26} color="white" strokeWidth={1.6} />
      </div>
      <span className="text-white text-xs font-medium tracking-wide">{label}</span>
    </div>
  );
}

function SvgItem({ label, href, onClick, children }: { label: string; href?: string; onClick?: () => void; children: React.ReactNode }) {
  // Inside backdrop-filter containers, opacity < 1 on children breaks GPU compositing
  // on iOS/Android — first tap changes opacity, click fires only on second tap.
  // Fix: use color (via currentColor + CSS class) for dimming instead of opacity.
  // The svg-item class in globals.css transitions `color` on desktop hover only.
  const inner = (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
      <span className="text-xs text-center leading-tight">{label}</span>
    </div>
  );
  if (href) return <Link href={href} className="svg-item">{inner}</Link>;
  if (onClick) return <button onClick={onClick} className="svg-item" style={{ cursor: "pointer" }}>{inner}</button>;
  return <div className="svg-item">{inner}</div>;
}


function TendModal() {
  return (
    <Modal>
      <div className="flex flex-col items-center pt-6 pb-4 gap-2">
        <div className="rounded-full flex items-center justify-center" style={{ width: 66, height: 66, background: "rgba(255,255,255,0.10)" }}>
          <Leaf size={28} color="white" strokeWidth={1.6} />
        </div>
        <span className="text-white text-sm font-medium">Tend &amp; grow this ember</span>
      </div>
      <div className="mx-5" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }} />
      <div className="px-5 py-6 grid grid-cols-3" style={{ gap: "36px 8px" }}>
        <SvgItem label="Add Content" href="/home?ember=owner-add">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
        </SvgItem>
        <SvgItem label="View Wiki" href="/tend/view-wiki">
          <path d="M4 19V6a2 2 0 0 1 2-2h13"/><path d="M4 19a2 2 0 0 0 2 2h13V8H6a2 2 0 0 0-2 2"/>
        </SvgItem>
        <SvgItem label="Edit Snapshot" href="/tend/edit-snapshot">
          <rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 7l3.5 3.5L15 6"/>
        </SvgItem>
        <SvgItem label="Tag People" href="/tend/tag-people">
          <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </SvgItem>
        <SvgItem label="Edit Title" href="/tend/edit-title">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </SvgItem>
        <SvgItem label="Contributors" href="/tend/contributors">
          <circle cx="9" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2 20c0-3.3 3.1-6 7-6"/><path d="M22 20c0-3.3-3.1-6-7-6"/><path d="M12 20c0-3.3 2-5 4-5"/>
        </SvgItem>
        <div className="col-span-3 flex justify-center">
          <SvgItem label="Settings" href="/tend/settings">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </SvgItem>
        </div>
      </div>
    </Modal>
  );
}

function UserModal() {
  const params = useSearchParams();

  // Per CLAUDE.md: derive display state directly from useSearchParams so the
  // icon/label update immediately on URL change — no useEffect delay needed.
  const themeParam = params.get("theme"); // "light" | "dark" | null

  // SSR-safe localStorage fallback. Never read localStorage during render
  // (server has no window → hydration mismatch). Read it once after mount via
  // useEffect, stored in state so both server and client start with the same
  // initial value (null → isDark defaults to true = dark).
  const [storedTheme, setStoredTheme] = useState<string | null>(null);

  // On mount: read stored theme and apply it to the document.
  useEffect(() => {
    const stored = localStorage.getItem("ember-theme");
    if (stored) {
      setStoredTheme(stored);
      document.documentElement.dataset.theme = stored;
    }
  }, []);

  // When URL param changes: persist + apply. Also sync storedTheme so the
  // fallback branch stays correct if the modal is reopened without a param.
  useEffect(() => {
    if (!themeParam) return;
    localStorage.setItem("ember-theme", themeParam);
    document.documentElement.dataset.theme = themeParam;
    setStoredTheme(themeParam);
  }, [themeParam]);

  // isDark from URL param is immediate (no effect). From localStorage it's
  // one render after mount — still first-tap reliable for the toggle itself.
  const isDark = themeParam ? themeParam !== "light" : storedTheme !== "light";

  const nextTheme = isDark ? "light" : "dark";

  return (
    <Modal>
      {/* Avatar */}
      <div className="flex flex-col items-center pt-6 pb-4 gap-2">
        <div
          className="rounded-full flex items-center justify-center"
          style={{ width: 66, height: 66, background: "rgba(249,115,22,0.85)" }}
        >
          <span className="text-white text-xl font-bold">ST</span>
        </div>
        <span className="text-white text-sm font-medium">Seth Tropper</span>
      </div>
      {/* Divider */}
      <div className="mx-5" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }} />
      {/* Menu */}
      <div className="px-5 py-6 grid grid-cols-3" style={{ gap: "36px 8px" }}>
        <SvgItem label="My Embers" href="/user/my-embers">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </SvgItem>
        <SvgItem label="Shared Embers" href="/user/shared-embers">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </SvgItem>
        <SvgItem label="Create Ember" href="/home?mode=first-ember">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
        </SvgItem>
        <SvgItem label="Profile" href="/user/profile">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </SvgItem>
        {/* Dark / Light toggle */}
        <SvgItem label={isDark ? "Light Mode" : "Dark Mode"} href={`/home?m=user&theme=${nextTheme}`}>
          {isDark
            ? <><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>
            : <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          }
        </SvgItem>
        <SvgItem label="Logout" href="/">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
        </SvgItem>
      </div>
    </Modal>
  );
}

function ShareModal() {
  return (
    <Modal>
      <div className="flex flex-col items-center pt-6 pb-4 gap-2">
        <div className="rounded-full flex items-center justify-center" style={{ width: 66, height: 66, background: "rgba(255,255,255,0.10)" }}>
          <Share2 size={28} color="white" strokeWidth={1.6} />
        </div>
        <span className="text-white text-sm font-medium">Share this ember</span>
      </div>
      <div className="mx-5" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }} />
      <div className="p-5 grid grid-cols-3 gap-1">
        <GridItem icon={Link2}          label="Copy Link" />
        <GridItem icon={MessageCircle}  label="Message" />
        <GridItem icon={Mail}           label="Email" />
        <GridItem icon={FacebookIcon as any} label="Facebook" />
        <GridItem icon={XIcon as any}        label="X / Twitter" />
        <GridItem icon={MoreHorizontal} label="More" />
      </div>
    </Modal>
  );
}

function RailBtn({ icon: Icon, label, href, active }: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string; href: string; active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${active ? "bg-white/20" : "hover:bg-white/10 active:bg-white/20"}`}
    >
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.50)", WebkitBackdropFilter: "blur(8px)", backdropFilter: "blur(8px)" }}
      >
        <Icon size={23} color="white" strokeWidth={1.8} />
      </div>
      <span className="text-white text-xs font-semibold lowercase">{label}</span>
    </Link>
  );
}

const EMBER_ICON = (
  <svg width={18} height={18} viewBox="0 0 72 72" fill="white">
    <circle cx="36" cy="36" r="7.2" fill="#f97316"/>
    <rect x="32.4" y="3.18" width="7.2" height="21.6" rx="3.6" ry="3.6"/>
    <rect x="32.4" y="47.22" width="7.2" height="21.6" rx="3.6" ry="3.6"/>
    <rect x="10.38" y="25.2" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-22.02 49.98) rotate(-90)"/>
    <rect x="54.42" y="25.2" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(22.02 94.02) rotate(-90)"/>
    <rect x="47.97" y="9.63" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(29.55 -30.48) rotate(45)"/>
    <rect x="16.83" y="40.77" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(42.45 .66) rotate(45)"/>
    <rect x="16.83" y="9.63" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-8.46 20.43) rotate(-45)"/>
    <rect x="47.97" y="40.77" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-21.36 51.57) rotate(-45)"/>
  </svg>
);

const WORKFLOW_TITLES: Record<string, string> = {
  welcome:     "Start your journey here",
  "owner-add": "Add to this memory.",
  "contrib-add": "Share your memory.",
  "owner-add-more": "Add more to this memory.",
  "contrib-add-more": "Add more to this memory.",
};

function EmberBar({ flow }: { flow: string | null }) {
  const open = flow !== null;
  const openHref = `/home?ember=${flow ?? "welcome"}`;
  const title = flow ? (WORKFLOW_TITLES[flow] ?? "Ember Chat") : "Start your journey here";

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-30 flex flex-col"
      style={{
        background: "rgba(10,10,10,0.75)",
        WebkitBackdropFilter: "blur(20px)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-center gap-3 pl-4 pr-[22px] py-3">
        <Link href={open ? "/home" : "/home?ember=welcome"} className="flex-1 text-left">
          <span className="flex items-center gap-2">
            {EMBER_ICON}
            <span className="text-base font-bold text-white">{open ? "Ember Chat" : title}</span>
          </span>
        </Link>
        <Link
          href={open ? "/home" : "/home?ember=welcome"}
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
          style={{ background: open ? "rgba(255,255,255,0.15)" : "#f97316" }}
        >
          {open
            ? <ChevronDown size={18} color="white" strokeWidth={1.8} />
            : <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}
        </Link>
      </div>

      {open && (
        <WorkflowSlot flow={flow} />
      )}
    </div>
  );
}

function WorkflowSlot({ flow }: { flow: string | null }) {
  switch (flow) {
    case "welcome":     return <WelcomeFlow />;
    case "owner-add":   return <OwnerAddFlow />;
    case "contrib-add":      return <ContributorAddFlow />;
    case "owner-add-more":   return <OwnerAddMoreFlow />;
    case "contrib-add-more": return <ContributorAddMoreFlow />;
    default:                 return null;
  }
}

const BAR_HEIGHTS = [6,8,14,20,25,31,25,36,31,25,36,42,36,31,42,36,31,25,36,31,25,20,25,20,14,8,14,8,6,3].map(h => Math.round(h * 0.7));
// Stable random durations (computed once at module load, not on each render)
const BAR_DURATIONS = BAR_HEIGHTS.map((_, i) => parseFloat((0.5 + ((i * 7 + 13) % 10) / 20).toFixed(2)));

const STORY_LINES = [
  "On a bright sunny day,",
  "we can see Jonathan along with his son Timmy",
  "playing in the sand",
  "at the beach...",
];

function PlayOverlay() {
  const params = useSearchParams();
  const router = useRouter();
  const userPaused = params.get("paused") === "1";
  const restart = params.get("restart") === "1";

  const [lineIndex, setLineIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [done, setDone] = useState(false);

  // Restart from beginning when restart param is set
  useEffect(() => {
    if (!restart) return;
    setLineIndex(0);
    setFading(false);
    setDone(false);
    router.replace("/home?m=play");
  }, [restart, router]);

  // Phase 1: showing text — wait then start fade
  useEffect(() => {
    if (fading || done || userPaused) return;
    const isLast = lineIndex + 2 >= STORY_LINES.length;
    const delay = isLast ? 2500 : 2800;
    const t = setTimeout(() => {
      if (isLast) { setDone(true); } else { setFading(true); }
    }, delay);
    return () => clearTimeout(t);
  }, [lineIndex, fading, done, userPaused]);

  // Phase 2: fading — wait for transition then advance
  useEffect(() => {
    if (!fading) return;
    const t = setTimeout(() => {
      setLineIndex((i) => i + 2);
      setFading(false);
    }, 600);
    return () => clearTimeout(t);
  }, [fading]);

  return (
    <>
      <style>{`@keyframes vizPulse { from { transform: scaleY(0.15); } to { transform: scaleY(1); } }`}</style>
      <div className="absolute left-0 right-0 z-30 flex justify-center" style={{ bottom: 88 }}>
        <div
          className="relative w-full max-w-sm mx-4 flex flex-col items-center px-6 pt-8 pb-6 rounded-2xl"
          style={{
            background: "rgba(0,0,0,0.75)",
            WebkitBackdropFilter: "blur(5px)",
            backdropFilter: "blur(5px)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* Close */}
          <Link href="/home" className="absolute top-3 right-3 text-white/50 w-8 h-8 flex items-center justify-center">
            <X size={18} />
          </Link>

          {/* Soundwave */}
          <div className="flex items-center gap-[3px]" style={{ height: 34 }}>
            {BAR_HEIGHTS.map((h, i) => (
              <div
                key={i}
                style={{
                  width: 3,
                  height: h,
                  borderRadius: 3,
                  background: "#f97316",
                  transformOrigin: "center",
                  animation: `vizPulse ${BAR_DURATIONS[i]}s ease-in-out infinite alternate`,
                  animationDelay: `${(i * 0.04).toFixed(2)}s`,
                  animationPlayState: done || userPaused ? "paused" : "running",
                }}
              />
            ))}
          </div>

          {/* Transcript */}
          <div className="flex flex-col items-center gap-1 mt-4 text-center w-full" style={{ height: "3.25em" }}>
            <p
              className="font-bold text-base leading-snug w-full truncate"
              style={{ color: fading ? "transparent" : "#ffffff", transition: "color 0.8s ease" }}
            >
              {STORY_LINES[lineIndex] ?? "\u00A0"}
            </p>
            <p
              className="font-bold text-base leading-snug w-full truncate"
              style={{ color: !fading && STORY_LINES[lineIndex + 1] ? "#ffffff" : "transparent", transition: "color 0.8s ease" }}
            >
              {STORY_LINES[lineIndex + 1] ?? "\u00A0"}
            </p>
          </div>

          {/* Divider */}
          <div className="w-full mt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }} />

          {/* Transport controls — Links for mobile reliability */}
          <div className="flex justify-center gap-8 mt-5">
            <SvgItem label="back" href="/home?m=play&restart=1">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="13,8 9,12 13,16" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </SvgItem>
            <SvgItem label={userPaused ? "play" : "pause"} href={userPaused ? "/home?m=play" : "/home?m=play&paused=1"}>
              <circle cx="12" cy="12" r="10"/>
              {userPaused
                ? <polygon points="10,8 17,12 10,16" fill="white" stroke="none" />
                : <><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></>
              }
            </SvgItem>
            <SvgItem label="add" href="/tend/add-content">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </SvgItem>
          </div>
        </div>
      </div>
    </>
  );
}

// ── First Ember: Confirm ────────────────────────────────────────────────────
function ConfirmScreen() {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center px-6" style={{ background: "#0a0a0a" }}>
      {/* Back button — top left */}
      <div className="absolute top-4 left-4">
        <Link
          href="/home?mode=first-ember"
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.1)", cursor: "pointer" }}
        >
          <ChevronLeft size={22} color="white" strokeWidth={1.8} />
        </Link>
      </div>

      {/* Framed photo */}
      <div className="w-full rounded-2xl overflow-hidden" style={{ maxWidth: 420, border: "1px solid rgba(255,255,255,0.18)" }}>
        <img
          src={TEST_IMAGE}
          alt="Selected photo"
          className="w-full h-auto block"
        />
      </div>

      {/* Question + actions */}
      <div className="w-full flex flex-col gap-5 mt-7" style={{ maxWidth: 420 }}>
        <p className="text-white font-semibold text-lg text-center leading-snug">
          Would you like to create an ember from this photo?
        </p>
        <div className="flex gap-3">
          <Link
            href="/home?mode=first-ember"
            className="flex-1 flex items-center justify-center rounded-full font-semibold can-hover-dim"
            style={{ minHeight: 48, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)", cursor: "pointer" }}
          >
            Back
          </Link>
          <Link
            href="/home?mode=first-ember&step=processing"
            className="flex-1 flex items-center justify-center rounded-full font-semibold text-white can-hover-dim"
            style={{ minHeight: 48, background: "#f97316", cursor: "pointer" }}
          >
            Create Ember
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── First Ember: Processing ─────────────────────────────────────────────────
const PROCESSING_STEPS = [
  { label: "Analyzing image",    desc: "Reading the visual scene"        },
  { label: "Collecting data",    desc: "Gathering memory context"        },
  { label: "Processing results", desc: "Building the ember structure"    },
  { label: "Igniting ember",     desc: "Bringing your memory to life"    },
];
// Cumulative ms at which each step completes
const STEP_ENDS = [3000, 7000, 12000, 16000];

function ProcessingScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone] = useState(false);

  // Not inside backdrop-filter — setTimeout is safe here per CLAUDE.md
  useEffect(() => {
    const timers = STEP_ENDS.map((ms, i) =>
      setTimeout(() => {
        if (i < PROCESSING_STEPS.length - 1) {
          setCurrentStep(i + 1);
        } else {
          setDone(true);
          setTimeout(() => router.push("/home"), 700);
        }
      }, ms)
    );
    return () => timers.forEach(clearTimeout);
  }, [router]);

  // Progress fraction: half-step credit so bar is never at 0
  const progress = done ? 1 : (currentStep + 0.5) / PROCESSING_STEPS.length;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center px-8" style={{ background: "#0a0a0a" }}>
      <style>{`
        @keyframes glowBreath {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50%       { opacity: 0.65; transform: scale(1.14); }
        }
        @keyframes glowBreath2 {
          0%, 100% { opacity: 0.12; transform: scale(1); }
          50%       { opacity: 0.28; transform: scale(1.22); }
        }
        @keyframes spinArc {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes stepIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Ember glow visualization */}
      <div className="relative flex items-center justify-center" style={{ width: 148, height: 148 }}>
        {/* Outer soft glow */}
        <div className="absolute rounded-full" style={{
          width: 148, height: 148,
          background: "radial-gradient(circle, rgba(249,115,22,0.35) 0%, transparent 70%)",
          animation: "glowBreath2 3s ease-in-out infinite",
        }} />
        {/* Inner glow — brightens with step progress */}
        <div className="absolute rounded-full" style={{
          width: 96, height: 96,
          background: "radial-gradient(circle, rgba(249,115,22,0.55) 0%, transparent 70%)",
          animation: "glowBreath 1.9s ease-in-out infinite",
          animationDelay: "0.5s",
          opacity: 0.6 + progress * 0.4,
        }} />
        {/* Icon circle */}
        <div className="relative z-10 flex items-center justify-center rounded-full" style={{
          width: 76, height: 76,
          background: "rgba(249,115,22,0.15)",
          border: `1.5px solid rgba(249,115,22,${0.3 + progress * 0.5})`,
          transition: "border-color 0.8s ease",
        }}>
          <svg width={42} height={42} viewBox="0 0 72 72" fill="white">
            <circle cx="36" cy="36" r="7.2" fill="#f97316"/>
            <rect x="32.4" y="3.18"  width="7.2" height="21.6" rx="3.6" ry="3.6"/>
            <rect x="32.4" y="47.22" width="7.2" height="21.6" rx="3.6" ry="3.6"/>
            <rect x="10.38" y="25.2" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-22.02 49.98) rotate(-90)"/>
            <rect x="54.42" y="25.2" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(22.02 94.02) rotate(-90)"/>
            <rect x="47.97" y="9.63"  width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(29.55 -30.48) rotate(45)"/>
            <rect x="16.83" y="40.77" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(42.45 .66) rotate(45)"/>
            <rect x="16.83" y="9.63"  width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-8.46 20.43) rotate(-45)"/>
            <rect x="47.97" y="40.77" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-21.36 51.57) rotate(-45)"/>
          </svg>
        </div>
      </div>

      {/* Current step label — animates in on each step change */}
      <div className="flex flex-col items-center gap-1 mt-8 text-center" style={{ minHeight: 56 }}>
        <p
          key={`label-${currentStep}-${done}`}
          className="font-bold text-xl"
          style={{ animation: "stepIn 0.45s ease", color: done ? "#f97316" : "#ffffff" }}
        >
          {done ? "Ember created!" : PROCESSING_STEPS[currentStep].label}
        </p>
        <p
          key={`desc-${currentStep}-${done}`}
          className="text-sm"
          style={{ animation: "stepIn 0.45s ease 0.1s both", color: "rgba(255,255,255,0.4)" }}
        >
          {done ? "Opening your memory…" : PROCESSING_STEPS[currentStep].desc}
        </p>
      </div>

      {/* Step list */}
      <div className="w-full flex flex-col gap-3.5 mt-10" style={{ maxWidth: 280 }}>
        {PROCESSING_STEPS.map((s, i) => {
          const isActive   = i === currentStep && !done;
          const isComplete = i < currentStep || done;
          return (
            <div key={i} className="flex items-center gap-3">
              {/* Indicator */}
              <div className="relative flex-shrink-0" style={{ width: 22, height: 22 }}>
                {isActive && (
                  <div className="absolute inset-0 rounded-full" style={{
                    border: "2px solid rgba(249,115,22,0.2)",
                    borderTop: "2px solid #f97316",
                    animation: "spinArc 0.85s linear infinite",
                  }} />
                )}
                <div className="absolute inset-0 rounded-full flex items-center justify-center" style={{
                  background: isComplete ? "#f97316" : isActive ? "rgba(249,115,22,0.18)" : "transparent",
                  border: isComplete || isActive ? "none" : "1.5px solid rgba(255,255,255,0.18)",
                  transition: "background 0.3s ease",
                }}>
                  {isComplete && (
                    <svg width={11} height={11} viewBox="0 0 12 12" fill="none">
                      <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {isActive && (
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f97316" }} />
                  )}
                </div>
              </div>

              {/* Label */}
              <span className="text-sm font-medium" style={{
                color: isActive ? "#ffffff" : isComplete ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.22)",
                transition: "color 0.4s ease",
              }}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-8 rounded-full overflow-hidden" style={{ width: 280, height: 3, background: "rgba(255,255,255,0.08)" }}>
        <div style={{
          height: "100%",
          borderRadius: 9999,
          background: "#f97316",
          width: `${progress * 100}%`,
          transition: "width 0.6s ease",
        }} />
      </div>
    </div>
  );
}

export default function HomeScreen() {
  const params = useSearchParams();
  const modal = params.get("m");
  const flow = params.get("ember");
  const emberOpen = flow !== null;
  const paused = params.get("paused") === "1";
  const mode = params.get("mode");
  const step = params.get("step"); // "confirm" | "processing" | null
  const firstEmber = mode === "first-ember";
  const railHidden = firstEmber || emberOpen || modal === "share" || modal === "tend" || modal === "play" || modal === "user";

  const btnStyle: React.CSSProperties = {
    background: "rgba(0,0,0,0.40)",
    WebkitBackdropFilter: "blur(8px)",
    backdropFilter: "blur(8px)",
  };

  return (
    <div className="fixed inset-0" style={{ background: firstEmber ? "#171515" : "#000" }}>
      {/* Blurred background fill — hidden in first ember mode */}
      {!firstEmber && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${TEST_IMAGE})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(24px)",
            transform: "scale(1.08)",
            opacity: 0.7,
          }}
        />
      )}
      {/* Contained image — hidden in first ember mode */}
      {!firstEmber && (
        <img
          src={TEST_IMAGE}
          alt=""
          className="absolute left-0 right-0 pointer-events-none w-full"
          style={{
            top: 72,
            bottom: 72,
            height: "calc(100% - 144px)",
            objectFit: "cover",
            objectPosition: "center center",
          }}
        />
      )}
      {/* Upload zone — first ember mode only */}
      {firstEmber && (
        <div
          className="absolute left-0 right-0 flex flex-col items-center justify-center gap-5"
          style={{ top: 72, bottom: 0 }}
        >
          <div
            className="flex flex-col items-center gap-4 mx-8 px-8 py-10 rounded-2xl"
            style={{ border: "1.5px dashed rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.6)" }}
          >
            <svg width={56} height={56} viewBox="0 0 72 72" fill="white">
              <circle cx="36" cy="36" r="7.2" fill="#f97316"/>
              <rect x="32.4" y="3.18" width="7.2" height="21.6" rx="3.6" ry="3.6"/>
              <rect x="32.4" y="47.22" width="7.2" height="21.6" rx="3.6" ry="3.6"/>
              <rect x="10.38" y="25.2" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-22.02 49.98) rotate(-90)"/>
              <rect x="54.42" y="25.2" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(22.02 94.02) rotate(-90)"/>
              <rect x="47.97" y="9.63" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(29.55 -30.48) rotate(45)"/>
              <rect x="16.83" y="40.77" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(42.45 .66) rotate(45)"/>
              <rect x="16.83" y="9.63" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-8.46 20.43) rotate(-45)"/>
              <rect x="47.97" y="40.77" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-21.36 51.57) rotate(-45)"/>
            </svg>
            <div className="flex flex-col items-center gap-1.5 text-center">
              <p className="text-white font-semibold text-base">Create your first ember</p>
              <p className="text-white/45 text-sm leading-snug">Let's start with a photo that will help build this memory into a glowing ember.</p>
            </div>
            <Link
              href="/home?mode=first-ember&step=confirm"
              className="mt-1 px-6 rounded-full text-white text-sm font-semibold flex items-center justify-center can-hover-dim"
              style={{ background: "#f97316", minHeight: 44, cursor: "pointer" }}
            >
              Choose Photo
            </Link>
          </div>
        </div>
      )}
      {!firstEmber && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 25%, transparent 55%, rgba(0,0,0,0.55) 100%)" }}
        />
      )}

      {/* Top chrome */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-4 pt-4 pb-4">
        <Link
          href="/"
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
          style={btnStyle}
        >
          <Home size={20} color="white" strokeWidth={1.8} />
        </Link>
        {!firstEmber && (
          <div className="pointer-events-none flex-1">
            <p className="text-white font-semibold text-base leading-tight">Beach Day</p>
            <p className="text-white/55 text-xs">Summer 2023</p>
          </div>
        )}
      </div>

      {/* Right rail */}
      <div className={`absolute right-3 z-20 flex flex-col gap-0 items-center transition-opacity duration-200 ${railHidden ? "opacity-0 pointer-events-none" : "opacity-100"}`} style={{ bottom: "11%" }}>
        <Link
          href="/dev"
          className="w-11 h-11 rounded-full flex items-center justify-center mb-6"
          style={{ background: "rgba(255,255,255,0.15)", border: "1px dashed rgba(255,255,255,0.35)" }}
        >
          <span className="text-white/60 text-xs font-bold">DEV</span>
        </Link>
        <Link
          href="/home?m=user"
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${modal === "user" ? "bg-white/20" : "hover:bg-white/10 active:bg-white/20"}`}
        >
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{ background: "rgba(249,115,22,0.85)" }}
          >
            <span className="text-white text-sm font-bold">ST</span>
          </div>
          <span className="text-white text-xs font-semibold lowercase">user</span>
        </Link>
        <RailBtn icon={Share2}   label="share" href="/home?m=share" active={modal === "share"} />
        <RailBtn icon={Leaf}     label="tend"  href="/home?m=tend"  active={modal === "tend"} />
        <RailBtn icon={Play}     label="play"  href="/home?m=play"  active={modal === "play"} />
      </div>

      {modal === "user"  && <UserModal />}
      {modal === "share" && <ShareModal />}
      {modal === "tend"  && <TendModal />}
      {modal === "play"  && !emberOpen && <PlayOverlay />}

      {!firstEmber && <EmberBar flow={flow} />}

      {/* First Ember overlays — rendered above everything */}
      {firstEmber && step === "confirm"    && <ConfirmScreen />}
      {firstEmber && step === "processing" && <ProcessingScreen />}
    </div>
  );
}
