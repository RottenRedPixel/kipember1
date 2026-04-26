'use client';

import { useEffect, useRef, useState } from 'react';
import type { VoiceMessage } from './VoiceMessageList';

type RecorderHandle = {
  recorder: MediaRecorder;
  stream: MediaStream;
};

export function useVoiceRecording(imageId: string) {
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const recorderRef = useRef<RecorderHandle | null>(null);
  const lastPlayedAssistantRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      setIsLoadingHistory(true);
      try {
        const res = await fetch(`/api/voice?imageId=${encodeURIComponent(imageId)}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          if (!cancelled) setMessages([]);
          return;
        }
        const payload = await res.json();
        if (!cancelled) {
          setMessages(
            Array.isArray(payload.messages) ? (payload.messages as VoiceMessage[]) : []
          );
        }
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    }
    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [imageId]);

  // Auto-play newest assistant audio (only once per message).
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role !== 'assistant' || !last.audioUrl) return;
    if (lastPlayedAssistantRef.current === last.audioUrl) return;
    lastPlayedAssistantRef.current = last.audioUrl;
    const audio = new Audio(last.audioUrl);
    void audio.play().catch(() => undefined);
  }, [messages]);

  useEffect(() => {
    return () => {
      const handle = recorderRef.current;
      if (handle) {
        try {
          handle.recorder.stop();
        } catch {
          /* noop */
        }
        handle.stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
      }
    };
  }, []);

  async function startRecording() {
    setError('');
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Voice mode is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        recorderRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        if (blob.size > 0) {
          void uploadRecording(blob);
        }
      };
      recorder.start();
      recorderRef.current = { recorder, stream };
      setIsRecording(true);
    } catch (recordError) {
      console.error('Voice recording error:', recordError);
      setError(
        recordError instanceof Error
          ? recordError.message
          : 'Could not start the microphone.'
      );
      setIsRecording(false);
    }
  }

  function stopRecording() {
    const handle = recorderRef.current;
    if (!handle) return;
    try {
      handle.recorder.stop();
    } catch {
      /* noop */
    }
  }

  async function uploadRecording(blob: Blob) {
    setIsUploading(true);
    setError('');
    const optimisticUserUrl = URL.createObjectURL(blob);
    const optimisticCreatedAt = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: '',
        audioUrl: optimisticUserUrl,
        createdAt: optimisticCreatedAt,
      },
    ]);
    try {
      const ext =
        blob.type.includes('webm') ? 'webm' : blob.type.includes('mp4') ? 'm4a' : 'webm';
      const file = new File([blob], `voice-${Date.now()}.${ext}`, {
        type: blob.type || 'audio/webm',
      });
      const formData = new FormData();
      formData.append('imageId', imageId);
      formData.append('audio', file);
      const res = await fetch('/api/voice', { method: 'POST', body: formData });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || 'Voice mode failed.');
      }
      setMessages((prev) => {
        const next = prev.slice(0, -1); // drop optimistic placeholder
        URL.revokeObjectURL(optimisticUserUrl);
        const now = new Date().toISOString();
        return [
          ...next,
          {
            role: 'user',
            content: typeof payload.transcript === 'string' ? payload.transcript : '',
            audioUrl: typeof payload.userAudioUrl === 'string' ? payload.userAudioUrl : null,
            createdAt: now,
          },
          {
            role: 'assistant',
            content: typeof payload.reply === 'string' ? payload.reply : '',
            audioUrl: typeof payload.replyAudioUrl === 'string' ? payload.replyAudioUrl : null,
            createdAt: now,
          },
        ];
      });
    } catch (uploadError) {
      console.error('Voice upload error:', uploadError);
      setError(
        uploadError instanceof Error ? uploadError.message : 'Could not save the recording.'
      );
      setMessages((prev) => prev.slice(0, -1));
      URL.revokeObjectURL(optimisticUserUrl);
    } finally {
      setIsUploading(false);
    }
  }

  return {
    messages,
    isLoadingHistory,
    isRecording,
    isUploading,
    error,
    startRecording,
    stopRecording,
  };
}
