import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image as ImageIcon, Maximize2, Play, X } from 'lucide-react-native';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ImageAnnotator, type Mark } from '@/components/creatives/image-annotator';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { creativePreview, type Creative, type Region } from '@/lib/creatives';

// Short enough that the title and tabs still show above the fold.
const BOX = 'h-60 overflow-hidden rounded-lg border border-border';

/** Lets the screen read where the video is and jump to a moment (for timestamped reviews). */
export type VideoControl = {
  /**
   * Pauses the video and returns the exact second on screen, or null before it has been started.
   * Pausing first means the pinned moment is the frame the reviewer is looking at.
   */
  pin: () => number | null;
  /** Starts the video if needed and plays from exactly `seconds`. */
  playAt: (seconds: number) => void;
};

type MediaPreviewProps = {
  creative: Creative;
  videoRef?: Ref<VideoControl>;
  /** Reviews pinned to areas of the image, drawn over it. */
  marks?: Mark[];
  /** The area picked for the review being written. */
  draft?: Region | null;
  /** A mark to bring forward (the others dim), e.g. after tapping it on a review. */
  highlightId?: number | null;
};

/** The creative's image or video, large, for the detail screen. */
export function MediaPreview({ creative, videoRef, marks = [], draft = null, highlightId = null }: MediaPreviewProps) {
  const preview = creativePreview(creative, 1200);

  if (preview?.kind === 'video') return <VideoPreview uri={preview.uri} ref={videoRef} />;
  if (preview?.kind === 'image') return <ImagePreview uri={preview.uri} marks={marks} draft={draft} highlightId={highlightId} />;
  return <Placeholder isVideo={creative.format === 'video'} message="No preview uploaded" />;
}

/**
 * Fits the whole image in the box, with the review marks on it; tap opens it full screen.
 * Falls back if it won't load.
 */
function ImagePreview({
  uri,
  marks,
  draft,
  highlightId,
}: {
  uri: string;
  marks: Mark[];
  draft: Region | null;
  highlightId: number | null;
}) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const [fullScreen, setFullScreen] = useState(false);

  if (state === 'failed') return <Placeholder isVideo={false} message="Couldn’t load the image" />;

  return (
    <>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={`Creative image${marks.length ? `, ${marks.length} marked ${marks.length === 1 ? 'area' : 'areas'}` : ''}. Open full screen`}
        onPress={() => setFullScreen(true)}
        className={`${BOX} bg-black`}>
        {/* A blurred copy fills the sides, so a portrait creative doesn't sit between grey bars. */}
        <Image
          source={uri}
          contentFit="cover"
          blurRadius={24}
          accessibilityIgnoresInvertColors
          style={{ position: 'absolute', inset: 0, opacity: state === 'loaded' ? 0.55 : 0 }}
        />
        <ImageAnnotator
          uri={uri}
          marks={marks}
          draft={draft}
          highlightId={highlightId}
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
        />
        {state === 'loading' ? (
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
            <ActivityIndicator colorClassName="accent-primary" />
          </View>
        ) : (
          <View pointerEvents="none" className="absolute bottom-2 right-2 size-8 items-center justify-center rounded-md bg-black/55">
            <Icon as={Maximize2} size={16} className="text-white" />
          </View>
        )}
      </Pressable>
      <FullScreenImage uri={uri} marks={marks} visible={fullScreen} onClose={() => setFullScreen(false)} />
    </>
  );
}

function FullScreenImage({
  uri,
  marks,
  visible,
  onClose,
}: {
  uri: string;
  marks: Mark[];
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 bg-black">
        <ImageAnnotator uri={uri} marks={marks} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close image"
          onPress={onClose}
          style={{ top: insets.top + 8 }}
          className="absolute right-3 size-11 items-center justify-center rounded-full bg-black/60">
          <Icon as={X} size={22} className="text-white" />
        </Pressable>
      </View>
    </Modal>
  );
}

/** Nothing is downloaded until play is tapped (or a review's timestamp is). */
function VideoPreview({ uri, ref }: { uri: string; ref?: Ref<VideoControl> }) {
  // Where to start playing; null until the video is started.
  const [startAt, setStartAt] = useState<number | null>(null);
  const playing = useRef<VideoControl>(null);

  useImperativeHandle(
    ref,
    () => ({
      pin: () => playing.current?.pin() ?? null,
      playAt: (seconds) => {
        if (playing.current) playing.current.playAt(seconds);
        else setStartAt(seconds);
      },
    }),
    [],
  );

  if (startAt !== null) return <PlayingVideo uri={uri} startAt={startAt} ref={playing} />;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Play video"
      onPress={() => setStartAt(0)}
      className={`${BOX} items-center justify-center gap-3 bg-badge-active`}>
      <View className="size-16 items-center justify-center rounded-full bg-primary pl-1">
        <Icon as={Play} size={28} className="text-background" />
      </View>
      <ThemedText type="meta" tone="muted">
        Tap to play
      </ThemedText>
    </Pressable>
  );
}

/**
 * Streams the video with the platform's own controls (fullscreen included). The player gets
 * its source when it's created and keeps it: swapping the source on a mounted web player makes
 * the next render reload the <video>, which cancels playback.
 */
function PlayingVideo({ uri, startAt, ref }: { uri: string; startAt: number; ref?: Ref<VideoControl> }) {
  const player = useVideoPlayer(uri);
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  useImperativeHandle(
    ref,
    () => ({
      pin: () => {
        player.pause();
        return player.currentTime;
      },
      // An absolute seek: a relative one (seekBy) lands off when the video is still loading,
      // mid-seek or playing. Seeks are frame-exact by default (seekTolerance 0).
      playAt: (seconds) => {
        player.currentTime = seconds;
        player.play();
      },
    }),
    [player],
  );

  // Start once the view is attached; this mounts right after the user's tap.
  useEffect(() => {
    // Set before playing, this is where playback begins, even before the video has loaded.
    // eslint-disable-next-line react-hooks/immutability -- the player is an external object, not React state
    if (startAt > 0) player.currentTime = startAt;
    player.play();
    // Only on mount: later jumps go through playAt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  if (status === 'error') return <Placeholder isVideo message="Couldn’t play the video" />;

  return (
    <View className={`${BOX} bg-black`}>
      <VideoView player={player} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} style={{ flex: 1 }} />
      {status === 'loading' ? (
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          <ActivityIndicator color="#ffffff" />
        </View>
      ) : null}
    </View>
  );
}

function Placeholder({ isVideo, message }: { isVideo: boolean; message: string }) {
  return (
    <View
      accessibilityLabel={message}
      className={`${BOX} items-center justify-center gap-3 ${isVideo ? 'bg-badge-active' : 'bg-badge'}`}>
      {isVideo ? (
        <View className="size-14 items-center justify-center rounded-full bg-primary pl-1">
          <Icon as={Play} size={26} className="text-background" />
        </View>
      ) : (
        <Icon as={ImageIcon} size={40} className="text-muted" />
      )}
      <ThemedText type="meta" tone="muted">
        {message}
      </ThemedText>
    </View>
  );
}
