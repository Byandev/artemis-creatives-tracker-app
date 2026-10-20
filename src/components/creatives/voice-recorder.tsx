import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { formatTimestamp } from '@/lib/creatives';

/** Same cap as the web recorder. */
const MAX_SECONDS = 5 * 60;

export type VoiceRecording = { uri: string; mimeType: string; durationSeconds: number };

/** WebM where the browser records it (Chrome, Firefox), MP4 elsewhere (Safari). */
function webMimeType() {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  return MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
}

/** Mono speech: a fraction of the music-quality preset's size. Phones record AAC in .m4a. */
const OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64000,
  web: { mimeType: Platform.OS === 'web' ? webMimeType() : 'audio/webm', bitsPerSecond: 64000 },
};

/**
 * Record a voice message for a review. The composer lays out the controls (a mic button beside
 * the feedback field); `onRecorded` gets the finished recording.
 */
export function useVoiceRecorder(onRecorded: (recording: VoiceRecording) => void) {
  const recorder = useAudioRecorder(OPTIONS);
  const state = useAudioRecorderState(recorder, 250);
  const [error, setError] = useState<string | null>(null);
  // Wall-clock start and the cap timer, so `stop` never depends on a stale render.
  const startedAt = useRef(0);
  const capTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (capTimer.current) clearTimeout(capTimer.current);
    },
    [],
  );

  async function start() {
    setError(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone access is off. Allow it in your settings to record a voice message.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAt.current = Date.now();
      // Stop at the cap, like the web recorder.
      capTimer.current = setTimeout(stop, MAX_SECONDS * 1000);
    } catch {
      setError('Couldn’t start recording. Try again.');
    }
  }

  async function stop() {
    if (capTimer.current) clearTimeout(capTimer.current);
    capTimer.current = null;
    const durationSeconds = Math.min(MAX_SECONDS, Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)));
    try {
      await recorder.stop();
    } finally {
      // Back to playback mode, or iOS keeps routing audio to the earpiece.
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    }
    if (recorder.uri) {
      onRecorded({
        uri: recorder.uri,
        mimeType: Platform.OS === 'web' ? (OPTIONS.web?.mimeType ?? 'audio/webm') : 'audio/mp4',
        durationSeconds,
      });
    } else {
      setError('Couldn’t save the recording. Try again.');
    }
  }

  return { isRecording: state.isRecording, elapsedSeconds: state.durationMillis / 1000, error, start, stop };
}

/** "Recording 0:12 / 5:00", shown in place of the feedback field while recording. */
export function RecordingIndicator({ elapsedSeconds }: { elapsedSeconds: number }) {
  return (
    <View className="min-h-11 flex-1 flex-row items-center gap-2.5 rounded-[22px] border border-rejected-border bg-rejected-fill px-4">
      <View className="size-2.5 rounded-full bg-rejected-dot" />
      <ThemedText type="labelActive" tone="rejected" className="flex-1">
        Recording {formatTimestamp(elapsedSeconds)}
        <ThemedText type="meta" tone="muted">
          {'  '}/ {formatTimestamp(MAX_SECONDS)}
        </ThemedText>
      </ThemedText>
    </View>
  );
}
