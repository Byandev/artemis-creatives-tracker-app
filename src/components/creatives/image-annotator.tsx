import { Image, type ImageLoadEventData } from 'expo-image';
import { useState } from 'react';
import { Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

import type { CreativeStatus } from '@/constants/theme';
import type { Region } from '@/lib/creatives';

export type Mark = {
  id: number;
  /** The number shown on the image and on the matching review. */
  n: number;
  region: Region;
  status: CreativeStatus;
};

/** Below this (as a fraction of the image) a drag counts as a tap: a point. Same as the web. */
const POINT_THRESHOLD = 0.01;
const PIN = 22;

// Full class strings so Tailwind picks them up.
const MARK_CLASSES: Record<CreativeStatus, { box: string; badge: string }> = {
  pending: { box: 'border-pending-dot', badge: 'bg-pending-dot' },
  approved: { box: 'border-approved-dot', badge: 'bg-approved-dot' },
  revision: { box: 'border-rejected-dot', badge: 'bg-rejected-dot' },
};
const DRAFT_CLASSES = { box: 'border-primary border-dashed', badge: 'bg-primary' };

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Box from two corners, in either drag direction. */
function boxFrom(a: { x: number; y: number }, b: { x: number; y: number }): Region {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

type Size = { width: number; height: number };

type ImageAnnotatorProps = {
  uri: string;
  marks: Mark[];
  /** The area picked for the review not sent yet. */
  draft?: Region | null;
  /** When given, dragging draws a box and tapping drops a point. */
  onDraw?: (region: Region) => void;
  highlightId?: number | null;
  onLoad?: () => void;
  onError?: () => void;
};

/**
 * An image fitted inside its parent (contain), with review marks laid over the exact pixels of
 * the picture, not the letterbox around it. Regions are fractions of the image, like the web's.
 */
export function ImageAnnotator({ uri, marks, draft, onDraw, highlightId, onLoad, onError }: ImageAnnotatorProps) {
  const [container, setContainer] = useState<Size | null>(null);
  const [natural, setNatural] = useState<Size | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragBox, setDragBox] = useState<Region | null>(null);

  // Where the picture actually sits under contain.
  let frame: { left: number; top: number; width: number; height: number } | null = null;
  if (container && natural && natural.width > 0 && natural.height > 0) {
    const scale = Math.min(container.width / natural.width, container.height / natural.height);
    const width = natural.width * scale;
    const height = natural.height * scale;
    frame = { left: (container.width - width) / 2, top: (container.height - height) / 2, width, height };
  }

  function toFraction(event: GestureResponderEvent) {
    if (!frame) return { x: 0, y: 0 };
    return {
      x: clamp(event.nativeEvent.locationX / frame.width),
      y: clamp(event.nativeEvent.locationY / frame.height),
    };
  }

  function finish(event: GestureResponderEvent) {
    if (!dragStart || !onDraw) return;
    const box = boxFrom(dragStart, toFraction(event));
    setDragStart(null);
    setDragBox(null);
    onDraw(
      box.w < POINT_THRESHOLD && box.h < POINT_THRESHOLD ? { x: dragStart.x, y: dragStart.y, w: 0, h: 0 } : box,
    );
  }

  const shownDraft = dragBox ?? draft ?? null;

  return (
    <View
      style={{ flex: 1 }}
      onLayout={(event: LayoutChangeEvent) => setContainer(event.nativeEvent.layout)}>
      <Image
        source={uri}
        contentFit="contain"
        transition={150}
        onLoad={(event: ImageLoadEventData) => {
          setNatural({ width: event.source.width, height: event.source.height });
          onLoad?.();
        }}
        onError={onError}
        accessibilityIgnoresInvertColors
        style={{ position: 'absolute', inset: 0 }}
      />

      {frame && (
        <View
          style={{ position: 'absolute', ...frame }}
          pointerEvents={onDraw ? 'auto' : 'none'}
          // The responder system works the same on phones and the web.
          onStartShouldSetResponder={() => !!onDraw}
          onMoveShouldSetResponder={() => !!onDraw}
          onResponderTerminationRequest={() => false}
          onResponderGrant={(event) => {
            const point = toFraction(event);
            setDragStart(point);
            setDragBox({ ...point, w: 0, h: 0 });
          }}
          onResponderMove={(event) => {
            if (dragStart) setDragBox(boxFrom(dragStart, toFraction(event)));
          }}
          onResponderRelease={finish}
          onResponderTerminate={() => {
            setDragStart(null);
            setDragBox(null);
          }}>
          {/* Shapes never take the touch, so locationX/Y stay relative to the image. */}
          <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
            {marks.map((mark) => (
              <RegionShape
                key={mark.id}
                region={mark.region}
                frame={frame}
                classes={MARK_CLASSES[mark.status]}
                label={String(mark.n)}
                dimmed={highlightId != null && highlightId !== mark.id}
              />
            ))}
            {shownDraft && <RegionShape region={shownDraft} frame={frame} classes={DRAFT_CLASSES} label="+" />}
          </View>
        </View>
      )}
    </View>
  );
}

function PinBadge({ label, badgeClass, size = PIN }: { label: string; badgeClass: string; size?: number }) {
  return (
    <View
      className={`items-center justify-center rounded-full border-2 border-white ${badgeClass}`}
      style={{ width: size, height: size }}>
      <Text className="font-sans-bold text-[11px] text-white">{label}</Text>
    </View>
  );
}

/** The numbered pin drawn on the image, for a review or chip to point back at its mark. */
export function MarkPin({ n, status, size = 20 }: { n: number | string; status: CreativeStatus | 'draft'; size?: number }) {
  return (
    <PinBadge
      label={String(n)}
      badgeClass={status === 'draft' ? DRAFT_CLASSES.badge : MARK_CLASSES[status].badge}
      size={size}
    />
  );
}

function RegionShape({
  region,
  frame,
  classes,
  label,
  dimmed,
}: {
  region: Region;
  frame: Size;
  classes: { box: string; badge: string };
  label: string;
  dimmed?: boolean;
}) {
  const left = region.x * frame.width;
  const top = region.y * frame.height;
  const isPoint = region.w === 0 && region.h === 0;

  const badge = <PinBadge label={label} badgeClass={classes.badge} />;

  if (isPoint) {
    return (
      <View style={{ position: 'absolute', left: left - PIN / 2, top: top - PIN / 2, opacity: dimmed ? 0.35 : 1 }}>
        {badge}
      </View>
    );
  }

  return (
    <View
      className={`rounded-sm border-2 ${classes.box}`}
      style={{
        position: 'absolute',
        left,
        top,
        width: region.w * frame.width,
        height: region.h * frame.height,
        opacity: dimmed ? 0.35 : 1,
      }}>
      <View style={{ position: 'absolute', left: -PIN / 2, top: -PIN / 2 }}>{badge}</View>
    </View>
  );
}
