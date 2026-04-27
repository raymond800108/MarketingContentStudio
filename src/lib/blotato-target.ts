/**
 * Builds the Blotato v2 `target` object according to their publish-post spec:
 * https://help.blotato.com/api/publish-post
 *
 * Different platforms require different fields. Most critically:
 *   - Instagram: `mediaType` ('reel' | 'story') distinguishes Reels / Stories
 *     from a regular feed post (omit mediaType for a feed post / carousel).
 *   - Facebook: optional `mediaType` ('reel' | 'story') and required `pageId`.
 *   - TikTok: several booleans + `privacyLevel` are required.
 *   - Pinterest: `boardId` is required.
 *   - YouTube: `title`, `privacyStatus`, `shouldNotifySubscribers` are required.
 *
 * The presetId (e.g. "ig-post", "ig-story", "ig-reels") is the authoritative
 * signal coming from our UI — we derive `mediaType` from it.
 */

export type BlotatoTargetType =
  | "twitter"
  | "linkedin"
  | "facebook"
  | "instagram"
  | "pinterest"
  | "tiktok"
  | "threads"
  | "bluesky"
  | "youtube"
  | "other";

export interface BuildTargetInput {
  platform: string | null | undefined;
  presetId?: string | null;
  // Optional platform-specific extras – caller may pass these when known
  facebookPageId?: string;
  linkedinPageId?: string;
  pinterestBoardId?: string;
  youtubeTitle?: string;
}

const PLATFORM_MAP: Record<string, BlotatoTargetType> = {
  instagram: "instagram",
  tiktok: "tiktok",
  facebook: "facebook",
  twitter: "twitter",
  x: "twitter",
  linkedin: "linkedin",
  pinterest: "pinterest",
  threads: "threads",
  bluesky: "bluesky",
  youtube: "youtube",
  // Blotato doesn't officially support Xiaohongshu – fall back to "other"
  xiaohongshu: "other",
};

export function normalizePlatform(raw: string | null | undefined): BlotatoTargetType {
  if (!raw) return "twitter";
  return PLATFORM_MAP[raw.toLowerCase()] ?? "other";
}

/**
 * Derive Instagram mediaType from the preset id.
 *   ig-story  → 'story'
 *   ig-reels  → 'reel'
 *   ig-post   → undefined (feed post / carousel)
 */
function instagramMediaType(presetId?: string | null): "reel" | "story" | undefined {
  if (!presetId) return undefined;
  const id = presetId.toLowerCase();
  if (id.includes("story")) return "story";
  if (id.includes("reel")) return "reel";
  return undefined;
}

function facebookMediaType(presetId?: string | null): "reel" | "story" | undefined {
  if (!presetId) return undefined;
  const id = presetId.toLowerCase();
  if (id.includes("story")) return "story";
  if (id.includes("reel")) return "reel";
  return undefined;
}

/**
 * Build a spec-compliant `target` object for a POST /v2/posts request.
 * Callers can spread extra fields into the result if needed.
 */
export function buildBlotatoTarget(input: BuildTargetInput): Record<string, unknown> {
  const targetType = normalizePlatform(input.platform);

  switch (targetType) {
    case "instagram": {
      const mediaType = instagramMediaType(input.presetId);
      // Feed posts: omit mediaType entirely so Blotato treats it as a carousel
      // / feed post instead of defaulting to "reel".
      const target: Record<string, unknown> = { targetType: "instagram" };
      if (mediaType) target.mediaType = mediaType;
      return target;
    }

    case "facebook": {
      const target: Record<string, unknown> = { targetType: "facebook" };
      if (input.facebookPageId) target.pageId = input.facebookPageId;
      const mediaType = facebookMediaType(input.presetId);
      if (mediaType) target.mediaType = mediaType;
      return target;
    }

    case "linkedin": {
      const target: Record<string, unknown> = { targetType: "linkedin" };
      if (input.linkedinPageId) target.pageId = input.linkedinPageId;
      return target;
    }

    case "tiktok": {
      // Blotato requires several booleans + privacyLevel. Use sensible defaults
      // so the post doesn't fail validation. Users can tweak these later once
      // we expose a TikTok settings panel in the UI.
      return {
        targetType: "tiktok",
        privacyLevel: "PUBLIC_TO_EVERYONE",
        disabledComments: false,
        disabledDuet: false,
        disabledStitch: false,
        isBrandedContent: false,
        isYourBrand: false,
        isAiGenerated: true,
      };
    }

    case "pinterest": {
      const target: Record<string, unknown> = { targetType: "pinterest" };
      if (input.pinterestBoardId) target.boardId = input.pinterestBoardId;
      return target;
    }

    case "youtube": {
      return {
        targetType: "youtube",
        title: input.youtubeTitle ?? "Untitled",
        privacyStatus: "public",
        shouldNotifySubscribers: false,
        isMadeForKids: false,
      };
    }

    case "twitter":
    case "threads":
    case "bluesky":
    case "other":
    default:
      return { targetType };
  }
}
