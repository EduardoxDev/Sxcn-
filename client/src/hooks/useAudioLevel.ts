import { useEffect, useState } from 'react';
import { getAudioContext, readLevel } from '@/services/media/audioContext';

/** Smoothed 0..1 input level of a stream, for meters. Sampled ~20×/s. */
export function useAudioLevel(stream: MediaStream | null, enabled = true): number {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!stream || !enabled || stream.getAudioTracks().length === 0) return;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let timer = 0;
    let smoothed = 0;
    try {
      const ctx = getAudioContext();
      source = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const buffer = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));
      timer = window.setInterval(() => {
        const raw = Math.min(1, readLevel(analyser!, buffer) * 6);
        smoothed = raw > smoothed ? raw : smoothed * 0.8 + raw * 0.2;
        setLevel(smoothed < 0.01 ? 0 : smoothed);
      }, 50);
    } catch {
      /* analysis unavailable — the meter simply stays flat */
    }
    return () => {
      window.clearInterval(timer);
      source?.disconnect();
      setLevel(0);
    };
  }, [stream, enabled]);

  return level;
}
