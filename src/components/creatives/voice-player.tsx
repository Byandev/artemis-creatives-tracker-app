import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pause, Play } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { formatTimestamp } from '@/lib/creatives';

type VoicePlayerProps = {
  /** Remote (signed) URL or a local recording's uri. */
  uri: string;
  /** Known length, shown before the audio loads (WebM from Chrome often has none). */
  durationSeconds?: number | null;
  /** Smaller, for the recording attached to the review being written. */
  compact?: boolean;
};

/**
 * A voice message, chat-app style: play button, waveform that fills as it plays, and the time.
 * Nothing is downloaded until the first tap, so a screen full of reviews doesn't fetch every
 * recording up front.
 */
export function VoicePlayer({ uri, durationSeconds, compact }: VoicePlayerProps) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const bars = useMemo(() => waveform(uri, compact ? 18 : 32), [uri, compact]);

  const duration = status.duration > 0 && Number.isFinite(status.duration) ? status.duration : (durationSeconds ?? 0);
  const atEnd = status.didJustFinish || (duration > 0 && status.currentTime >= duration - 0.05);
  const loading = loadedUri !== null && !status.isLoaded && !status.error;
  const started = status.playing || (status.currentTime > 0 && !atEnd);
  const progress = duration > 0 && started ? Math.min(1, status.currentTime / duration) : 0;

  function toggle() {
    if (status.playing) {
      player.pause();
      return;
    }
    if (loadedUri !== uri) {
      player.replace(uri);
      setLoadedUri(uri);
    } else if (atEnd) {
      player.seekTo(0);
    }
    player.play();
  }

  const time = started ? formatTimestamp(status.currentTime) : duration > 0 ? formatTimestamp(duration) : '–:––';

  return (
    <View className={compact ? 'flex-1' : 'gap-1'}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${status.playing ? 'Pause' : 'Play'} voice message${duration > 0 ? `, ${formatTimestamp(duration)}` : ''}`}
        onPress={toggle}
        className={`flex-row items-center rounded-full border border-border bg-background active:bg-row-hover ${
          compact ? 'h-9 gap-2 pl-1 pr-3' : 'h-12 gap-3 pl-1.5 pr-4'
        }`}>
        <View className={`items-center justify-center rounded-full bg-primary ${compact ? 'size-7' : 'size-9'}`}>
          {loading || (status.playing && status.isBuffering) ? (
            <ActivityIndicator size="small" colorClassName="accent-on-button" />
          ) : (
            <Icon
              as={status.playing ? Pause : Play}
              size={compact ? 12 : 15}
              className={`text-on-button ${status.playing ? '' : 'ml-0.5'}`}
            />
          )}
        </View>

        <View className="h-7 flex-1 flex-row items-center justify-between" pointerEvents="none">
          {bars.map((height, index) => {
            const played = (index + 0.5) / bars.length <= progress;
            return (
              <View
                key={index}
                className={`w-[3px] rounded-full ${played ? 'bg-primary' : 'bg-chevron'}`}
                style={{ height: `${height * 100}%`, opacity: played ? 1 : 0.45 }}
              />
            );
          })}
        </View>

        <ThemedText type="metaMedium" tone={started ? 'primary' : 'muted'} className="min-w-8 text-right">
          {time}
        </ThemedText>
      </Pressable>
      {status.error ? (
        <ThemedText type="meta" tone="rejected" className={compact ? 'mt-1' : ''}>
          Couldn’t play this voice message.
        </ThemedText>
      ) : null}
    </View>
  );
}

/**
 * Bar heights (0.25–1) that look like speech. The audio is never decoded, so the shape is made
 * up, but seeded by the recording so each message keeps its own.
 */
function waveform(seed: string, count: number) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  const random = () => {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return ((hash ^= hash >>> 16) >>> 0) / 4294967296;
  };
  // Louder in the middle, quieter at both ends, like a sentence.
  return Array.from({ length: count }, (_, i) => {
    const envelope = Math.sin((Math.PI * (i + 0.5)) / count);
    return Math.max(0.25, Math.min(1, 0.3 + envelope * 0.45 + random() * 0.35));
  });
}
