import { router, useLocalSearchParams } from 'expo-router';
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  CircleCheck,
  Clock,
  ExternalLink,
  FileQuestion,
  MapPin,
  Megaphone,
  MessageSquare,
  Package,
  Play,
  Trash2,
  UserRound,
  WifiOff,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FinalStatusSheet } from '@/components/creatives/final-status-sheet';
import { MarkPin } from '@/components/creatives/image-annotator';
import { MediaPreview, type VideoControl } from '@/components/creatives/media-preview';
import { RegionPicker } from '@/components/creatives/region-picker';
import { ReviewComposer } from '@/components/creatives/review-composer';
import { StatusLabel } from '@/components/creatives/status-label';
import { VoicePlayer } from '@/components/creatives/voice-player';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { StatusLabels, type CreativeStatus } from '@/constants/theme';
import { useCreative } from '@/hooks/use-creative';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, creativesApi } from '@/lib/api';
import { publishCreative } from '@/lib/creative-store';
import {
  canMarkUp,
  creativePreview,
  finalStatusBadge,
  formatCreativeDate,
  formatDateTime,
  formatRelativeTime,
  formatTimestamp,
  reviewMarks,
  reviewStatusBadge,
  type Creative,
  type CreativeReview,
  type Region,
} from '@/lib/creatives';
import { useSession } from '@/providers/session';

// Full class strings so Tailwind picks them up.
const SUBMISSION = {
  late: { label: 'Late', classes: 'bg-rejected-fill border-rejected-border', tone: 'rejected' },
  early: { label: 'Early', classes: 'bg-approved-fill border-approved-border', tone: 'approved' },
  on_time: { label: 'On time', classes: 'bg-approved-fill border-approved-border', tone: 'approved' },
} as const;

const STATUS_DOT: Record<CreativeStatus, string> = {
  pending: 'bg-pending-dot',
  approved: 'bg-approved-dot',
  revision: 'bg-rejected-dot',
};

export default function CreativeDetailScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { creative, error, isLoading, isRefreshing, refresh, retry } = useCreative(Number(id));
  const [statusTarget, setStatusTarget] = useState<Creative | null>(null);
  const [tab, setTab] = useState<Tab>('details');
  // The area of the image the review being written points at, and its full-screen picker.
  const [draftRegion, setDraftRegion] = useState<Region | null>(null);
  const [picking, setPicking] = useState(false);
  // The moment of the video the review being written points at, read from the player.
  const [draftTimestamp, setDraftTimestamp] = useState<number | null>(null);
  const videoRef = useRef<VideoControl>(null);
  const scrollRef = useRef<ScrollView>(null);
  // A review's mark brought forward on the image after tapping it; fades back on its own.
  const [highlightMark, setHighlightMark] = useState<number | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    },
    [],
  );

  function goBack() {
    // Opened straight from a notification or a web link: there's nothing to go back to.
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  let body: ReactNode;
  if (creative) {
    const refreshControl = (
      <RefreshControl
        refreshing={isRefreshing}
        onRefresh={refresh}
        tintColor={theme.primary}
        colors={[theme.primary]}
        progressBackgroundColor={theme.surface}
      />
    );
    const composer = tab === 'reviews' && creative.permissions.review;
    const markable = canMarkUp(creative);
    const marks = markable ? reviewMarks(creative) : [];
    const markNumbers = new Map(marks.map((mark) => [mark.id, mark.n]));
    // The server only takes a timestamp on video creatives; the player has to exist to read one.
    const timestampable = creative.format === 'video' && creativePreview(creative)?.kind === 'video';

    function pinTime() {
      const seconds = videoRef.current?.pin() ?? null;
      if (seconds === null) return false;
      // Hundredths: exact to the frame, without float noise like 12.433333333.
      setDraftTimestamp(Math.round(seconds * 100) / 100);
      return true;
    }

    /** A review's mark chip: back up to the image with that mark brought forward. */
    function showMark(reviewId: number) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      setHighlightMark(reviewId);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => setHighlightMark(null), 2500);
    }

    /** A review's "At 0:12": back up to the video and play from there. */
    function seek(seconds: number) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      videoRef.current?.playAt(seconds);
    }
    body = (
      <>
        {/* The image and title scroll away; the tabs under them stick to the top. */}
        <ScrollView
          ref={scrollRef}
          stickyHeaderIndices={[1]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: composer ? 16 : insets.bottom + 24 }}
          refreshControl={refreshControl}>
          <View className="gap-4 px-4 pb-4 pt-1">
            <MediaPreview
              creative={creative}
              videoRef={videoRef}
              marks={marks}
              draft={composer ? draftRegion : null}
              highlightId={highlightMark}
            />
            <Hero creative={creative} onChangeStatus={() => setStatusTarget(creative)} />
          </View>
          <Tabs tab={tab} onChange={setTab} reviewCount={creative.reviews.length} />
          <View className="gap-6 px-4 pt-5">
            {tab === 'details' ? (
              <>
                <Overview creative={creative} />
                <Content creative={creative} />
              </>
            ) : (
              <>
                <ReviewerProgress creative={creative} />
                <Reviews
                  creativeId={creative.id}
                  reviews={creative.reviews}
                  markNumbers={markNumbers}
                  onSeek={timestampable ? seek : undefined}
                  onShowMark={markable ? showMark : undefined}
                />
              </>
            )}
          </View>
        </ScrollView>
        {/* Pinned under the reviews, like a comment box. */}
        {composer && (
          <ReviewComposer
            creative={creative}
            region={draftRegion}
            onMarkArea={markable ? () => setPicking(true) : undefined}
            onClearRegion={() => setDraftRegion(null)}
            timestamp={draftTimestamp}
            onPinTime={timestampable ? pinTime : undefined}
            onClearTimestamp={() => setDraftTimestamp(null)}
          />
        )}
        {markable && creative.media && (
          <RegionPicker
            visible={picking}
            uri={creative.media.url}
            marks={marks}
            value={draftRegion}
            onDone={(region) => {
              setDraftRegion(region);
              setPicking(false);
            }}
            onCancel={() => setPicking(false)}
          />
        )}
      </>
    );
  } else if (error) {
    body = (
      <EmptyState
        icon={error.notFound ? FileQuestion : WifiOff}
        tone={error.notFound ? 'neutral' : 'error'}
        title={error.notFound ? 'Creative not found' : "Couldn't load this creative"}
        description={error.message}
        action={error.notFound ? { label: 'Back to creatives', onPress: goBack } : { label: 'Try again', onPress: retry }}
      />
    );
  } else if (isLoading) {
    body = (
      <View className="flex-1 items-center justify-center" accessibilityLabel="Loading creative">
        <ActivityIndicator colorClassName="accent-primary" />
      </View>
    );
  }

  return (
    <ThemedView className="flex-1" style={{ paddingTop: insets.top }}>
      <View className="h-14 flex-row items-center gap-1 pl-1.5 pr-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={goBack}
          className="size-11 items-center justify-center rounded-md active:bg-row-hover">
          <Icon as={ChevronLeft} size={24} />
        </Pressable>
        <ThemedText type="pageTitle" numberOfLines={1} className="flex-1">
          Creative
        </ThemedText>
        {creative && (
          <View className="rounded-sm bg-badge px-2 py-0.5">
            <ThemedText type="code" tone="muted" selectable>
              {creative.code}
            </ThemedText>
          </View>
        )}
      </View>

      {/* Android too: edge-to-edge no longer resizes the window, so the pinned composer would sit under the keyboard. */}
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        {body}
      </KeyboardAvoidingView>

      <FinalStatusSheet creative={statusTarget} onClose={() => setStatusTarget(null)} />
    </ThemedView>
  );
}

/** Name, what it is, and where it stands: always above the tabs, so both tabs know which creative this is. */
function Hero({ creative, onChangeStatus }: { creative: Creative; onChangeStatus: () => void }) {
  const status = finalStatusBadge(creative.final_status);
  const canChange = creative.permissions.update_final_status;
  const eyebrow = [creative.product?.title, creative.format === 'video' ? 'Video' : 'Image'].filter(Boolean).join(' · ');

  return (
    <View className="gap-3">
      <View className="gap-1">
        <ThemedText type="eyebrow" tone="muted">
          {eyebrow}
        </ThemedText>
        <ThemedText type="pageTitle" className="text-[20px] leading-[26px]" selectable>
          {creative.name}
        </ThemedText>
      </View>

      <View className="flex-row flex-wrap items-center gap-2">
        <Pressable
          accessibilityRole={canChange ? 'button' : undefined}
          accessibilityLabel={`Final status: ${StatusLabels[status]}${canChange ? '. Change' : ''}`}
          disabled={!canChange}
          hitSlop={6}
          onPress={onChangeStatus}>
          <StatusLabel status={status} editable={canChange} />
        </Pressable>
        <MyReviewChip creative={creative} />
      </View>
    </View>
  );
}

function MyReviewChip({ creative }: { creative: Creative }) {
  if (creative.my_review) {
    const status = reviewStatusBadge(creative.my_review.status);
    return (
      <View className="h-[22px] flex-row items-center gap-1.5 rounded-sm bg-badge px-2">
        <View className={`size-1.5 rounded-full ${STATUS_DOT[status]}`} />
        <ThemedText type="caption" tone="muted">
          You: {StatusLabels[status]}
        </ThemedText>
      </View>
    );
  }

  if (!creative.permissions.review) return null;

  return (
    <View className="h-[22px] flex-row items-center rounded-sm bg-badge px-2">
      <ThemedText type="caption" tone="muted">
        Waiting for your review
      </ThemedText>
    </View>
  );
}

type Tab = 'details' | 'reviews';

/** Details and Reviews side by side, so the reviews aren't buried under the whole creative. */
function Tabs({ tab, onChange, reviewCount }: { tab: Tab; onChange: (tab: Tab) => void; reviewCount: number }) {
  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: 'details', label: 'Details' },
    { value: 'reviews', label: 'Reviews', count: reviewCount },
  ];

  return (
    <View accessibilityRole="tablist" className="flex-row border-b border-divider bg-background px-4">
      {tabs.map(({ value, label, count }) => {
        const active = tab === value;
        return (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(value)}
            className={`-mb-px h-11 flex-1 flex-row items-center justify-center gap-1.5 border-b-2 ${
              active ? 'border-primary' : 'border-transparent'
            }`}>
            <ThemedText type={active ? 'labelActive' : 'label'} tone={active ? 'primary' : 'muted'}>
              {label}
            </ThemedText>
            {count !== undefined && count > 0 && (
              <View
                className={`h-5 min-w-5 items-center justify-center rounded-full px-1.5 ${active ? 'bg-badge-active' : 'bg-badge'}`}>
                <ThemedText type="caption" tone={active ? 'primary' : 'muted'}>
                  {count}
                </ThemedText>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function Overview({ creative }: { creative: Creative }) {
  const submission = creative.submission_status ? SUBMISSION[creative.submission_status] : null;
  const rows: { icon: LucideIcon; label: string; value: string | null; extra?: ReactNode }[] = [
    { icon: Package, label: 'Product', value: creative.product?.title ?? null },
    { icon: Building2, label: 'Workspace', value: creative.workspace.name },
    { icon: UserRound, label: 'Creator', value: creative.creator?.name ?? null },
    {
      icon: CalendarDays,
      label: 'Creative date',
      value: formatCreativeDate(creative.creative_date),
      extra: submission && (
        <View className={`rounded-sm border px-1.5 ${submission.classes}`}>
          <ThemedText type="caption" tone={submission.tone}>
            {submission.label}
          </ThemedText>
        </View>
      ),
    },
    { icon: Clock, label: 'Submitted', value: formatDateTime(creative.created_at) },
    { icon: Megaphone, label: 'Ads status', value: creative.ads_status ? humanize(creative.ads_status) : null },
    {
      icon: CircleCheck,
      label: 'Approved by',
      value: creative.approved_by
        ? [creative.approved_by.name, formatDateTime(creative.approved_at)].filter(Boolean).join(' · ')
        : null,
    },
  ];

  return (
    <Section title="Overview">
      <View className="rounded-lg border border-border bg-surface">
        {rows
          .filter((row) => row.value)
          .map(({ icon, label, value, extra }, index) => (
            <View
              key={label}
              className={`min-h-11 flex-row items-center gap-3 px-3.5 py-2.5 ${index > 0 ? 'border-t border-divider' : ''}`}>
              <Icon as={icon} size={16} className="text-muted" />
              <ThemedText type="label" tone="muted" className="w-24">
                {label}
              </ThemedText>
              <View className="flex-1 flex-row flex-wrap items-center justify-end gap-1.5">
                <ThemedText className="text-right" selectable>
                  {value}
                </ThemedText>
                {extra}
              </View>
            </View>
          ))}
      </View>
    </Section>
  );
}

function Content({ creative }: { creative: Creative }) {
  const blocks: [string, string | null][] = [
    ['Headline', creative.headline],
    ['Caption', creative.caption],
    ['Description', creative.description],
    ['Script', creative.script],
    ['Notes', creative.notes],
  ];
  const present = blocks.filter((block): block is [string, string] => !!block[1]?.trim());
  const link = creative.reference_link?.trim();
  const linkIsUrl = !!link && /^https?:\/\//i.test(link);

  if (present.length === 0 && !link) return null;

  return (
    <Section title="Content">
      <View className="gap-5">
        {present.map(([label, value]) => (
          <ContentBlock key={label} label={label} value={value} emphasis={label === 'Headline'} />
        ))}
        {link &&
          (linkIsUrl ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => Linking.openURL(link)}
              className="flex-row items-center gap-3 active:opacity-70">
              <View className="flex-1 gap-0.5">
                <ThemedText type="label" tone="muted">
                  Reference
                </ThemedText>
                <ThemedText tone="primary" numberOfLines={1}>
                  {link}
                </ThemedText>
              </View>
              <Icon as={ExternalLink} size={16} className="text-primary" />
            </Pressable>
          ) : (
            <ContentBlock label="Reference" value={link} />
          ))}
      </View>
    </Section>
  );
}

/** Long text (scripts) starts folded, so one field can't push the rest off screen. */
function ContentBlock({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const long = value.length > 220 || value.split('\n').length > 5;

  return (
    <View className="gap-1">
      <ThemedText type="label" tone="muted">
        {label}
      </ThemedText>
      <ThemedText
        type={emphasis ? 'rowTitle' : 'body'}
        numberOfLines={long && !expanded ? 5 : undefined}
        selectable>
        {value}
      </ThemedText>
      {long && (
        <Pressable accessibilityRole="button" onPress={() => setExpanded(!expanded)} hitSlop={8} className="self-start">
          <ThemedText type="labelActive" tone="primary">
            {expanded ? 'Show less' : 'Show more'}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

/** Who's been asked to review and where each of them landed. */
function ReviewerProgress({ creative }: { creative: Creative }) {
  const reviewers = creative.assigned_reviewers;
  if (reviewers.length === 0) return null;

  // Each reviewer's latest review (the list is oldest first).
  const latest = new Map<number, string>();
  for (const review of creative.reviews) {
    if (review.reviewer) latest.set(review.reviewer.id, review.status);
  }
  const done = reviewers.filter((reviewer) => latest.has(reviewer.id)).length;

  return (
    <View className="gap-3 rounded-lg border border-border bg-surface px-3.5 py-3">
      <View className="flex-row items-center justify-between">
        <ThemedText type="labelActive">Reviewers</ThemedText>
        <ThemedText type="meta" tone="muted">
          {done} of {reviewers.length} reviewed
        </ThemedText>
      </View>
      <View className="h-1 overflow-hidden rounded-full bg-badge">
        <View className="h-full rounded-full bg-primary" style={{ width: `${(done / reviewers.length) * 100}%` }} />
      </View>
      <View className="flex-row flex-wrap gap-2">
        {reviewers.map((reviewer) => {
          const status = latest.get(reviewer.id);
          const badge = status ? reviewStatusBadge(status) : null;
          return (
            <View
              key={reviewer.id}
              accessibilityLabel={`${reviewer.name}: ${badge ? StatusLabels[badge] : 'not reviewed yet'}`}
              className="h-7 flex-row items-center gap-1.5 rounded-full bg-badge pl-0.5 pr-2.5">
              <Avatar name={reviewer.name} size="sm" />
              <ThemedText type="metaMedium" numberOfLines={1}>
                {reviewer.name.split(/\s+/)[0]}
              </ThemedText>
              <View className={`size-1.5 rounded-full ${badge ? STATUS_DOT[badge] : 'bg-chevron'}`} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Reviews({
  creativeId,
  reviews,
  markNumbers,
  onSeek,
  onShowMark,
}: {
  creativeId: number;
  reviews: CreativeReview[];
  /** Review id → the number of its mark on the image. */
  markNumbers: Map<number, number>;
  /** Plays the video from a review's moment. */
  onSeek?: (seconds: number) => void;
  /** Scrolls up to the image and brings a review's mark forward. */
  onShowMark?: (reviewId: number) => void;
}) {
  if (reviews.length === 0) {
    return (
      <View className="items-center gap-2 rounded-lg border border-dashed border-border px-6 py-8">
        <View className="size-10 items-center justify-center rounded-full bg-badge">
          <Icon as={MessageSquare} size={18} className="text-muted" />
        </View>
        <ThemedText type="labelActive">No reviews yet</ThemedText>
        <ThemedText type="meta" tone="muted" className="text-center">
          Reviews and voice notes from the team show up here.
        </ThemedText>
      </View>
    );
  }

  return (
    <Section title="Activity">
      <View className="gap-3">
        {reviews.map((review) => (
          <ReviewItem
            key={review.id}
            creativeId={creativeId}
            review={review}
            markNumber={markNumbers.get(review.id)}
            onSeek={onSeek}
            onShowMark={onShowMark}
          />
        ))}
      </View>
    </Section>
  );
}

function ReviewItem({
  creativeId,
  review,
  markNumber,
  onSeek,
  onShowMark,
}: {
  creativeId: number;
  review: CreativeReview;
  markNumber?: number;
  onSeek?: (seconds: number) => void;
  onShowMark?: (reviewId: number) => void;
}) {
  const { token, user, signOut } = useSession();
  const name = review.reviewer?.name ?? 'Former reviewer';
  const mine = !!user && review.reviewer?.id === user.id;
  const status = reviewStatusBadge(review.status);
  // Inline confirm rather than Alert, which does nothing in the web app.
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!token || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      // The creative comes back without the review; publishing updates this screen and the lists.
      const { data } = await creativesApi.deleteReview(token, creativeId, review.id);
      publishCreative(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await signOut();
        return;
      }
      setError(err instanceof ApiError && err.status < 500 ? err.message : 'Couldn’t delete this review. Try again.');
      setDeleting(false);
    }
  }

  return (
    <View className={`gap-2.5 rounded-lg border px-3.5 py-3 ${mine ? 'border-approved-border bg-badge-active' : 'border-border bg-surface'}`}>
      <View className="flex-row items-center gap-2.5">
        <Avatar name={name} highlight={mine} />
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <ThemedText type="rowTitle" numberOfLines={1} className="shrink">
              {name}
            </ThemedText>
            {mine && (
              <ThemedText type="caption" tone="primary">
                You
              </ThemedText>
            )}
          </View>
          <ThemedText type="meta" tone="muted">
            {formatRelativeTime(review.created_at) ?? ''}
          </ThemedText>
        </View>
        <StatusLabel
          status={status}
          label={review.status === 'approved' || review.status === 'revision' ? undefined : humanize(review.status)}
        />
        {review.can_delete && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete review"
            hitSlop={6}
            onPress={() => setConfirming(true)}
            disabled={confirming}
            className="-mr-1.5 size-8 items-center justify-center rounded-md active:bg-row-hover">
            <Icon as={Trash2} size={16} className="text-muted" />
          </Pressable>
        )}
      </View>

      {(review.timestamp_seconds !== null || review.region) && (
        <View className="flex-row flex-wrap gap-2">
          {review.timestamp_seconds !== null && (
            <AnchorChip
              accessibilityLabel={
                onSeek ? `Play the video from ${formatTimestamp(review.timestamp_seconds)}` : undefined
              }
              onPress={onSeek ? () => onSeek(review.timestamp_seconds!) : undefined}
              lead={
                <View className="size-5 items-center justify-center rounded-full bg-primary">
                  <Icon as={Play} size={10} className="ml-px text-on-button" />
                </View>
              }
              label={formatTimestamp(review.timestamp_seconds)}
              hint="in the video"
            />
          )}
          {review.region && (
            <AnchorChip
              accessibilityLabel={onShowMark ? 'Show this mark on the image' : undefined}
              onPress={onShowMark ? () => onShowMark(review.id) : undefined}
              lead={markNumber ? <MarkPin n={markNumber} status={status} /> : <Icon as={MapPin} size={14} className="text-muted" />}
              label={review.region.w === 0 && review.region.h === 0 ? 'Point' : 'Area'}
              hint="on the image"
            />
          )}
        </View>
      )}

      {review.feedback ? <ThemedText selectable>{review.feedback}</ThemedText> : null}

      {review.voice && <VoicePlayer uri={review.voice.url} durationSeconds={review.voice.duration_seconds} />}

      {confirming && (
        <View className="flex-row items-center gap-2 border-t border-divider pt-2.5">
          <ThemedText type="meta" tone="muted" className="flex-1">
            Delete this review?
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => setConfirming(false)}
            disabled={deleting}
            className="h-9 justify-center rounded-md px-3 active:bg-row-hover">
            <ThemedText type="label">Cancel</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirm delete review"
            onPress={remove}
            disabled={deleting}
            className="h-9 min-w-20 items-center justify-center rounded-md border border-rejected-border bg-rejected-fill px-3">
            {deleting ? (
              <ActivityIndicator size="small" colorClassName="accent-rejected" />
            ) : (
              <ThemedText type="labelActive" tone="rejected">
                Delete
              </ThemedText>
            )}
          </Pressable>
        </View>
      )}

      {error && (
        <ThemedText type="meta" tone="rejected" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      )}
    </View>
  );
}

/** Where a review points: a moment of the video or a mark on the image. Taps jump to it. */
function AnchorChip({
  lead,
  label,
  hint,
  onPress,
  accessibilityLabel,
}: {
  lead: ReactNode;
  label: string;
  hint: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      disabled={!onPress}
      hitSlop={4}
      onPress={onPress}
      className="h-8 flex-row items-center gap-1.5 rounded-full border border-border bg-background pl-1.5 pr-3 active:bg-row-hover">
      {lead}
      <ThemedText type="labelActive">{label}</ThemedText>
      <ThemedText type="meta" tone="muted">
        {hint}
      </ThemedText>
    </Pressable>
  );
}

function Avatar({ name, size = 'md', highlight }: { name: string; size?: 'sm' | 'md'; highlight?: boolean }) {
  return (
    <View
      className={`items-center justify-center rounded-full ${size === 'sm' ? 'size-6' : 'size-9'} ${
        highlight ? 'bg-primary' : 'bg-border'
      }`}>
      <ThemedText type="caption" tone={highlight ? 'onButton' : 'default'} className={size === 'sm' ? 'text-[10px]' : ''}>
        {initials(name)}
      </ThemedText>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2.5">
      <ThemedText type="sectionLabel" tone="muted">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

/** "Ada Lovelace" → "AL" */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

/** "for_reapproval" → "For reapproval" */
function humanize(value: string) {
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
