import { Image } from 'expo-image';
import { router } from 'expo-router';
import { CircleCheck, Image as ImageIcon, Play } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { StatusLabel } from '@/components/creatives/status-label';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { IconSize, Spacing, StatusLabels } from '@/constants/theme';
import { creativePreview, finalStatusBadge, formatCreativeDate, type Creative } from '@/lib/creatives';

type CreativeRowProps = {
  creative: Creative;
  /** Opens the final status picker; only passed when the user may change it. */
  onChangeStatus?: (creative: Creative) => void;
};

export function CreativeRow({ creative, onChangeStatus }: CreativeRowProps) {
  const formatLabel = creative.format === 'video' ? 'Video' : 'Image';
  const group = creative.product?.title ?? creative.workspace.name;
  const date = formatCreativeDate(creative.creative_date);
  const status = finalStatusBadge(creative.final_status);
  const statusLabel = StatusLabels[status];
  const reviewed = creative.my_review !== null;

  function open() {
    router.push({ pathname: '/creatives/[id]', params: { id: String(creative.id) } });
  }

  // The status badge is its own button, and buttons can't nest (invalid HTML on web). So the
  // row's tap target is a full-size Pressable underneath, and the content above it lets taps
  // through everywhere except the badge.
  return (
    <View className="flex-row items-center gap-3 border-b border-divider bg-background px-4 py-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${creative.name}, ${formatLabel}, ${group}, ${date ?? 'no date'}, ${statusLabel}, ${reviewed ? 'reviewed by you' : 'not reviewed yet'}`}
        accessibilityHint="Opens the creative"
        onPress={open}
        className="absolute inset-0 active:bg-row-hover"
      />

      <View pointerEvents="none">
        <Thumbnail creative={creative} />
      </View>

      <View pointerEvents="box-none" className="flex-1 gap-0.5">
        <View pointerEvents="none" className="gap-0.5">
          <ThemedText type="rowTitle" numberOfLines={1}>
            {creative.name}
          </ThemedText>
          <ThemedText tone="muted" numberOfLines={1}>
            {formatLabel} · {group}
          </ThemedText>
        </View>
        <View pointerEvents="box-none" className="mt-1 flex-row items-center justify-between gap-2">
          <View pointerEvents="none" className="flex-row items-center gap-2">
            <ThemedText type="meta" tone="muted">
              {date ?? 'No date'}
            </ThemedText>
            {reviewed && (
              <View className="flex-row items-center gap-1">
                <Icon as={CircleCheck} size={14} className="text-approved" />
                <ThemedText type="caption" tone="approved">
                  Reviewed
                </ThemedText>
              </View>
            )}
          </View>
          {onChangeStatus ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Final status: ${StatusLabels[status]}. Change`}
              hitSlop={Spacing[2]}
              onPress={() => onChangeStatus(creative)}>
              <StatusLabel status={status} label={statusLabel} editable />
            </Pressable>
          ) : (
            <View pointerEvents="none">
              <StatusLabel status={status} label={statusLabel} />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * 56×56 preview. The format placeholder (image or video) is always drawn, and the real picture
 * is layered on top only if one exists and loads, so a broken link never leaves a blank square.
 */
function Thumbnail({ creative }: { creative: Creative }) {
  // Only images become thumbnails; a video keeps the play placeholder (no frame to show yet).
  const preview = creativePreview(creative);
  const uri = preview?.kind === 'image' ? preview.uri : null;
  const [failed, setFailed] = useState(false);
  const isVideo = creative.format === 'video';
  const showImage = uri !== null && !failed;

  return (
    <View
      className={`size-14 items-center justify-center overflow-hidden rounded-md ${
        isVideo ? 'bg-badge-active' : 'bg-badge'
      }`}>
      {isVideo ? (
        <View className="size-8 items-center justify-center rounded-full bg-primary pl-0.5">
          <Icon as={Play} size={16} className="text-background" />
        </View>
      ) : (
        <Icon as={ImageIcon} size={IconSize.thumbnail} className="text-muted" />
      )}

      {showImage && (
        <Image
          source={uri}
          contentFit="cover"
          transition={150}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
          style={{ position: 'absolute', inset: 0 }}
        />
      )}

      {/* Keep the play badge visible on top of real video thumbnails. */}
      {showImage && isVideo && (
        <View className="absolute size-7 items-center justify-center rounded-full bg-black/55 pl-0.5">
          <Icon as={Play} size={14} className="text-white" />
        </View>
      )}
    </View>
  );
}
