'use client';

import ReactMarkdown from 'react-markdown';

interface WikiViewProps {
  content: string;
  variant?: 'default' | 'overlay';
}

export default function WikiView({ content, variant = 'default' }: WikiViewProps) {
  const isOverlay = variant === 'overlay';
  const headingColor = isOverlay ? 'text-[var(--ember-stage-text)]' : 'text-[var(--ember-text)]';
  const bodyColor = isOverlay
    ? 'text-left text-[0.98rem] text-[var(--ember-stage-muted)]'
    : 'text-base text-[var(--ember-muted)]';

  return (
    <div className={`min-w-0 max-w-none ${isOverlay ? 'text-left' : ''}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1
              className={`ember-heading mb-6 break-words leading-tight [overflow-wrap:anywhere] ${headingColor} ${
                isOverlay ? 'text-[1.9rem] sm:text-[2.1rem]' : 'text-4xl'
              }`}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              className={`ember-heading mt-10 break-words pt-7 leading-tight [overflow-wrap:anywhere] ${headingColor} ${
                isOverlay
                  ? 'border-t border-white/10 text-[1.45rem] sm:text-[1.6rem]'
                  : 'border-t ember-divider text-3xl'
              }`}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              className={`ember-heading mt-7 break-words leading-tight [overflow-wrap:anywhere] ${headingColor} ${
                isOverlay ? 'text-[1.18rem]' : 'text-2xl'
              }`}
            >
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className={`mb-5 break-words leading-8 ${bodyColor}`}>{children}</p>
          ),
          ul: ({ children }) => (
            <ul
              className={`mb-6 ml-5 list-disc space-y-3 break-words leading-8 marker:text-[var(--ember-stage-accent)] ${bodyColor}`}
            >
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol
              className={`mb-6 ml-5 list-decimal space-y-3 break-words leading-8 marker:font-semibold marker:text-[var(--ember-stage-accent)] ${bodyColor}`}
            >
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-2">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote
              className={`my-8 break-words rounded-[1.35rem] border-l-4 px-5 py-4 italic leading-8 ${
                isOverlay
                  ? 'border-[var(--ember-stage-accent)] bg-black/22 text-left text-[0.98rem] text-white/90'
                  : 'border-[var(--ember-orange)] bg-[rgba(255,102,33,0.06)] text-base text-[var(--ember-text)]'
              }`}
            >
              {children}
            </blockquote>
          ),
          strong: ({ children }) => (
            <strong className={`font-semibold ${headingColor}`}>
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className={`italic ${headingColor}`}>{children}</em>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              className={`font-semibold underline underline-offset-4 ${
                isOverlay
                  ? 'text-[var(--ember-stage-accent)] decoration-[rgba(255,122,26,0.45)]'
                  : 'text-[var(--ember-orange-deep)] decoration-[rgba(255,102,33,0.35)]'
              }`}
            >
              {children}
            </a>
          ),
          hr: () => (
            <hr className={`my-10 border-0 border-t ${isOverlay ? 'border-white/10' : 'ember-divider'}`} />
          ),
          code: ({ children }) => (
            <code
              className={`break-all rounded-md px-1.5 py-1 text-[0.92em] ${
                isOverlay
                  ? 'bg-black/22 text-white'
                  : 'bg-[rgba(20,20,20,0.05)] text-[var(--ember-text)]'
              }`}
            >
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
