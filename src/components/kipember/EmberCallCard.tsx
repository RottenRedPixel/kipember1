'use client';

import { ChevronDown, Phone, Play } from 'lucide-react';
import { useRef, useState } from 'react';
import { pastelForContributor, pastelForContributorIdentity } from '@/lib/contributor-color';

export type EmberCallSegment = {
  index: number;
  role: string;
  speaker: string;
  content: string;
  startMs: number | null;
  endMs: number | null;
};

export type EmberCallBlock = {
  personName: string;
  avatarUrl: string | null;
  // Identity fields the API populates so the call card can compute the
  // pool-key pastel for the avatar (mirrors how chat / voice blocks work).
  personUserId?: string | null;
  personEmail?: string | null;
  personPhoneNumber?: string | null;
  personAvatarColor?: string | null;
  // True when the call's contributor is the ember owner — drives the
  // orange owner swatch instead of the pastel.
  isOwner?: boolean;
  voiceCallId: string;
  recordingUrl: string | null;
  startedAt: string | null;
  endedAt: string | null;
  status: string;
  segments: EmberCallSegment[];
};

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function CallHeaderAvatar({
  name,
  avatarUrl,
  userId,
  email,
  phoneNumber,
  contributorId,
  avatarColor,
}: {
  name: string;
  avatarUrl: string | null;
  userId: string | null;
  email: string | null;
  phoneNumber: string | null;
  contributorId: string | null;
  avatarColor?: string | null;
}) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: 29, height: 29 }}
      />
    );
  }
  const bg = avatarColor ?? (
    userId || email || phoneNumber || contributorId
      ? pastelForContributorIdentity({ userId, email, phoneNumber, id: contributorId })
      : pastelForContributor(name)
  );
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{
        width: 29,
        height: 29,
        background: bg,
        color: '#1f2937',
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {initials(name)}
    </div>
  );
}

export default function EmberCallCard({
  block,
  hideHeader = false,
}: {
  block: EmberCallBlock;
  // Inside the Ember Chat shell's Call tab the user already knows whose
  // call they're viewing — the surrounding chat header carries that
  // context — so we hide the per-card "<Name>'s Ember Call (N segments)"
  // strip to avoid redundancy. The wiki Story Circle keeps it because
  // the same surface lists multiple people's calls in one scroll.
  hideHeader?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // Match Ember Chat / Ember Voice — calls expand by default in the
  // Ember Chat workflow so segments are visible immediately. The header
  // toggle still collapses them on click for users who want to focus.
  // When hideHeader is true the toggle is gone and segments stay open.
  const [collapsed, setCollapsed] = useState(false);
  const stopAtMsRef = useRef<number | null>(null);

  const playSegment = (segment: EmberCallSegment) => {
    if (!audioRef.current || !block.recordingUrl || segment.startMs == null) return;
    audioRef.current.currentTime = segment.startMs / 1000;
    stopAtMsRef.current = segment.endMs ?? null;
    void audioRef.current.play();
    setActiveIndex(segment.index);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const currentMs = audioRef.current.currentTime * 1000;
    if (stopAtMsRef.current != null && currentMs >= stopAtMsRef.current) {
      audioRef.current.pause();
      stopAtMsRef.current = null;
      setActiveIndex(null);
    }
  };

  const handlePauseOrEnded = () => {
    setActiveIndex(null);
  };

  const firstName = block.personName.split(' ')[0] || block.personName;
  const baseDate = block.startedAt ? new Date(block.startedAt) : null;
  const baseValid = baseDate && !Number.isNaN(baseDate.getTime()) ? baseDate : null;

  const segmentCount = block.segments.length;

  const segmentsVisible = hideHeader || !collapsed;

  // The wiki Story Circle wraps every call in its own surface card so the
  // multiple calls in a long scroll feel like distinct chunks. Inside the
  // Ember Chat shell's Call tab we suppress that wrapper so segments float
  // on the chat background like Chat / Voice messages do.
  const wrapperClass = hideHeader
    ? 'flex flex-col gap-1'
    : 'rounded-xl px-4 py-3.5 flex flex-col gap-1';
  const wrapperStyle = hideHeader
    ? undefined
    : { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' };

  return (
    <div className={wrapperClass} style={wrapperStyle}>
      {hideHeader ? null : (
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          className="w-full flex items-center gap-2 cursor-pointer"
          style={{ background: 'transparent', border: 'none', padding: 0, minHeight: 44 }}
        >
          <div
            className="rounded-full flex items-center justify-center flex-shrink-0"
            style={{ width: 29, height: 29, background: '#f97316' }}
          >
            <Phone size={16} className="text-white" fill="currentColor" stroke="currentColor" />
          </div>
          <CallHeaderAvatar
            name={block.personName}
            avatarUrl={block.avatarUrl}
            userId={block.personUserId ?? null}
            email={block.personEmail ?? null}
            phoneNumber={block.personPhoneNumber ?? null}
            contributorId={null}
            avatarColor={block.personAvatarColor ?? null}
          />
          <p className="flex-1 text-left text-white/30 text-xs font-medium">
            {block.personName}&apos;s Ember Call
            <span className="ml-2 text-white/20">
              ({segmentCount} {segmentCount === 1 ? 'segment' : 'segments'})
            </span>
          </p>
          <ChevronDown
            size={14}
            color="rgba(255,255,255,0.5)"
            style={{
              transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
            }}
          />
        </button>
      )}
      {block.recordingUrl ? (
        <audio
          ref={audioRef}
          src={block.recordingUrl}
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onPause={handlePauseOrEnded}
          onEnded={handlePauseOrEnded}
        />
      ) : null}
      {segmentsVisible ? (
      <div className={`flex flex-col gap-3 ${hideHeader ? '' : 'mt-3'}`}>
        {block.segments.map((segment, index) => {
          const isUser = segment.role === 'user';
          const canPlay = Boolean(block.recordingUrl) && segment.startMs != null;
          const isActive = activeIndex === segment.index;
          const segmentDate =
            baseValid && segment.startMs != null
              ? new Date(baseValid.getTime() + segment.startMs)
              : null;
          const prevSegment = index > 0 ? block.segments[index - 1] : null;
          const prevDate =
            baseValid && prevSegment && prevSegment.startMs != null
              ? new Date(baseValid.getTime() + prevSegment.startMs)
              : null;
          // Date divider only in the Ember Chat Call tab (hideHeader).
          // The wiki Story Circle lists many calls back to back; adding a
          // date stamp above each one would be noisy.
          const showDateDivider =
            hideHeader &&
            segmentDate &&
            !Number.isNaN(segmentDate.getTime()) &&
            (!prevDate || segmentDate.toDateString() !== prevDate.toDateString());
          const dateDividerLabel =
            segmentDate && !Number.isNaN(segmentDate.getTime())
              ? segmentDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : null;
          const segmentTime =
            segmentDate && !Number.isNaN(segmentDate.getTime())
              ? segmentDate.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : null;
          return (
            <div key={segment.index}>
              {showDateDivider && dateDividerLabel ? (
                <div className="flex justify-center my-2">
                  <span className="text-white/25 text-[10px]">{dateDividerLabel}</span>
                </div>
              ) : null}
              <div
                className={`flex flex-col gap-0.5 ${isUser ? 'items-end' : 'items-start'}`}
              >
              <span
                className={`text-xs font-bold ${
                  isUser ? 'pr-1 text-white/30' : 'pl-1 text-white'
                }`}
              >
                {isUser ? firstName : 'ember'}
              </span>
              <div
                className={`inline-block max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed text-white/80 ${
                  isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'
                }`}
                style={{
                  background: isUser ? 'rgba(249,115,22,0.18)' : 'var(--bg-ember-bubble)',
                  border: isUser
                    ? '1px solid rgba(249,115,22,0.45)'
                    : '1px solid var(--border-ember)',
                }}
              >
                {segment.content}
                {canPlay ? (
                  <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() =>
                        isActive ? audioRef.current?.pause() : playSegment(segment)
                      }
                      className="flex h-5 w-5 items-center justify-center rounded-full flex-shrink-0"
                      style={{
                        background: 'rgba(249,115,22,0.85)',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      aria-label={isActive ? 'Pause segment' : 'Play segment'}
                    >
                      <Play size={9} className="text-white" />
                    </button>
                    <span className="text-white/30 text-xs">
                      {isActive ? 'Playing…' : 'Voice recording'}
                    </span>
                  </div>
                ) : null}
              </div>
              {segmentTime ? (
                <span className="text-white/25 text-[10px] mt-0.5">{segmentTime}</span>
              ) : null}
              </div>
            </div>
          );
        })}
      </div>
      ) : null}
    </div>
  );
}
