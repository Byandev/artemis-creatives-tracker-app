import { Image } from 'expo-image';
import { Image as ImageIcon, Play } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { StatusLabel } from '@/components/creatives/status-label';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { IconSize } from '@/constants/theme';
import { formatCreativeDate, previewUrl, reviewStatus, type AssignedCreative } from '@/lib/creatives';

export function CreativeRow({ creative }: { creative: AssignedCreative }) {
  const formatLabel = creative.format === 'video' ? 'Video' : 'Image';
  const group = creative.product?.title ?? creative.workspace.name;
  const date = formatCreativeDate(creative.creative_date);

  return (
    <View
      accessible
      accessibilityLabel={`${creative.name}, ${formatLabel}, ${group}, ${date ?? 'no date'}, pending review`}
      className="flex-row items-center gap-3 border-b border-divider bg-background px-4 py-3">
      <Thumbnail creative={creative} />

      <View className="flex-1 gap-0.5">
        <ThemedText type="rowTitle" numberOfLines={1}>
          {creative.name}
        </ThemedText>
        <ThemedText tone="muted" numberOfLines={1}>
          {formatLabel} · {group}
        </ThemedText>
        <View className="mt-1 flex-row items-center justify-between gap-2">
          <ThemedText type="meta" tone="muted">
            {date ?? 'No date'}
          </ThemedText>
          <StatusLabel status={reviewStatus(creative)} />
        </View>
      </View>
    </View>
  );
}

/**
 * 56×56 preview. The format placeholder (image or video) is always drawn, and the real picture
 * is layered on top only if one exists and loads, so a broken link never leaves a blank square.
 */
function Thumbnail({ creative }: { creative: AssignedCreative }) {
  const uri = previewUrl(creative.picture_url);
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
