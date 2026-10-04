export type QualityPreset = 'auto' | '1080p' | '720p';
export type FrameRate = 30 | 60;
export type Optimization = 'detail' | 'motion';

export interface ScreenSettings {
  quality: QualityPreset;
  fps: FrameRate;
  optimization: Optimization;
}

interface PresetSpec {
  width: number;
  height: number;
  /** Bits per second at 30 fps, per viewer. */
  bitrate30: number;
  bitrate60: number;
}

const PRESETS: Record<QualityPreset, PresetSpec> = {
  auto: { width: 1920, height: 1080, bitrate30: 2_500_000, bitrate60: 4_000_000 },
  '1080p': { width: 1920, height: 1080, bitrate30: 4_000_000, bitrate60: 6_000_000 },
  '720p': { width: 1280, height: 720, bitrate30: 1_500_000, bitrate60: 2_500_000 },
};

export const QUALITY_LABELS: Record<QualityPreset, string> = {
  auto: 'Automática',
  '1080p': '1080p',
  '720p': '720p',
};

export function captureConstraints(s: ScreenSettings): MediaTrackConstraints {
  const p = PRESETS[s.quality];
  return {
    width: { max: p.width },
    height: { max: p.height },
    frameRate: { ideal: s.fps, max: s.fps },
  };
}

/**
 * Sender encoding for one viewer. In a mesh the sharer uploads one copy per viewer, so in
 * `auto` mode the budget shrinks as the audience grows. The browser's congestion control
 * still adapts below this ceiling on bad links.
 */
export function encodingFor(s: ScreenSettings, viewers: number): RTCRtpEncodingParameters {
  const p = PRESETS[s.quality];
  let bitrate = s.fps === 60 ? p.bitrate60 : p.bitrate30;
  if (s.quality === 'auto' && viewers > 2)
    bitrate = Math.max(900_000, Math.round((bitrate * 2) / viewers));
  return { maxBitrate: bitrate, maxFramerate: s.fps };
}

/**
 * `detail` keeps text sharp (drops frames under pressure); `motion` keeps it smooth
 * (drops resolution) — better for video or games.
 */
export function degradationFor(o: Optimization): RTCDegradationPreference {
  return o === 'detail' ? 'maintain-resolution' : 'maintain-framerate';
}

export function contentHintFor(o: Optimization): string {
  return o === 'detail' ? 'detail' : 'motion';
}
