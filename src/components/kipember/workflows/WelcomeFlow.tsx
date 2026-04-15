'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function WelcomeFlow() {
  const params = useSearchParams();
  const addTapped = params.get('step') === 'adding';
  const addStep = addTapped ? (params.get('sub') ?? null) : null;
  const phoneFromChat = addStep === 'phone-from-chat';

  return (
    <div className="relative z-[1] pl-4 pr-[22px] pt-1 pb-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium pl-1 text-white">ember</span>
        <div
          className="inline-block max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-2.5"
          style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
        >
          <p className="text-white/90 text-sm leading-relaxed">
            Hello there, to get started you can start adding to this memory or you can invite
            some friends and family to contribute to this memory.
          </p>
        </div>
      </div>

      {!addTapped ? (
        <div className="flex gap-3">
          <Link
            href="/tend/contributors"
            className="flex-1 rounded-full text-white text-sm font-medium flex items-center justify-center btn-secondary"
            style={{
              border: '1.5px solid var(--border-btn)',
              background: 'transparent',
              minWidth: 0,
              minHeight: 44,
            }}
          >
            Invite Others
          </Link>
          <Link
            href="/home?ember=welcome&step=adding"
            className="flex-1 rounded-full text-white text-sm font-medium flex items-center justify-center btn-primary"
            style={{ background: '#f97316', border: 'none', minWidth: 0, minHeight: 44 }}
          >
            Add to Memory
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs font-medium pr-1 text-white/30">you</span>
            <div
              className="inline-block max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5"
              style={{ background: 'var(--bg-chat-user)', border: 'none' }}
            >
              <p className="text-white/90 text-sm leading-relaxed">I&apos;ll add to this memory.</p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium pl-1 text-white">ember</span>
            <div
              className="inline-block max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-2.5"
              style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
            >
              <p className="text-white/90 text-sm leading-relaxed">
                Would you like ember to call you to talk about this memory, or would you prefer
                to chat here?
              </p>
            </div>
          </div>

          {addStep === null ? (
            <div className="flex gap-3">
              <Link
                href="/home?ember=welcome&step=adding&sub=phone"
                className="flex-1 rounded-full text-white text-sm font-medium flex items-center justify-center btn-secondary"
                style={{
                  border: '1.5px solid var(--border-btn)',
                  background: 'transparent',
                  minWidth: 0,
                  minHeight: 44,
                }}
              >
                phone call
              </Link>
              <Link
                href="/home?ember=welcome&step=adding&sub=chat"
                className="flex-1 rounded-full text-white text-sm font-medium flex items-center justify-center btn-primary"
                style={{ background: '#f97316', border: 'none', minWidth: 0, minHeight: 44 }}
              >
                chat here
              </Link>
            </div>
          ) : addStep === 'phone' || phoneFromChat ? (
            <>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs font-medium pr-1 text-white/30">you</span>
                <div
                  className="inline-block max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5"
                  style={{ background: '#2e3a4e' }}
                >
                  <p className="text-white/90 text-sm leading-relaxed">
                    {phoneFromChat
                      ? "Let's move to a phone call."
                      : "I'll take the phone call."}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium pl-1 text-white">ember</span>
                <div
                  className="inline-block max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-2.5"
                  style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
                >
                  <p className="text-white/90 text-sm leading-relaxed">
                    We&apos;re calling you now! Thank you!
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs font-medium pr-1 text-white/30">you</span>
                <div
                  className="inline-block max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5"
                  style={{ background: '#2e3a4e' }}
                >
                  <p className="text-white/90 text-sm leading-relaxed">I&apos;ll chat with you.</p>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium pl-1 text-white">ember</span>
                <div
                  className="inline-block max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-2.5"
                  style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
                >
                  <p className="text-white/90 text-sm leading-relaxed">
                    Lets talk about this memory!
                  </p>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
