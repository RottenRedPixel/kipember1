'use client';

import { useEffect, useRef } from 'react';

type Props = {
  stream: MediaStream | null;
  className?: string;
  color?: string;
  bars?: number;
};

export default function MicLevelMeter({
  stream,
  className,
  color = '#f97316',
  bars = 28,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!stream) return;
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

    const AudioCtor: typeof AudioContext | undefined =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) return;

    const audioCtx = new AudioCtor();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    const step = Math.max(1, Math.floor(data.length / bars));

    let raf = 0;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const gap = 2 * dpr;
      const barWidth = (w - gap * (bars - 1)) / bars;
      const minBar = 2 * dpr;
      const radius = barWidth / 2;

      analyser.getByteFrequencyData(data);
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
      try {
        source.disconnect();
      } catch {
        /* noop */
      }
      try {
        void audioCtx.close();
      } catch {
        /* noop */
      }
    };
  }, [stream, color, bars]);

  return <canvas ref={canvasRef} className={className} />;
}
