'use client';

import { Pause, Phone, Play } from 'lucide-react';
import { useRef, useState } from 'react';

export type EmberChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  source?: 'web' | 'voice' | 'sms';
  imageUrl?: string | null;
  imageFilename?: string | null;
  audioUrl?: string | null;
  createdAt?: string;
};

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      void audio.play();
    }
  }

  return (
    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <button
        type="button"
        onClick={toggle}
        className="flex h-6 w-6 items-center justify-center rounded-full cursor-pointer flex-shrink-0"
        style={{ background: 'rgba(249,115,22,0.85)' }}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause size={11} className="text-white" /> : <Play size={11} className="text-white" />}
      </button>
      <span className="text-white/40 text-xs">Voice recording</span>
    </div>
  );
}

function TypingIndicator({ emberLabel }: { emberLabel: string }) {
  return (
    <div className="flex flex-col gap-1 items-start">
      <span className="pl-1 text-xs font-bold text-white">{emberLabel}</span>
      <div
        className="inline-flex max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3"
        style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
      >
        <div className="flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-[#f97316]" />
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-[#f97316]"
            style={{ animationDelay: '0.1s' }}
          />
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-[#f97316]"
            style={{ animationDelay: '0.2s' }}
          />
        </div>
      </div>
    </div>
  );
}

export default function EmberChatMessages({
  messages,
  selfLabel = 'you',
  emberLabel = 'ember',
  isSending = false,
  endRef,
}: {
  messages: EmberChatMessage[];
  selfLabel?: string;
  emberLabel?: string;
  isSending?: boolean;
  endRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex flex-col gap-4">
      {messages.map((message, index) => {
        const isUser = message.role === 'user';
        const isVoice = message.source === 'voice';
        const msgDate = message.createdAt ? new Date(message.createdAt) : null;
        const prevDate =
          index > 0 && messages[index - 1]?.createdAt
            ? new Date(messages[index - 1].createdAt!)
            : null;
        const showDateDivider =
          msgDate && (!prevDate || msgDate.toDateString() !== prevDate.toDateString());
        const timeLabel =
          msgDate && !Number.isNaN(msgDate.getTime())
            ? msgDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
            : null;
        const dateDividerLabel =
          msgDate && !Number.isNaN(msgDate.getTime())
            ? msgDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : null;
        return (
          <div key={`${message.role}-${index}-${message.content.slice(0, 24)}`}>
            {showDateDivider && dateDividerLabel ? (
              <div className="flex justify-center my-2">
                <span className="text-white/25 text-[10px]">{dateDividerLabel}</span>
              </div>
            ) : null}
            <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
              <span
                className={`flex items-center gap-1 text-xs font-bold ${
                  isUser ? 'pr-1 text-white/30' : 'pl-1 text-white'
                }`}
              >
                {isVoice ? (
                  <Phone
                    size={10}
                    className={isUser ? 'text-white/30' : 'text-white/60'}
                  />
                ) : null}
                {isUser ? selfLabel : emberLabel}
              </span>
              {message.imageUrl || message.imageFilename ? (
                <div className="max-w-[30%] rounded-2xl rounded-tr-sm overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={message.imageUrl ?? `/api/uploads/${message.imageFilename}`}
                    alt="Uploaded photo"
                    className="w-full h-auto object-cover"
                  />
                </div>
              ) : (
                <div
                  className={`inline-block max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'
                  }`}
                  style={{
                    background: isUser ? 'rgba(249,115,22,0.20)' : 'rgba(249,115,22,0.09)',
                    border: isUser ? '1px solid rgba(249,115,22,0.50)' : '1px solid rgba(249,115,22,0.25)',
                  }}
                >
                  <p className="text-sm leading-relaxed text-white/90 whitespace-pre-wrap">
                    {message.content}
                  </p>
                  {message.audioUrl ? <AudioPlayer src={message.audioUrl} /> : null}
                </div>
              )}
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

      {isSending ? <TypingIndicator emberLabel={emberLabel} /> : null}
      {endRef ? <div ref={endRef} /> : null}
    </div>
  );
}
