'use client';

import { Phone, Play } from 'lucide-react';

type CallMessage = {
  role: 'assistant' | 'user';
  content: string;
  audioUrl: string | null;
  createdAt: string;
};

function buildPlaceholderMessages(): CallMessage[] {
  const baseTime = new Date();
  baseTime.setHours(14, 12, 0, 0);
  const t = (offsetMinutes: number) =>
    new Date(baseTime.getTime() + offsetMinutes * 60_000).toISOString();
  return [
    { role: 'assistant', content: `Hey, can you walk me through what was happening in this moment?`, audioUrl: null, createdAt: t(0) },
    { role: 'user', content: `It was such a warm afternoon. Everyone had just sat down and we were finally all together in one place.`, audioUrl: '#', createdAt: t(1) },
    { role: 'assistant', content: 'Who else was there with you that day?', audioUrl: null, createdAt: t(2) },
    { role: 'user', content: `My sister, her two kids, and a couple of neighbors who stopped by. We didn't plan it — it just happened.`, audioUrl: '#', createdAt: t(3) },
  ];
}

export default function CallsPlaceholderList() {
  const messages = buildPlaceholderMessages();
  return (
    <div className="flex flex-col gap-3">
      {messages.map((msg, i) => {
        const isUser = msg.role === 'user';
        const msgDate = new Date(msg.createdAt);
        const prevMsg = messages[i - 1];
        const prevDate = prevMsg ? new Date(prevMsg.createdAt) : null;
        const showDateDivider = !prevDate || msgDate.toDateString() !== prevDate.toDateString();
        const timeLabel = msgDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const dateDividerLabel = msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return (
          <div key={i}>
            {showDateDivider ? (
              <div className="flex justify-center my-2">
                <span className="text-white/25 text-[10px]">{dateDividerLabel}</span>
              </div>
            ) : null}
            <div className={`flex flex-col gap-0.5 ${isUser ? 'items-end' : 'items-start'}`}>
              <span className="flex items-center gap-1 text-white text-xs font-bold">
                <Phone size={9} />
                {isUser ? 'you' : 'ember'}
              </span>
              <div
                className={`inline-block max-w-[85%] rounded-2xl px-4 py-2.5 ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                style={{
                  background: isUser ? 'rgba(249,115,22,0.18)' : 'var(--bg-ember-bubble)',
                  border: isUser ? '1px solid rgba(249,115,22,0.45)' : '1px solid var(--border-ember)',
                }}
              >
                <p className="text-sm leading-relaxed text-white/90 whitespace-pre-wrap">{msg.content}</p>
                {msg.audioUrl ? (
                  <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-white/10">
                    <a
                      href={msg.audioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-5 w-5 items-center justify-center rounded-full flex-shrink-0"
                      style={{ background: 'rgba(249,115,22,0.85)' }}
                    >
                      <Play size={9} className="text-white" />
                    </a>
                    <span className="text-white/30 text-xs">Voice recording</span>
                  </div>
                ) : null}
              </div>
              <span className="text-white/25 text-[10px] mt-0.5">{timeLabel}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
