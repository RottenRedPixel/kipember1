"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ContributorAddFlow() {
  const params = useSearchParams();
  const step = params.get("step");

  return (
    <div className="relative z-[1] pl-4 pr-[22px] pt-1 pb-6 flex flex-col gap-4">
      {/* Ember prompt */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium pl-1 text-white">ember</span>
        <div
          className="inline-block max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-2.5"
          style={{ background: "var(--bg-ember-bubble)", border: "1px solid var(--border-ember)" }}
        >
          <p className="text-white/90 text-sm leading-relaxed">
            Hi Seth, you&apos;ve been invited to share your memory of this moment. Would you like ember to call you at (732)123-4567 or continue chatting here?
          </p>
        </div>
      </div>

      {step === null ? (
        <div className="flex gap-3">
          <Link
            href="/home?ember=contrib-add&step=phone"
            className="flex-1 rounded-full text-white text-sm font-medium flex items-center justify-center btn-secondary"
            style={{ border: "1.5px solid var(--border-btn)", background: "transparent", minWidth: 0, minHeight: 44 }}
          >
            phone call
          </Link>
          <Link
            href="/home?ember=contrib-add&step=chat"
            className="flex-1 rounded-full text-white text-sm font-medium flex items-center justify-center btn-primary"
            style={{ background: "#f97316", border: "none", minWidth: 0, minHeight: 44 }}
          >
            chat here
          </Link>
        </div>
      ) : step === "phone" ? (
        <>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs font-medium pr-1 text-white/30">you</span>
            <div className="inline-block max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5" style={{ background: "var(--bg-chat-user)", border: "none" }}>
              <p className="text-white/90 text-sm leading-relaxed">I&apos;ll take the phone call.</p>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium pl-1 text-white">ember</span>
            <div className="inline-block max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-2.5" style={{ background: "var(--bg-ember-bubble)", border: "1px solid var(--border-ember)" }}>
              <p className="text-white/90 text-sm leading-relaxed">We&apos;re calling you now! Thank you!</p>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs font-medium pr-1 text-white/30">you</span>
            <div className="inline-block max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5" style={{ background: "var(--bg-chat-user)", border: "none" }}>
              <p className="text-white/90 text-sm leading-relaxed">I&apos;ll chat with you.</p>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium pl-1 text-white">ember</span>
            <div className="inline-block max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-2.5" style={{ background: "var(--bg-ember-bubble)", border: "1px solid var(--border-ember)" }}>
              <p className="text-white/90 text-sm leading-relaxed">Lets talk about this memory!</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "transparent", border: "1.5px solid var(--border-btn)" }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </button>
            <input type="text" placeholder="Type a message..." className="flex-1 h-11 rounded-full px-4 text-sm text-white placeholder-white/30 outline-none" style={{ background: "var(--bg-ember-bubble)", border: "1px solid var(--border-input)" }} />
            <button className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#f97316", border: "none", cursor: "pointer" }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
