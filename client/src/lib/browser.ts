export const capabilities = {
  webrtc: typeof window !== 'undefined' && typeof window.RTCPeerConnection === 'function',
  microphone: typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia),
  screenShare: typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia),
  camera: typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.enumerateDevices),
  /** `HTMLMediaElement.setSinkId` — output device selection (Chromium, Firefox 116+). */
  outputSelection:
    typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype,
  secureContext: typeof window !== 'undefined' && window.isSecureContext,
};

export function isBrowserSupported(): boolean {
  return capabilities.webrtc && capabilities.secureContext && Boolean(navigator.mediaDevices);
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'submit', 'range', 'color'].includes(type);
  }
  return target.getAttribute('role') === 'combobox';
}
