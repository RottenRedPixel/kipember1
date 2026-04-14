"use client";

import { use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Phone, MessageSquare, Plus, MapPin, Clock, Image, Users, BookOpen, Sparkles, FileText } from "lucide-react";
import { TEND_ACTIONS, TEND_ICONS } from "../constants";

// ── Mock data ──────────────────────────────────────────────────────────────
const CONTRIBUTORS = [
  { id: "david-smith",       name: "David Smith",       phone: "732.555.1234", email: "david.smith@email.com",  joined: "March 23, 2026", prefers: "SMS",  contactTime: "Early Morning PST", language: "English", contributions: [{ type: "Phone Call", date: "March 25, 2026 · 8:05pm" }, { type: "Phone Call", date: "March 22, 2026 · 5:05pm" }] },
  { id: "andrew-richardson", name: "Andrew Richardson", phone: "917.555.9876", email: "",                        joined: "March 20, 2026", prefers: "Call", contactTime: "Evening PST",       language: "English", contributions: [{ type: "Phone Call", date: "March 21, 2026 · 7:00pm" }] },
  { id: "jen",               name: "Jen",               phone: "646.555.4321", email: "jen@example.com",         joined: "March 18, 2026", prefers: "SMS",  contactTime: "Afternoon PST",     language: "English", contributions: [] },
  { id: "mary-smith",        name: "Mary Smith",        phone: "201.555.7890", email: "mary@example.com",        joined: "March 15, 2026", prefers: "Call", contactTime: "Morning PST",       language: "Spanish", contributions: [{ type: "Phone Call", date: "March 16, 2026 · 10:00am" }] },
];

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// ── Shared field style ─────────────────────────────────────────────────────
const fieldStyle = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
};

// ── Contributors List ──────────────────────────────────────────────────────
function ContributorsList() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-2">
        {CONTRIBUTORS.map((c) => (
          <div
            key={c.id}
            className="flex items-center rounded-xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            {/* Left — tappable row navigates to detail */}
            <Link
              href={`/tend/contributors?view=${c.id}`}
              className="flex items-center gap-3 flex-1 px-4 py-3 can-hover"
              style={{ minHeight: 44, opacity: 0.9 }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
                style={{ background: "rgba(249,115,22,0.75)" }}
              >
                {initials(c.name)}
              </div>
              <span className="text-white text-sm font-medium">{c.name}</span>
            </Link>
            {/* Right — phone/sms as separate <a> tags, no nesting */}
            <a
              href={`tel:${c.phone}`}
              className="w-11 h-11 flex items-center justify-center can-hover flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.06)", opacity: 0.75 }}
            >
              <Phone size={15} color="white" strokeWidth={1.8} />
            </a>
            <a
              href={`sms:${c.phone}`}
              className="w-11 h-11 flex items-center justify-center can-hover flex-shrink-0 mr-2"
              style={{ background: "rgba(255,255,255,0.06)", opacity: 0.75, borderRadius: "0 8px 8px 0" }}
            >
              <MessageSquare size={15} color="white" strokeWidth={1.8} />
            </a>
          </div>
        ))}
      </div>

      {/* Add button */}
      <div className="py-5 px-1">
        <Link
          href="/tend/contributors?view=add"
          className="flex items-center justify-center gap-2 w-full rounded-full text-white text-sm font-semibold can-hover-dim"
          style={{ background: "#f97316", minHeight: 44, cursor: "pointer" }}
        >
          <Plus size={16} strokeWidth={2} />
          Add Contributor
        </Link>
      </div>
    </div>
  );
}

// ── Add Contributor Form ───────────────────────────────────────────────────
function AddContributor() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-3">
        {(["First Name", "Last Name (optional)", "Phone", "Email (optional)"] as const).map((placeholder) => (
          <input
            key={placeholder}
            type={placeholder === "Phone" ? "tel" : placeholder.startsWith("Email") ? "email" : "text"}
            placeholder={placeholder}
            className="w-full h-12 rounded-xl px-4 text-sm text-white placeholder-white/30 outline-none"
            style={fieldStyle}
          />
        ))}

        {/* Language preference */}
        <div
          className="w-full h-12 rounded-xl px-4 flex items-center justify-between"
          style={fieldStyle}
        >
          <span className="text-white/30 text-sm">Language Preference</span>
          <ChevronLeft size={18} color="rgba(255,255,255,0.3)" className="rotate-[-90deg]" />
        </div>
      </div>

      {/* Buttons */}
      <div className="py-5 flex gap-3">
        <Link
          href="/tend/contributors"
          className="flex-1 flex items-center justify-center rounded-full text-white/60 text-sm font-semibold"
          style={{ background: "rgba(255,255,255,0.08)", minHeight: 44 }}
        >
          Cancel
        </Link>
        <Link
          href="/tend/contributors"
          className="flex-1 flex items-center justify-center rounded-full text-white text-sm font-semibold can-hover-dim"
          style={{ background: "#f97316", minHeight: 44, cursor: "pointer" }}
        >
          Save
        </Link>
      </div>
    </div>
  );
}

// ── Preference Row ─────────────────────────────────────────────────────────
function PrefRow({ label, value }: { label: string; value: string }) {
  return (
    <button
      className="w-full flex items-center justify-between px-4 rounded-xl can-hover"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", minHeight: 44, cursor: "pointer", opacity: 0.9 }}
    >
      <span className="text-white text-sm font-medium">
        {label} <span className="text-white/45 font-normal">({value})</span>
      </span>
      <ChevronLeft size={18} color="rgba(255,255,255,0.3)" className="rotate-[-90deg]" />
    </button>
  );
}

// ── View Contributor ───────────────────────────────────────────────────────
function ViewContributor({ id }: { id: string }) {
  const c = CONTRIBUTORS.find(x => x.id === id);
  if (!c) return <p className="text-white/40 text-sm pt-6">Contributor not found.</p>;

  return (
    <div className="flex flex-col h-full overflow-y-auto py-4 gap-4">
      {/* Contact card */}
      <div
        className="rounded-xl px-4 py-4"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white font-bold text-base">{c.name}</p>
            <p className="text-white/50 text-sm mt-0.5">{c.phone}</p>
            {c.email && <p className="text-white/50 text-sm">{c.email}</p>}
          </div>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ background: "rgba(249,115,22,0.75)" }}
          >
            {initials(c.name)}
          </div>
        </div>
        <p className="text-white/35 text-xs mt-3">
          <span className="text-white/55 font-semibold">Joined Ember</span> · {c.joined}
        </p>
      </div>

      {/* Preferences */}
      <div className="flex flex-col gap-2">
        <PrefRow label="Prefers" value={c.prefers} />
        <PrefRow label="Contact Time" value={c.contactTime} />
        <PrefRow label="Language" value={c.language} />
      </div>

      {/* Send buttons */}
      <div className="flex gap-3">
        <button
          className="flex-1 flex items-center justify-center rounded-full text-white/70 text-sm font-semibold can-hover"
          style={{ background: "rgba(255,255,255,0.08)", minHeight: 44, cursor: "pointer", opacity: 0.8 }}
        >
          Scheduled
        </button>
        <button
          className="flex-1 flex items-center justify-center rounded-full text-white text-sm font-semibold can-hover-dim"
          style={{ background: "#f97316", minHeight: 44, cursor: "pointer" }}
        >
          Send Now
        </button>
      </div>

      {/* Contributions */}
      <div className="flex flex-col gap-3 pb-6">
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} className="pt-4">
          <p className="text-white font-bold text-sm mb-3">{c.name.split(" ")[0]}&apos;s Contributions</p>
          {c.contributions.length === 0 && (
            <p className="text-white/35 text-sm">No contributions yet.</p>
          )}
          {c.contributions.map((contrib, i) => (
            <div key={i} className="mb-4">
              <p className="text-white/55 text-xs font-medium mb-1">
                {contrib.type} · <span className="text-white/35">{contrib.date}</span>
              </p>
              <div
                className="rounded-xl px-4 py-3"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <p className="text-white/40 text-xs italic">Transcript preview would appear here.</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Wiki ───────────────────────────────────────────────────────────────────

const WIKI_DATA = {
  title: { value: "Beach Day", source: "Manual entry" },
  contributors: {
    owner: { name: "Seth Tropper", initials: "ST" },
    invited: [
      { name: "Jonathan Reed", initials: "JR", status: "Viewer" },
      { name: "Maria Santos",  initials: "MS", status: "Viewer" },
      { name: "Kai Williams",  initials: "KW", status: "Viewer" },
    ],
    pending: [],
  },
  storyCircle: [
    { from: "ai",   name: "Ember AI",       time: "Jun 12 · 10:14 AM", text: "Tell us about this moment. What was happening when this photo was taken?" },
    { from: "user", name: "Seth Tropper",   time: "Jun 12 · 10:14 AM", text: "We spent the day at Asbury Park with the kids — they couldn't get enough of the waves." },
    { from: "ai",   name: "Ember AI",       time: "Jun 12 · 10:15 AM", text: "That sounds like a wonderful day! What was the most memorable moment at the beach?" },
    { from: "user", name: "Seth Tropper",   time: "Jun 12 · 10:15 AM", text: "Timmy found a sand crab and refused to leave until he could catch it. Classic." },
    { from: "user", name: "Jonathan Reed",  time: "Jun 12 · 10:22 AM", text: "I remember him chasing that crab for like 20 minutes. Best part of the whole trip." },
    { from: "ai",   name: "Ember AI",       time: "Jun 12 · 10:23 AM", text: "What made this beach day special compared to others?" },
    { from: "user", name: "Maria Santos",   time: "Jun 12 · 10:24 AM", text: "We all made it — that never happens anymore. Everyone was there." },
  ],
  photos: {
    cover: { label: "Ember Image", filename: "beach-day-cover.jpg", size: "2.4 MB", dims: "3024 × 4032", camera: "iPhone 15 Pro", taken: "Jun 12, 2024 · 1:18 PM" },
    supporting: [
      { label: "Kids at shoreline",    filename: "kids-shore.jpg",  size: "1.8 MB", type: "image/jpeg", added: "Jun 14, 2024 · 9:10 AM" },
      { label: "Boardwalk selfie",     filename: "boardwalk.jpg",   size: "2.1 MB", type: "image/jpeg", added: "Jun 14, 2024 · 9:12 AM" },
      { label: "Sand crab close-up",   filename: "crab.jpg",        size: "840 KB", type: "image/jpeg", added: "Jun 14, 2024 · 9:13 AM" },
      { label: "Sunset from pier",     filename: "sunset-pier.jpg", size: "3.2 MB", type: "image/jpeg", added: "Jun 16, 2024 · 2:05 PM" },
    ],
  },
  location: { name: "Asbury Park Beach", city: "Asbury Park, New Jersey · United States", altitude: "2.1m above sea level", source: "Photo GPS data", camera: "iPhone 15 Pro" },
  timeDate: { display: "Wed, Jun 12, 2024, 1:18 PM", source: "Photo EXIF data", camera: "iPhone 15 Pro" },
  analysis: `**PEOPLE & DEMOGRAPHICS:**\n- **Number of People:** Four individuals visible.\n- **Estimated Age Ranges:** Two adults, two children.\n- **Gender:** Mixed.\n- **Clothing:** Swimwear and casual summer attire.\n- **Body Language:** All smiling, relaxed postures suggesting enjoyment.\n- **Relationships:** Familial — parents with young children.\n\n**SETTING & ENVIRONMENT:**\n- **Location Type:** Outdoor beach setting.\n- **Time of Day:** Afternoon, bright natural light.\n- **Background:** Sandy beach, ocean waves, clear sky.\n\n**ACTIVITIES & CONTEXT:**\n- **What's Happening:** Family posing together near the water.\n- **Event Type:** Casual family beach outing.\n\n**EMOTIONAL CONTEXT:**\n- **Overall Mood:** Joyful and relaxed.\n- **Emotional Expressions:** Genuine smiles indicating happiness.\n- **Social Dynamics:** Warm, close family unit.\n\n**STORY ELEMENTS:**\n- **What Does This Tell Us?** A cherished summer family memory at the New Jersey shore.\n- **What Likely Happened Before?** Swimming, building sandcastles, chasing crabs.\n- **What Likely Happened Next?** Boardwalk food and a sunset walk.`,
};

function WikiBadge({ complete }: { complete: boolean }) {
  return (
    <span
      className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
      style={{
        background: complete ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.15)",
        color: complete ? "#4ade80" : "#fb923c",
      }}
    >
      {complete ? "Complete" : "Not Complete"}
    </span>
  );
}

function WikiSection({
  icon, title, complete, children,
}: {
  icon: React.ReactNode; title: string; complete: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ color: "rgba(255,255,255,0.55)" }}>{icon}</span>
          <h3 className="text-white font-bold text-base">{title}</h3>
        </div>
        <WikiBadge complete={complete} />
      </div>
      {children}
    </div>
  );
}

function WikiCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl px-4 py-3.5 flex flex-col gap-1" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
      {children}
    </div>
  );
}

function WikiContent() {
  const d = WIKI_DATA;

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar py-5 flex flex-col gap-7 pb-10">

      {/* Title */}
      <WikiSection icon={<FileText size={17} />} title="Title" complete>
        <WikiCard>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Ember Title</p>
          <p className="text-white font-semibold text-base">{d.title.value}</p>
          <p className="text-white/35 text-xs">Source: {d.title.source}</p>
        </WikiCard>
      </WikiSection>

      {/* Contributors */}
      <WikiSection icon={<Users size={17} />} title="Contributors" complete>
        <WikiCard>
          <p className="text-white/40 text-xs font-semibold mb-2">Owner</p>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: "rgba(255,255,255,0.15)" }}>
              {d.contributors.owner.initials}
            </div>
            <span className="text-white text-sm font-medium">{d.contributors.owner.name}</span>
            <span className="ml-auto text-white/40 text-xs font-semibold">Owner</span>
          </div>
        </WikiCard>
        <WikiCard>
          <p className="text-white/40 text-xs font-semibold mb-2">Invited (Accounts Created)</p>
          <div className="flex flex-col gap-2.5">
            {d.contributors.invited.map((c) => (
              <div key={c.name} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: "rgba(255,255,255,0.15)" }}>
                  {c.initials}
                </div>
                <span className="text-white text-sm font-medium">{c.name}</span>
                <span className="ml-auto text-white/35 text-xs">{c.status}</span>
              </div>
            ))}
          </div>
        </WikiCard>
        <WikiCard>
          <p className="text-white/40 text-xs font-semibold">Invited (Accounts Not Created Yet)</p>
          <p className="text-white/30 text-sm">No pending email invitations</p>
        </WikiCard>
      </WikiSection>

      {/* Story Circle */}
      <WikiSection icon={<BookOpen size={17} />} title="Story Circle" complete>
        <div className="flex flex-col gap-3 px-1">
          {d.storyCircle.map((msg, i) => {
            const isAi = msg.from === "ai";
            return (
              <div key={i} className={`flex flex-col gap-1 ${isAi ? "items-start" : "items-end"}`}>
                <div className={`flex items-center gap-1.5 ${isAi ? "" : "flex-row-reverse"}`}>
                  <span className="text-white/50 text-xs font-semibold">{msg.name}</span>
                  <span className="text-white/25 text-xs">{msg.time}</span>
                </div>
                <div
                  className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed text-white/90 ${isAi ? "rounded-2xl rounded-tl-sm" : "rounded-2xl rounded-tr-sm"}`}
                  style={isAi
                    ? { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)" }
                    : { background: "rgba(249,115,22,0.6)" }
                  }
                >
                  {msg.text}
                </div>
                <span className="text-white/25 text-xs mx-1">
                  {isAi ? "AI Generated" : "Audio message"}
                </span>
              </div>
            );
          })}
        </div>
      </WikiSection>

      {/* Photos */}
      <WikiSection icon={<Image size={17} />} title="Photos" complete={false}>
        <WikiCard>
          <p className="text-white/40 text-xs font-semibold mb-2">Ember Image</p>
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-lg flex-shrink-0" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }} />
            <div className="flex flex-col gap-0.5">
              <p className="text-white text-sm font-medium">{d.photos.cover.filename}</p>
              <p className="text-white/35 text-xs">{d.photos.cover.dims} · {d.photos.cover.size}</p>
              <p className="text-white/35 text-xs">Camera: {d.photos.cover.camera}</p>
              <p className="text-white/35 text-xs">Taken: {d.photos.cover.taken}</p>
            </div>
          </div>
        </WikiCard>
        <WikiCard>
          <p className="text-white/40 text-xs font-semibold mb-2">Supporting Media</p>
          <div className="flex flex-col gap-3">
            {d.photos.supporting.map((p) => (
              <div key={p.filename} className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg flex-shrink-0" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }} />
                <div className="flex flex-col gap-0.5">
                  <p className="text-white text-sm font-medium">{p.label}</p>
                  <p className="text-white/35 text-xs">{p.size} · {p.type}</p>
                  <p className="text-white/25 text-xs">Added: {p.added}</p>
                </div>
              </div>
            ))}
          </div>
        </WikiCard>
      </WikiSection>

      {/* Location */}
      <WikiSection icon={<MapPin size={17} />} title="Location" complete>
        <WikiCard>
          <p className="text-white/40 text-xs font-semibold mb-1.5">GPS Location</p>
          <p className="text-white font-semibold text-sm">{d.location.name}</p>
          <p className="text-white/55 text-sm">{d.location.city}</p>
          <p className="text-white/35 text-xs mt-1.5">Altitude: {d.location.altitude}</p>
          <p className="text-white/35 text-xs">Source: {d.location.source}</p>
          <p className="text-white/35 text-xs">Camera: {d.location.camera}</p>
        </WikiCard>
      </WikiSection>

      {/* Time & Date */}
      <WikiSection icon={<Clock size={17} />} title="Time & Date" complete>
        <WikiCard>
          <p className="text-white/40 text-xs font-semibold mb-1.5">Photo Timestamp</p>
          <p className="text-white font-semibold text-sm">{d.timeDate.display}</p>
          <p className="text-white/35 text-xs mt-1.5">Source: {d.timeDate.source}</p>
          <p className="text-white/35 text-xs">Camera: {d.timeDate.camera}</p>
        </WikiCard>
      </WikiSection>

      {/* Image Analysis */}
      <WikiSection icon={<Sparkles size={17} />} title="Image Analysis" complete>
        <WikiCard>
          <p className="text-white/40 text-xs font-semibold mb-2">AI Image Analysis</p>
          <div className="flex flex-col gap-1">
            {d.analysis.split("\n").map((line, i) => {
              const isBold = line.startsWith("**") && line.endsWith("**");
              const cleaned = line.replace(/\*\*/g, "");
              if (isBold) return (
                <p key={i} className="text-white/70 text-xs font-semibold mt-2">{cleaned}</p>
              );
              return (
                <p key={i} className="text-white/50 text-xs leading-relaxed">{cleaned}</p>
              );
            })}
          </div>
          <p className="text-white/20 text-xs mt-4">Source: GPT-4o · Analyzed: Jun 13, 2024</p>
        </WikiCard>
      </WikiSection>

    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function TendActionPage({
  params,
}: {
  params: Promise<{ action: string }>;
}) {
  const { action } = use(params);
  const searchParams = useSearchParams();
  const view = searchParams.get("view");

  const title = TEND_ACTIONS[action];
  if (!title) return null;

  const isContributors = action === "contributors";
  const isWiki = action === "view-wiki";

  // Derive sub-title for contributors
  let subTitle = title;
  if (isContributors && view === "add") subTitle = "Add Contributor";
  else if (isContributors && view && view !== "add") {
    const c = ["david-smith","andrew-richardson","jen","mary-smith"].find(id => id === view);
    if (c) subTitle = CONTRIBUTORS.find(x => x.id === c)?.name ?? title;
  }

  // Back href for contributors sub-views
  const backHref = isContributors && view ? "/tend/contributors" : "/home";

  return (
    <div className="fixed inset-0 flex">
      {/* 7% peek — tap to go back */}
      <Link href={backHref} className="w-[7%] h-full" />

      {/* 93% panel */}
      <div
        className="w-[93%] h-full flex flex-col slide-in-right"
        style={{ background: "#292726", borderLeft: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 pt-6 pb-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <Link
            href={backHref}
            className="w-11 h-11 flex items-center justify-center flex-shrink-0 rounded-full can-hover"
            style={{ opacity: 0.75 }}
          >
            <ChevronLeft size={22} color="#fff" strokeWidth={1.8} />
          </Link>

          {(!isContributors || !view) && TEND_ICONS[action] && (
            <svg
              width={24}
              height={24}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0"
            >
              {TEND_ICONS[action]}
            </svg>
          )}

          <h2 className="text-white font-bold text-lg">{subTitle}</h2>
        </div>

        {/* Content */}
        <div className="flex-1 px-5 min-h-0 flex flex-col">
          {isContributors ? (
            view === "add" ? <AddContributor /> :
            view ? <ViewContributor id={view} /> :
            <ContributorsList />
          ) : isWiki ? (
            <WikiContent />
          ) : (
            <div className="pt-6 text-white/30 text-sm">
              {/* placeholder content for {action} */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
