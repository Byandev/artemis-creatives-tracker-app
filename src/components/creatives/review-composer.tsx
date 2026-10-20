import { Check, MapPin, Mic, RotateCcw, SendHorizontal, Square, Timer, X, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MarkPin } from '@/components/creatives/image-annotator';
import { VoicePlayer } from '@/components/creatives/voice-player';
import { RecordingIndicator, useVoiceRecorder, type VoiceRecording } from '@/components/creatives/voice-recorder';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { ApiError, creativesApi } from '@/lib/api';
import { publishCreative } from '@/lib/creative-store';
import { formatTimestamp, type Creative, type Region, type ReviewStatus } from '@/lib/creatives';
import { useSession } from '@/providers/session';

const MAX_FEEDBACK = 2000;

// Full class strings so Tailwind picks them up.
const CHOICES: {
  value: ReviewStatus;
  label: string;
  icon: LucideIcon;
  active: string;
  iconClass: string;
  tone: 'approved' | 'rejected';
}[] = [
  {
    value: 'approved',
    label: 'Approve',
    icon: Check,
    active: 'bg-approved-fill border-approved-border',
    iconClass: 'text-approved',
    tone: 'approved',
  },
  {
    value: 'revision',
    label: 'For Revision',
    icon: RotateCcw,
    active: 'bg-rejected-fill border-rejected-border',
    iconClass: 'text-rejected',
    tone: 'rejected',
  },
];

/**
 * Leave a review from a bar pinned to the bottom of the screen, like a comment box: a status is
 * required (same as the web app); written feedback and a voice message are both optional, and the
 * mic sits beside the feedback field.
 * On an uploaded image the review can also point at an area of it (`region`, picked by the parent);
 * on a video, at a moment of it (`timestamp`, read from the player by the parent).
 * The saved creative is published, so the lists move it (e.g. out of "Needs review").
 */
export function ReviewComposer({
  creative,
  region = null,
  onMarkArea,
  onClearRegion,
  timestamp = null,
  onPinTime,
  onClearTimestamp,
}: {
  creative: Creative;
  region?: Region | null;
  /** Opens the area picker; only given when the image can be marked up. */
  onMarkArea?: () => void;
  onClearRegion?: () => void;
  timestamp?: number | null;
  /** Pins the video's current moment; returns false when the video hasn't been played. Videos only. */
  onPinTime?: () => boolean;
  onClearTimestamp?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { token, signOut } = useSession();
  const [status, setStatus] = useState<ReviewStatus | null>(null);
  const [feedback, setFeedback] = useState('');
  const [voice, setVoice] = useState<VoiceRecording | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const recorder = useVoiceRecorder(setVoice);

  async function submit() {
    if (!token || !status || saving || recorder.isRecording) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await creativesApi.review(token, creative.id, {
        status,
        feedback: feedback.trim() || undefined,
        voice: voice ?? undefined,
        region,
        timestampSeconds: timestamp,
      });
      publishCreative(data);
      setStatus(null);
      setFeedback('');
      setVoice(null);
      onClearRegion?.();
      onClearTimestamp?.();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await signOut();
        return;
      }
      setError(
        err instanceof ApiError && err.status === 422
          ? (Object.values(err.fieldErrors)[0] ?? err.message)
          : err instanceof ApiError && err.status < 500
            ? err.message
            : 'Couldn’t send your review. Try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  const canSend = !!status && !saving && !recorder.isRecording;
  const message = error ?? recorder.error;

  return (
    <View className="gap-2 border-t border-divider bg-surface px-4 pt-2.5" style={{ paddingBottom: insets.bottom + 10 }}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Review status" className="flex-row gap-2">
        {CHOICES.map((choice) => {
          const active = status === choice.value;
          return (
            <Pressable
              key={choice.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => setStatus(active ? null : choice.value)}
              className={`h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border ${
                active ? choice.active : 'border-input-border bg-background active:bg-row-hover'
              }`}>
              <Icon as={choice.icon} size={14} className={active ? choice.iconClass : 'text-muted'} />
              <ThemedText type={active ? 'labelActive' : 'label'} tone={active ? choice.tone : 'default'}>
                {choice.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {/* What's attached to this review so far; nothing shows until something is. */}
      {voice && !recorder.isRecording && (
        <View className="flex-row items-center gap-1">
          <VoicePlayer uri={voice.uri} durationSeconds={voice.durationSeconds} compact />
          <RemoveButton label="Delete voice message" disabled={saving} onPress={() => setVoice(null)} />
        </View>
      )}

      {(region || timestamp !== null) && (
        <View className="flex-row flex-wrap gap-2">
          {region && (
            <AttachmentChip
              lead={<MarkPin n="+" status="draft" size={18} />}
              label={region.w === 0 && region.h === 0 ? 'Point marked' : 'Area marked'}
              onPress={onMarkArea}
              pressLabel="Change the marked area"
              removeLabel="Remove the marked area"
              disabled={saving}
              onRemove={onClearRegion}
            />
          )}
          {timestamp !== null && (
            <AttachmentChip
              lead={
                <View className="size-[18px] items-center justify-center rounded-full bg-primary">
                  <Icon as={Timer} size={10} className="text-on-button" />
                </View>
              }
              label={`At ${formatTimestamp(timestamp)}`}
              removeLabel="Remove the pinned moment"
              disabled={saving}
              onRemove={onClearTimestamp}
            />
          )}
        </View>
      )}

      <View className="flex-row items-end gap-2">
        {recorder.isRecording ? (
          <>
            <RecordingIndicator elapsedSeconds={recorder.elapsedSeconds} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Stop recording"
              onPress={recorder.stop}
              className="size-11 items-center justify-center rounded-full bg-rejected-dot active:opacity-80">
              <Icon as={Square} size={14} className="text-white" />
            </Pressable>
          </>
        ) : (
          // The field and its attach buttons share one rounded box, like a chat app.
          <View
            className={`min-h-11 flex-1 flex-row items-end rounded-[22px] border bg-background pl-4 pr-1 ${
              focused ? 'border-primary' : 'border-input-border'
            }`}>
            <TextInput
              value={feedback}
              onChangeText={setFeedback}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={status ? 'Add feedback…' : 'Pick a status first'}
              placeholderTextColorClassName="accent-placeholder"
              selectionColorClassName="accent-primary"
              cursorColorClassName="accent-primary"
              accessibilityLabel="Feedback"
              multiline
              // One line to start on web too (a textarea defaults to two), growing up to max-h.
              {...(Platform.OS === 'web' ? { rows: 1 } : {})}
              maxLength={MAX_FEEDBACK}
              textAlignVertical="center"
              className="max-h-32 min-h-[42px] flex-1 py-2.5 font-sans text-[15px] text-foreground web:resize-none web:outline-none"
            />
            <View className="h-[42px] flex-row items-center">
              {onPinTime && (
                <FieldButton
                  icon={Timer}
                  accessibilityLabel={timestamp !== null ? 'Pin the current moment instead' : 'Pin the current moment of the video'}
                  active={timestamp !== null}
                  disabled={saving}
                  onPress={() => setError(onPinTime() ? null : 'Play the video, pause where you mean, then pin the moment.')}
                />
              )}
              {onMarkArea && (
                <FieldButton
                  icon={MapPin}
                  accessibilityLabel={region ? 'Change the marked area' : 'Mark an area on the image'}
                  active={!!region}
                  disabled={saving}
                  onPress={onMarkArea}
                />
              )}
              <FieldButton
                icon={Mic}
                accessibilityLabel={voice ? 'Record the voice message again' : 'Record a voice message'}
                active={!!voice}
                disabled={saving}
                onPress={recorder.start}
              />
            </View>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send review"
          accessibilityState={{ disabled: !canSend, busy: saving }}
          disabled={!canSend}
          onPress={submit}
          className="size-11 items-center justify-center rounded-full bg-button active:bg-button-pressed disabled:opacity-40">
          {saving ? (
            <ActivityIndicator size="small" colorClassName="accent-on-button" />
          ) : (
            <Icon as={SendHorizontal} size={18} className="text-on-button" />
          )}
        </Pressable>
      </View>

      {message && (
        <ThemedText type="meta" tone="rejected" accessibilityLiveRegion="polite">
          {message}
        </ThemedText>
      )}
    </View>
  );
}

/** An attach button inside the feedback field. */
function FieldButton({
  icon,
  accessibilityLabel,
  active,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  accessibilityLabel: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`size-9 items-center justify-center rounded-full active:bg-row-hover disabled:opacity-50 ${active ? 'bg-badge-active' : ''}`}>
      <Icon as={icon} size={18} className={active ? 'text-primary' : 'text-muted'} />
    </Pressable>
  );
}

/** Something attached to the review being written: tap to change it (when possible), × to drop it. */
function AttachmentChip({
  lead,
  label,
  onPress,
  pressLabel,
  removeLabel,
  disabled,
  onRemove,
}: {
  lead: ReactNode;
  label: string;
  onPress?: () => void;
  pressLabel?: string;
  removeLabel: string;
  disabled?: boolean;
  onRemove?: () => void;
}) {
  return (
    <View className="h-8 flex-row items-center rounded-full border border-approved-border bg-badge-active">
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={pressLabel}
        disabled={!onPress || disabled}
        onPress={onPress}
        className="h-full flex-row items-center gap-1.5 rounded-full pl-1.5 pr-1">
        {lead}
        <ThemedText type="labelActive" tone="primary">
          {label}
        </ThemedText>
      </Pressable>
      <RemoveButton label={removeLabel} disabled={disabled} onPress={onRemove} small />
    </View>
  );
}

function RemoveButton({
  label,
  disabled,
  onPress,
  small,
}: {
  label: string;
  disabled?: boolean;
  onPress?: () => void;
  small?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      disabled={disabled}
      onPress={onPress}
      className={`items-center justify-center rounded-full active:bg-row-hover ${small ? 'mr-1 size-6' : 'size-9'}`}>
      <Icon as={X} size={small ? 13 : 16} className={small ? 'text-primary' : 'text-muted'} />
    </Pressable>
  );
}
