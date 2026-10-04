import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/lib/cn';
import { MAX_ZOOM, MIN_ZOOM, useUi } from '@/stores/uiStore';

interface VideoSurfaceProps {
  stream: MediaStream;
  muted?: boolean;
  label: string;
  interactive?: boolean;
  onPlaying?: () => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * The video element itself, on true black. Aspect ratio is always preserved (`contain`
 * letterboxes, `cover` crops). Zoom/pan is a GPU transform — no re-layout, no re-decode.
 */
export function VideoSurface({
  stream,
  muted = true,
  label,
  interactive = true,
  onPlaying,
}: VideoSurfaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fit = useUi((s) => s.stage.fit);
  const zoom = useUi((s) => s.stage.zoom);
  const panX = useUi((s) => s.stage.panX);
  const panY = useUi((s) => s.stage.panY);
  const setStage = useUi((s) => s.setStage);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.srcObject !== stream) video.srcObject = stream;
    void video.play().catch(() => undefined);
  }, [stream]);

  // Ctrl/⌘ + wheel zoom. Native listener: React's wheel handler is passive and can't preventDefault.
  useEffect(() => {
    const box = boxRef.current;
    if (!box || !interactive) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const current = useUi.getState().stage.zoom;
      const next = clamp(current * (e.deltaY < 0 ? 1.1 : 1 / 1.1), MIN_ZOOM, MAX_ZOOM);
      useUi.getState().setStage(next <= 1.01 ? { zoom: 1, panX: 0, panY: 0 } : { zoom: next });
    };
    box.addEventListener('wheel', onWheel, { passive: false });
    return () => box.removeEventListener('wheel', onWheel);
  }, [interactive]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!interactive || zoom <= 1 || e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, panX, panY };
    setDragging(true);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    const box = boxRef.current;
    if (!d || !box) return;
    const limX = ((zoom - 1) * box.clientWidth) / 2 / zoom;
    const limY = ((zoom - 1) * box.clientHeight) / 2 / zoom;
    setStage({
      panX: clamp(d.panX + (e.clientX - d.x) / zoom, -limX, limX),
      panY: clamp(d.panY + (e.clientY - d.y) / zoom, -limY, limY),
    });
  };

  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  return (
    <div
      ref={boxRef}
      className={cn(
        'absolute inset-0 overflow-hidden bg-stage',
        interactive && zoom > 1 && (dragging ? 'cursor-grabbing' : 'cursor-grab'),
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() =>
        interactive && setStage(zoom > 1 ? { zoom: 1, panX: 0, panY: 0 } : { zoom: 2 })
      }
    >
      <video
        ref={videoRef}
        aria-label={label}
        autoPlay
        playsInline
        muted={muted}
        onPlaying={onPlaying}
        className={cn('size-full select-none', fit === 'cover' ? 'object-cover' : 'object-contain')}
        style={{
          transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
          transition: dragging ? 'none' : 'transform 120ms ease-out',
        }}
      />
    </div>
  );
}
