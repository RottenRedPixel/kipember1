'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import MediaPreview from '@/components/MediaPreview';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ContributorData {
  contributor: {
    id: string;
    name: string | null;
  };
  image: {
    id: string;
    filename: string;
    mediaType: 'IMAGE' | 'VIDEO';
    posterFilename: string | null;
    durationSeconds: number | null;
    originalName: string;
    description: string | null;
  };
  conversation: {
    messages: Message[];
    status: string;
  } | null;
  latestVoiceCall: {
    id: string;
    status: string;
    startedAt: string | null;
    endedAt: string | null;
    createdAt: string;
    callSummary: string | null;
  } | null;
}

export default function ContributePage() {
  const params = useParams();
  const [data, setData] = useState<ContributorData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/contribute/${params.token}`);
        if (!response.ok) {
          throw new Error('Invalid or expired link');
        }

        const result = await response.json();
        setData(result);

        if (result.conversation?.messages) {
          setMessages(result.conversation.messages);
          setIsComplete(result.conversation.status === 'completed');
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [params.token]);

  const refreshContributorData = async () => {
    const response = await fetch(`/api/contribute/${params.token}`);
    if (!response.ok) {
      return;
    }

    const result = await response.json();
    setData(result);

    if (result.conversation?.messages) {
      setMessages(result.conversation.messages);
      setIsComplete(result.conversation.status === 'completed');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending || isComplete) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsSending(true);
    setActionError('');

    try {
      const response = await fetch(`/api/contribute/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const result = await response.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: result.response }]);
      setIsComplete(result.isComplete);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const startConversation = async () => {
    setIsSending(true);
    setActionError('');

    try {
      const response = await fetch(`/api/contribute/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '__START__' }),
      });

      if (response.ok) {
        await refreshContributorData();
      }
    } catch (err) {
      console.error('Failed to start:', err);
      setActionError('Failed to start texting with Ember');
    } finally {
      setIsSending(false);
    }
  };

  const startVoiceCall = async () => {
    setIsCalling(true);
    setActionError('');

    try {
      const response = await fetch(`/api/contribute/${params.token}/call`, {
        method: 'POST',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to start voice call');
      }

      await refreshContributorData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to start voice call');
    } finally {
      setIsCalling(false);
    }
  };

  const voiceStatusLabel = (status: string) => {
    switch (status) {
      case 'registered':
        return 'Ember is dialing your phone now.';
      case 'ongoing':
        return 'Your conversation with Ember is in progress.';
      case 'ended':
        return 'Your call with Ember finished. We will sync it shortly.';
      case 'not_connected':
        return 'We could not connect your call with Ember.';
      case 'error':
        return 'Your call with Ember hit an error.';
      default:
        return `Speak with Ember status: ${status}`;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-950 dark:to-black">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-950 dark:to-black">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">:(</div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Link Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {loadError || 'This link may have expired or is invalid.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-950 dark:to-black">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg overflow-hidden mb-4">
          <MediaPreview
            mediaType={data.image.mediaType}
            filename={data.image.filename}
            posterFilename={data.image.posterFilename}
            originalName={data.image.originalName}
            controls={data.image.mediaType === 'VIDEO'}
            className="w-full h-auto max-h-[28rem] object-contain bg-black"
          />
          <div className="p-4">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              Share Your Memories
            </h1>
            {data.image.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {data.image.description}
              </p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg overflow-hidden">
          {actionError && (
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-red-50 dark:bg-red-900/20">
              <p className="text-sm text-red-700 dark:text-red-300">{actionError}</p>
            </div>
          )}

          {data.latestVoiceCall && (
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-emerald-50 dark:bg-emerald-900/20">
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                {voiceStatusLabel(data.latestVoiceCall.status)}
              </p>
            </div>
          )}

          <div className="h-80 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && !isComplete ? (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Choose how you want to share your memories with Ember.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-3">
                  <button
                    onClick={startConversation}
                    disabled={isSending || isCalling}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-full transition-colors"
                  >
                    {isSending ? 'Starting...' : 'Text with Ember'}
                  </button>
                  <button
                    onClick={startVoiceCall}
                    disabled={
                      isSending ||
                      isCalling ||
                      data.latestVoiceCall?.status === 'registered' ||
                      data.latestVoiceCall?.status === 'ongoing'
                    }
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium rounded-full transition-colors"
                  >
                    {isCalling ? 'Calling...' : 'Speak with Ember'}
                  </button>
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))
            )}
            {isSending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <span
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.1s' }}
                    />
                    <span
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {!isComplete && messages.length > 0 && (
            <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your response..."
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  disabled={isSending}
                />
                <button
                  type="submit"
                  disabled={isSending || !input.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-full transition-colors text-sm"
                >
                  Send
                </button>
              </div>
            </form>
          )}

          {isComplete && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-green-50 dark:bg-green-900/20">
              <p className="text-center text-green-700 dark:text-green-400 text-sm">
                Thank you for sharing your memories! You can close this page now.
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">Memory Wiki</p>
      </div>
    </div>
  );
}
