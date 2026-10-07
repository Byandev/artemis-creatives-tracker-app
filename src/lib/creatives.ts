import type { CreativeStatus } from '@/constants/theme';

/** One item from GET /api/v1/creatives-tracker/creatives/assigned (fields the list uses). */
export type AssignedCreative = {
  id: number;
  code: string;
  name: string;
  format: 'video' | 'image';
  /** YYYY-MM-DD */
  creative_date: string | null;
  picture_url: string | null;
  final_status: string | null;
  workspace: { id: number; name: string; slug: string };
  product: { id: number; title: string } | null;
};

/**
 * Review status from the signed-in user's point of view. The assigned endpoint only returns
 * creatives they haven't reviewed yet, so everything it returns is pending.
 */
export function reviewStatus(_creative: AssignedCreative): CreativeStatus {
  return 'pending';
}

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** "2026-10-03" → "Oct 3, 2026" (parsed as a local date, not UTC). */
export function formatCreativeDate(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return dateFormat.format(new Date(year, month - 1, day));
}

/**
 * A loadable image URL for the thumbnail, or null. `picture_url` is free text in Artemis, so it
 * can be plain text or a Google Drive "view" page (HTML, not an image). Drive links are turned
 * into Drive's thumbnail endpoint, which works for files shared as "Anyone with the link".
 */
export function previewUrl(pictureUrl: string | null): string | null {
  if (!pictureUrl || !/^https?:\/\//i.test(pictureUrl.trim())) return null;
  const url = pictureUrl.trim();

  const driveId =
    url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/)?.[1] ??
    url.match(/drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([^&#]+)/)?.[1];
  if (driveId) {
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w240`;
  }

  return url;
}
