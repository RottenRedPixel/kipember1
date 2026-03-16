'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatInterfaceProps {
  imageId: string;
  subjectNoun?: 'photo' | 'video';
}

export default function ChatInterface({ imageId, subjectNoun = 'photo' }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetch(`/api/chat?imageId=${encodeURIComponent(imageId)}`);
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      }
    };

    loadHistory();
  }, [imageId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageId,
          message: userMessage,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response },
      ]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestedQuestions = [
    `What do we know about this ${subjectNoun}?`,
    `Who has been identified in this ${subjectNoun}?`,
    'What details did contributors share?',
    'What does the metadata tell us?',
  ];

  return (
    <div className="ember-panel-strong flex min-h-[36rem] flex-col overflow-hidden rounded-[2.25rem]">
      <div className="border-b ember-divider px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="ember-eyebrow">Ask Ember</p>
            <h2 className="ember-heading mt-3 text-3xl text-[var(--ember-text)]">
              Memory Q&amp;A
            </h2>
            <p className="ember-copy mt-3 max-w-2xl text-sm">
              Ask grounded questions about this {subjectNoun}, contributor memories,
              and the current wiki. Ember should answer directly and say when
              something is still unknown.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="ember-chip">
              {subjectNoun === 'video' ? 'Video context' : 'Photo context'}
            </span>
            <span className="ember-chip">
              {messages.length === 0 ? 'No history yet' : `${messages.length} messages`}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[20rem] flex-col items-center justify-center text-center">
            <div className="ember-card inline-flex rounded-full px-4 py-2 text-sm font-semibold text-[var(--ember-orange-deep)]">
              {subjectNoun === 'video' ? 'Video Q&A' : 'Photo Q&A'}
            </div>
            <h3 className="ember-heading mt-5 text-3xl text-[var(--ember-text)]">
              Start with a precise question
            </h3>
            <p className="ember-copy mt-3 max-w-xl text-sm">
              Use the quick prompts below or write your own question about who is
              here, what happened, and how the memory is documented so far.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {suggestedQuestions.map((question) => (
                <button
                  key={question}
                  onClick={() => setInput(question)}
                  className="ember-chip cursor-pointer hover:border-[rgba(255,102,33,0.18)] hover:text-[var(--ember-orange-deep)]"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`mb-4 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-[1.7rem] px-4 py-3 sm:px-5 ${
                  message.role === 'user'
                    ? 'rounded-br-md bg-[var(--ember-charcoal)] text-white shadow-[0_18px_34px_rgba(17,17,17,0.16)]'
                    : 'rounded-bl-md border border-[rgba(20,20,20,0.08)] bg-white text-[var(--ember-text)] shadow-[0_12px_28px_rgba(17,17,17,0.06)]'
                }`}
              >
                <div
                  className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                    message.role === 'user'
                      ? 'text-white/60'
                      : 'text-[var(--ember-orange-deep)]'
                  }`}
                >
                  {message.role === 'user' ? 'You' : 'Ember'}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-7">
                  {message.content}
                </p>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-[1.7rem] rounded-bl-md border border-[rgba(20,20,20,0.08)] bg-white px-4 py-3 shadow-[0_12px_28px_rgba(17,17,17,0.06)]">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ember-orange-deep)]">
                Ember
              </div>
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--ember-orange)]" />
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-[var(--ember-orange)]"
                  style={{ animationDelay: '0.1s' }}
                />
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-[var(--ember-orange)]"
                  style={{ animationDelay: '0.2s' }}
                />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t ember-divider px-5 py-5 sm:px-6">
        <div className="rounded-[1.7rem] border border-[rgba(20,20,20,0.08)] bg-white/94 p-2 shadow-[0_12px_30px_rgba(17,17,17,0.05)]">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask about this ${subjectNoun}...`}
              className="min-w-0 flex-1 rounded-[1.2rem] border border-transparent bg-transparent px-4 py-3 text-sm text-[var(--ember-text)] outline-none placeholder:text-[var(--ember-muted)] focus:border-[rgba(255,102,33,0.2)] focus:bg-[rgba(247,247,244,0.7)]"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="ember-button-primary min-h-0 px-6 py-3 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Thinking...' : 'Send'}
            </button>
          </div>

          <div className="mt-2 px-2 text-xs text-[var(--ember-muted)]">
            Keep questions specific if you want grounded answers tied to the current memory record.
          </div>
        </div>
      </form>
    </div>
  );
}
