'use client';

import { useEffect, useRef } from 'react';

type Props = {
  stream?: MediaStream | null;
  analyser?: AnalyserNode | null;
  className?: string;
  color?: string;
  bars?: number;
};

export default function MicLevelMeter({
  stream,
  analyser: externalAnalyser,
  className,
  color = '#f97316',
  bars = 28,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!stream && !externalAnalyser) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };
    resize();

    // Use the external analyser (playback) if provided, otherwise build one
    // from the MediaStream (recording).
    let analyserNode: AnalyserNode | null = externalAnalyser ?? null;
    let audioCtx: AudioContext | null = null;
    let streamSource: MediaStreamAudioSourceNode | null = null;

    if (!analyserNode && stream) {
      const AudioCtor: typeof AudioContext | undefined =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtor) return;
      audioCtx = new AudioCtor();
      streamSource = audioCtx.createMediaStreamSource(stream);
      analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 256;
      analyserNode.smoothingTimeConstant = 0.7;
      streamSource.connect(analyserNode);
    }

    if (!analyserNode) return;

    const data = new Uint8Array(analyserNode.frequencyBinCount);
    const step = Math.max(1, Math.floor(data.length / bars));

    let raf = 0;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const gap = 2 * dpr;
      const barWidth = (w - gap * (bars - 1)) / bars;
      const minBar = 2 * dpr;
      const radius = barWidth / 2;

      analyserNode!.getByteFrequencyData(data);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;

      for (let i = 0; i < bars; i++) {
        const raw = data[i * step] / 255;
        const v = Math.pow(raw, 0.7);
        const barHeight = Math.max(minBar, v * h);
        const x = i * (barWidth + gap);
        const y = (h - barHeight) / 2;
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, radius);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, barWidth, barHeight);
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      // Only tear down AudioContext if we created it (stream mode).
      // External analyser lifetime is managed by the hook.
      if (streamSource) { try { streamSource.disconnect(); } catch { /* noop */ } }
      if (audioCtx) { try { void audioCtx.close(); } catch { /* noop */ } }
    };
  }, [stream, externalAnalyser, color, bars]);

  return <canvas ref={canvasRef} className={className} />;
}
