'use client';

import { ChevronDown, Phone, Play } from 'lucide-react';
import { useRef, useState } from 'react';

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
}: {
  name: string;
  avatarUrl: string | null;
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
  return (
    <div
      className="rounded-full flex items-center justify-center text-white flex-shrink-0"
      style={{
        width: 29,
        height: 29,
        background: 'rgba(255,255,255,0.15)',
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {initials(name)}
    </div>
  );
}

export default function EmberCallCard({ block }: { block: EmberCallBlock }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(true);
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

  return (
    <div
      className="rounded-xl px-4 py-3.5 flex flex-col gap-1"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
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
        <CallHeaderAvatar name={block.personName} avatarUrl={block.avatarUrl} />
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
      {!collapsed ? (
      <div className="flex flex-col gap-3 mt-3">
        {block.segments.map((segment) => {
          const isUser = segment.role === 'user';
          const canPlay = Boolean(block.recordingUrl) && segment.startMs != null;
          const isActive = activeIndex === segment.index;
          const segmentTime =
            baseValid && segment.startMs != null
              ? new Date(baseValid.getTime() + segment.startMs).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : null;
          return (
            <div
              key={segment.index}
              className={`flex flex-col gap-0.5 ${isUser ? 'items-end' : 'items-start'}`}
            >
              <span className="flex items-center gap-1 text-white text-xs font-bold">
                <Phone size={9} />
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
          );
        })}
      </div>
      ) : null}
    </div>
  );
}
