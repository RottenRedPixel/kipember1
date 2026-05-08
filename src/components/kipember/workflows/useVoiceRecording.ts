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
  const [isPlayingBack, setIsPlayingBack] = useState(false);
  const [playbackAnalyser, setPlaybackAnalyser] = useState<AnalyserNode | null>(null);
  const [error, setError] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const recorderRef = useRef<RecorderHandle | null>(null);
  const lastPlayedAssistantRef = useRef<string | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);

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
          const loaded: VoiceMessage[] = Array.isArray(payload.messages)
            ? (payload.messages as VoiceMessage[])
            : [];
          // Pre-seed the played ref so the auto-play effect doesn't replay
          // the last assistant message when history first loads.
          const lastAssistant = [...loaded].reverse().find(
            (m) => m.role === 'assistant' && m.audioUrl
          );
          if (lastAssistant?.audioUrl) {
            lastPlayedAssistantRef.current = lastAssistant.audioUrl;
          }
          setMessages(loaded);
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

  // Auto-play newest assistant audio and drive the visualiser during playback.
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role !== 'assistant' || !last.audioUrl) return;
    if (lastPlayedAssistantRef.current === last.audioUrl) return;
    lastPlayedAssistantRef.current = last.audioUrl;

    const audio = new Audio(last.audioUrl);
    playbackAudioRef.current = audio;
    let audioCtx: AudioContext | null = null;

    const cleanup = () => {
      playbackAudioRef.current = null;
      setIsPlayingBack(false);
      setPlaybackAnalyser(null);
      if (audioCtx) { try { void audioCtx.close(); } catch { /* noop */ } audioCtx = null; }
    };

    const AudioCtor: typeof AudioContext | undefined =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (AudioCtor) {
      try {
        audioCtx = new AudioCtor();
        const source = audioCtx.createMediaElementSource(audio);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.7;
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        audio.onended = cleanup;
        audio.onpause = cleanup;
        void audio.play().then(() => {
          setIsPlayingBack(true);
          setPlaybackAnalyser(analyser);
        }).catch(cleanup);
      } catch {
        void audio.play().catch(() => undefined);
      }
    } else {
      void audio.play().catch(() => undefined);
    }

    return () => {
      audio.pause();
      cleanup();
    };
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
        setStream(null);
        setIsRecording(false);
        if (blob.size > 0) {
          void uploadRecording(blob);
        }
      };
      recorder.start();
      recorderRef.current = { recorder, stream };
      setStream(stream);
      setIsRecording(true);
    } catch (recordError) {
      setError(
        recordError instanceof Error
          ? recordError.message
          : 'Could not start the microphone.'
      );
      setIsRecording(false);
    }
  }

  function stopPlayback() {
    const audio = playbackAudioRef.current;
    if (audio) audio.pause(); // onpause triggers cleanup
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
    isPlayingBack,
    playbackAnalyser,
    error,
    stream,
    startRecording,
    stopRecording,
    stopPlayback,
  };
}
