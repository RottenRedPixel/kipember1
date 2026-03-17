'use client';

import ReactMarkdown from 'react-markdown';

interface WikiViewProps {
  content: string;
}

export default function WikiView({ content }: WikiViewProps) {
  return (
    <div className="min-w-0 max-w-none">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="ember-heading mb-6 break-words text-4xl leading-tight text-[var(--ember-text)] [overflow-wrap:anywhere]">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="ember-heading mt-12 border-t ember-divider break-words pt-8 text-3xl leading-tight text-[var(--ember-text)] [overflow-wrap:anywhere]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="ember-heading mt-8 break-words text-2xl leading-tight text-[var(--ember-text)] [overflow-wrap:anywhere]">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-5 break-words text-base leading-8 text-[var(--ember-muted)]">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="mb-6 ml-5 list-disc space-y-3 break-words text-base leading-8 text-[var(--ember-muted)] marker:text-[var(--ember-orange)]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-6 ml-5 list-decimal space-y-3 break-words text-base leading-8 text-[var(--ember-muted)] marker:font-semibold marker:text-[var(--ember-orange-deep)]">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-2">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-8 break-words rounded-[1.5rem] border-l-4 border-[var(--ember-orange)] bg-[rgba(255,102,33,0.06)] px-5 py-4 text-base italic leading-8 text-[var(--ember-text)]">
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
          hr: () => <hr className="my-10 border-0 border-t ember-divider" />,
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
