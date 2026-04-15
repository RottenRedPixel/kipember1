'use client';

import { useSearchParams } from 'next/navigation';

export default function ContributorAddMoreFlow() {
  const params = useSearchParams();
  const step = params.get('step');

  return (
    <div className="relative z-[1] pl-4 pr-[22px] pt-1 pb-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium pl-1 text-white">ember</span>
        <div
          className="inline-block max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-2.5"
          style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
        >
          <p className="text-white/90 text-sm leading-relaxed">
            Hi Seth, would you like to add more to this memory? We can hop on a quick call or keep
            chatting here.
          </p>
        </div>
      </div>

      {step === null ? (
        <div className="flex gap-3">
          <a
            href="/home?ember=contrib-add-more&step=phone"
            className="flex-1 rounded-full text-white text-sm font-medium flex items-center justify-center btn-secondary"
            style={{
              border: '1.5px solid var(--border-btn)',
              background: 'transparent',
              minWidth: 0,
              minHeight: 44,
            }}
          >
            phone call
          </a>
          <a
            href="/home?ember=contrib-add-more&step=chat"
            className="flex-1 rounded-full text-white text-sm font-medium flex items-center justify-center btn-primary"
            style={{ background: '#f97316', border: 'none', minWidth: 0, minHeight: 44 }}
          >
            chat here
          </a>
        </div>
      ) : step === 'phone' ? (
        <>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs font-medium pr-1 text-white/30">you</span>
            <div
              className="inline-block max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5"
              style={{ background: 'var(--bg-chat-user)', border: 'none' }}
            >
              <p className="text-white/90 text-sm leading-relaxed">I&apos;ll take the phone call.</p>
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
              style={{ background: 'var(--bg-chat-user)', border: 'none' }}
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
                Lets add some more to this memory!
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
