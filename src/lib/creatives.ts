import type { CreativeStatus } from '@/constants/theme';

/** The creative's overall decision, set by someone with "Update Creative Status". */
export type FinalStatus = 'for_approval' | 'approved' | 'for_revision';

/** What a reviewer can pick when leaving a review. A status is required. */
export type ReviewStatus = 'approved' | 'revision';

/** An area of an image as fractions of its width/height (0–1). w = h = 0 is a single point. */
export type Region = { x: number; y: number; w: number; h: number };

export type CreativeReview = {
  id: number;
  /** Older reviews can carry legacy statuses (`for_approval`, `waiting_for_submission`, ...). */
  status: string;
  feedback: string | null;
  /** The second of a video the review points at; null for the whole creative. */
  timestamp_seconds: number | null;
  /** The area of the image the review points at; null for the whole creative. */
  region: Region | null;
  /** A voice message; `url` is signed, so the player loads it without the token. */
  voice: { duration_seconds: number | null; url: string } | null;
  reviewer: { id: number; name: string } | null;
  /** ISO 8601 */
  created_at: string | null;
  /** True for your own reviews: only the author may delete one. */
  can_delete: boolean;
};

type Person = { id: number; name: string };

/** A creative as the creatives-tracker API returns it, from the signed-in user's point of view. */
export type Creative = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  format: 'video' | 'image';
  /** YYYY-MM-DD */
  creative_date: string | null;
  submission_status: 'late' | 'early' | 'on_time' | null;
  script: string | null;
  picture_url: string | null;
  /** The image or video uploaded to Artemis; `url` loads directly (CloudFront or signed S3). */
  media: { url: string; mime_type: string; file_name: string; size: number } | null;
  reference_link: string | null;
  caption: string | null;
  headline: string | null;
  notes: string | null;
  ads_status: string | null;
  final_status: FinalStatus;
  approved_at: string | null;
  approved_by: Person | null;
  workspace: { id: number; name: string; slug: string };
  creator: Person | null;
  product: { id: number; title: string } | null;
  assigned_reviewers: Person[];
  reviews: CreativeReview[];
  review_count: number;
  latest_review: { status: string; feedback: string | null } | null;
  /** The signed-in user's latest review, if they left one. */
  my_review: { status: string; created_at: string | null } | null;
  permissions: { update_final_status: boolean; review: boolean };
  created_at: string | null;
};

export const FINAL_STATUS_OPTIONS: { value: FinalStatus; label: string; description: string }[] = [
  { value: 'for_approval', label: 'Pending', description: 'Still waiting on a decision' },
  { value: 'approved', label: 'Approved', description: 'Good to go' },
  { value: 'for_revision', label: 'For Revision', description: 'Send back to the creator for changes' },
];

const FINAL_TO_BADGE: Record<FinalStatus, CreativeStatus> = {
  for_approval: 'pending',
  approved: 'approved',
  for_revision: 'revision',
};

/** Badge for a creative's final status. */
export function finalStatusBadge(status: FinalStatus): CreativeStatus {
  return FINAL_TO_BADGE[status] ?? 'pending';
}

/** Badge for one review's status; legacy statuses read as pending. */
export function reviewStatusBadge(status: string): CreativeStatus {
  if (status === 'approved') return 'approved';
  if (status === 'revision') return 'revision';
  return 'pending';
}

/**
 * Whether a creative still belongs in the list after it changed, so the list can drop it
 * without reloading. The server lists assigned creatives that are still for approval.
 */
export function stillListed(creative: Creative): boolean {
  return creative.final_status === 'for_approval';
}

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** "2026-10-03" → "Oct 3, 2026" (parsed as a local date, not UTC). */
export function formatCreativeDate(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return dateFormat.format(new Date(year, month - 1, day));
}

/** ISO timestamp → "Oct 3, 4:05 PM" in the device's timezone. */
export function formatDateTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateTimeFormat.format(date);
}

/** 75.4 → "1:15" */
export function formatTimestamp(seconds: number) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** ISO timestamp → "Just now", "12m ago", "3h ago", "Yesterday", then "Oct 3, 4:05 PM". */
export function formatRelativeTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h ago`;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${timeFormat.format(date)}`;

  return dateTimeFormat.format(date);
}

const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

export type Preview = { kind: 'image' | 'video'; uri: string };

/** Only an image uploaded to Artemis can be marked up (the server refuses areas on anything else). */
export function canMarkUp(creative: Creative): boolean {
  return !!creative.media?.mime_type.startsWith('image/');
}

/** Reviews pinned to an area, numbered oldest first so a mark keeps its number as reviews are added. */
export function reviewMarks(creative: Creative) {
  return creative.reviews
    .filter((review) => review.region)
    .map((review, index) => ({
      id: review.id,
      n: index + 1,
      region: review.region!,
      status: reviewStatusBadge(review.status),
    }));
}

/**
 * What to show for a creative: the file uploaded to Artemis first, else an image from
 * `picture_url`. `width` sizes Google Drive thumbnails (the list wants small, the detail large).
 */
export function creativePreview(creative: Creative, width = 240): Preview | null {
  const media = creative.media;
  if (media?.mime_type.startsWith('image/')) return { kind: 'image', uri: media.url };
  if (media?.mime_type.startsWith('video/')) return { kind: 'video', uri: media.url };

  const picture = previewUrl(creative.picture_url, width);
  return picture ? { kind: 'image', uri: picture } : null;
}

/**
 * A loadable image URL for the thumbnail, or null. `picture_url` is free text in Artemis, so it
 * can be plain text or a Google Drive "view" page (HTML, not an image). Drive links are turned
 * into Drive's thumbnail endpoint, which works for files shared as "Anyone with the link".
 */
export function previewUrl(pictureUrl: string | null, width = 240): string | null {
  if (!pictureUrl || !/^https?:\/\//i.test(pictureUrl.trim())) return null;
  const url = pictureUrl.trim();

  const driveId =
    url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/)?.[1] ??
    url.match(/drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([^&#]+)/)?.[1];
  if (driveId) {
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w${width}`;
  }

  return url;
}
