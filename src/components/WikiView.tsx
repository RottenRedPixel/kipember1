'use client';

import ReactMarkdown from 'react-markdown';

interface WikiViewProps {
  content: string;
  variant?: 'default' | 'overlay';
}

export default function WikiView({ content, variant = 'default' }: WikiViewProps) {
  const isOverlay = variant === 'overlay';

  return (
    <div className={`min-w-0 max-w-none ${isOverlay ? 'text-left' : ''}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1
              className={`ember-heading mb-6 break-words leading-tight text-[var(--ember-text)] [overflow-wrap:anywhere] ${
                isOverlay ? 'text-center text-3xl sm:text-[2.1rem]' : 'text-4xl'
              }`}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              className={`ember-heading mt-10 break-words pt-7 leading-tight text-[var(--ember-text)] [overflow-wrap:anywhere] ${
                isOverlay
                  ? 'border-t border-black/10 text-center text-[1.55rem] sm:text-[1.7rem]'
                  : 'border-t ember-divider text-3xl'
              }`}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              className={`ember-heading mt-7 break-words leading-tight text-[var(--ember-text)] [overflow-wrap:anywhere] ${
                isOverlay ? 'text-center text-[1.25rem]' : 'text-2xl'
              }`}
            >
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p
              className={`mb-5 break-words leading-8 ${
                isOverlay
                  ? 'text-left text-[0.98rem] text-[rgba(20,20,20,0.82)]'
                  : 'text-base text-[var(--ember-muted)]'
              }`}
            >
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul
              className={`mb-6 ml-5 list-disc space-y-3 break-words leading-8 marker:text-[var(--ember-orange)] ${
                isOverlay
                  ? 'text-left text-[0.98rem] text-[rgba(20,20,20,0.82)]'
                  : 'text-base text-[var(--ember-muted)]'
              }`}
            >
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol
              className={`mb-6 ml-5 list-decimal space-y-3 break-words leading-8 marker:font-semibold marker:text-[var(--ember-orange-deep)] ${
                isOverlay
                  ? 'text-left text-[0.98rem] text-[rgba(20,20,20,0.82)]'
                  : 'text-base text-[var(--ember-muted)]'
              }`}
            >
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-2">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote
              className={`my-8 break-words rounded-[1.5rem] border-l-4 border-[var(--ember-orange)] px-5 py-4 italic leading-8 text-[var(--ember-text)] ${
                isOverlay ? 'bg-white/45 text-left text-[0.98rem]' : 'bg-[rgba(255,102,33,0.06)] text-base'
              }`}
            >
              {children}
            </blockquote>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-[var(--ember-text)]">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-[var(--ember-text)]">{children}</em>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              className="font-semibold text-[var(--ember-orange-deep)] underline decoration-[rgba(255,102,33,0.35)] underline-offset-4"
            >
              {children}
            </a>
          ),
          hr: () => (
            <hr className={`my-10 border-0 border-t ${isOverlay ? 'border-black/10' : 'ember-divider'}`} />
          ),
          code: ({ children }) => (
            <code className="break-all rounded-md bg-[rgba(20,20,20,0.05)] px-1.5 py-1 text-[0.92em] text-[var(--ember-text)]">
              {children}
            </code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
