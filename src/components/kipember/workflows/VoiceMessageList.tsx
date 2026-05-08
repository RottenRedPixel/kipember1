'use client';

import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type VoiceMessage = {
  role: 'user' | 'assistant';
  content: string;
  audioUrl: string | null;
  createdAt: string;
};

function AudioPlayButton({
  src,
  onPlaybackChange,
}: {
  src: string;
  onPlaybackChange?: (analyser: AnalyserNode | null) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [playing, setPlaying] = useState(false);

  // Build the AudioContext + AnalyserNode once per element (lazy).
  // createMediaElementSource can only be called once per HTMLAudioElement.
  function ensureAnalyser(): AnalyserNode | null {
    if (analyserRef.current) return analyserRef.current;
    const audio = audioRef.current;
    if (!audio) return null;
    const AudioCtor: typeof AudioContext | undefined =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;
    try {
      const ctx = new AudioCtor();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      return analyser;
    } catch {
      return null;
    }
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      const analyser = ensureAnalyser();
      const ctx = audioCtxRef.current;
      if (ctx?.state === 'suspended') void ctx.resume();
      void audio.play();
      onPlaybackChange?.(analyser);
    }
  }

  return (
    <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-white/10">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => { setPlaying(false); onPlaybackChange?.(null); }}
        onEnded={() => { setPlaying(false); onPlaybackChange?.(null); }}
      />
      <button
        type="button"
        onClick={toggle}
        className="flex h-5 w-5 items-center justify-center rounded-full cursor-pointer flex-shrink-0"
        style={{ background: 'rgba(34,197,94,0.85)' }}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause size={9} className="text-white" /> : <Play size={9} className="text-white" />}
      </button>
      <span className="text-white/30 text-xs">{playing ? 'Playing…' : 'Voice recording'}</span>
    </div>
  );
}

export default function VoiceMessageList({
  messages,
  isUploading,
  emptyHint = 'Tap the green mic to start a voice conversation.',
  selfLabel = 'you',
  emberLabel = 'ember',
  onPlaybackChange,
}: {
  messages: VoiceMessage[];
  isUploading: boolean;
  emptyHint?: string;
  selfLabel?: string;
  emberLabel?: string;
  onPlaybackChange?: (analyser: AnalyserNode | null) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {messages.length === 0 && !isUploading ? (
        <p className="text-white/40 text-sm text-center mt-8">{emptyHint}</p>
      ) : null}
      {messages.map((message, index) => {
        const isUser = message.role === 'user';
        const msgDate = new Date(message.createdAt);
        const prevMsg = messages[index - 1];
        const prevDate = prevMsg ? new Date(prevMsg.createdAt) : null;
        const showDateDivider =
          !prevDate || msgDate.toDateString() !== prevDate.toDateString();
        const timeLabel = Number.isNaN(msgDate.getTime())
          ? null
          : msgDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const dateDividerLabel = Number.isNaN(msgDate.getTime())
          ? null
          : msgDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
        return (
          <div key={`${message.role}-${index}-${message.createdAt}`}>
            {showDateDivider && dateDividerLabel ? (
              <div className="flex justify-center my-2">
                <span className="text-white/25 text-[10px]">{dateDividerLabel}</span>
              </div>
            ) : null}
            <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
              <span
                className={`text-xs font-bold ${isUser ? 'pr-1 text-white/30' : 'pl-1 text-white'}`}
              >
                {isUser ? selfLabel : emberLabel}
              </span>
              <div
                className={`inline-block max-w-[85%] rounded-2xl px-4 py-2.5 ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                style={{
                  background: isUser ? 'rgba(34,197,94,0.18)' : 'var(--bg-ember-bubble)',
                  border: isUser
                    ? '1px solid rgba(34,197,94,0.45)'
                    : '1px solid var(--border-ember)',
                }}
              >
                <p className="text-sm leading-relaxed text-white/90 whitespace-pre-wrap">
                  {message.content || (isUser ? 'Recording…' : '')}
                </p>
                {message.audioUrl ? <AudioPlayButton src={message.audioUrl} onPlaybackChange={onPlaybackChange} /> : null}
              </div>
              {timeLabel ? (
                <span
                  className={`text-white/25 text-[10px] mt-0.5 ${isUser ? 'pr-1' : 'pl-1'}`}
                >
                  {timeLabel}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}

      {isUploading ? (
        <div className="flex flex-col gap-1 items-start">
          <span className="pl-1 text-xs font-bold text-white">{emberLabel}</span>
          <div
            className="inline-flex max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3"
            style={{
              background: 'var(--bg-ember-bubble)',
              border: '1px solid var(--border-ember)',
            }}
          >
            <div className="flex gap-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#22c55e]" />
              <span
                className="h-2 w-2 animate-bounce rounded-full bg-[#22c55e]"
                style={{ animationDelay: '0.1s' }}
              />
              <span
                className="h-2 w-2 animate-bounce rounded-full bg-[#22c55e]"
                style={{ animationDelay: '0.2s' }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
