export const DEFAULT_HERO_VIDEO_URL =
  "https://res.cloudinary.com/aamg9pin/video/upload/v1785232004/Video_Project_7_lz0fq4.mp4";

export const DEFAULT_HERO_POSTER_URL = "/why_us_premium_oats.png";

const CLOUDINARY_VIDEO_TRANSFORMS = "f_auto,q_auto,vc_auto,w_1920,c_limit,fl_progressive";
const CLOUDINARY_POSTER_TRANSFORMS = "so_0,f_auto,q_auto,w_1920,c_limit";

const VIDEO_EXT_PATTERN = /\.(mp4|webm|mov|m3u8)(\?.*)?$/i;
const VERSION_SEGMENT_PATTERN = /^v\d+$/;

function isCloudinaryVideoUrl(url: string): boolean {
  return url.includes("res.cloudinary.com") && url.includes("/video/upload/");
}

/** Cloudinary transform segments use commas or known delivery prefixes. */
function isTransformSegment(segment: string): boolean {
  if (VERSION_SEGMENT_PATTERN.test(segment)) return false;
  if (segment.includes(",")) return true;

  return /^(so_|fl_|vc_|sp_|e_|ar_|bo_|dpr_|f_|q_|w_|h_|c_|g_|l_|r_|x_|y_|z_|a_|b_|co_|cp_|dl_|dn_|pg_|t_|u_|o_)/.test(
    segment
  );
}

type ParsedCloudinaryVideo = {
  cloud: string;
  version: string;
  publicPath: string;
};

/** Strip existing transforms and rebuild a clean Cloudinary video path. */
function parseCloudinaryVideoUrl(url: string): ParsedCloudinaryVideo | null {
  const trimmed = String(url || "").trim().replace(/\?.*$/, "");
  const match = trimmed.match(
    /^https:\/\/res\.cloudinary\.com\/([^/]+)\/video\/upload\/(.+)$/
  );
  if (!match) return null;

  const cloud = match[1];
  const segments = match[2].split("/").filter(Boolean);
  if (!segments.length) return null;

  let fileIdx = segments.length - 1;
  while (fileIdx >= 0 && !VIDEO_EXT_PATTERN.test(segments[fileIdx])) {
    fileIdx -= 1;
  }
  if (fileIdx < 0) return null;

  const fileBase = segments[fileIdx].replace(VIDEO_EXT_PATTERN, "");
  const version =
    fileIdx > 0 && VERSION_SEGMENT_PATTERN.test(segments[fileIdx - 1])
      ? segments[fileIdx - 1]
      : "";

  let segmentStart = 0;
  while (segmentStart < fileIdx && isTransformSegment(segments[segmentStart])) {
    segmentStart += 1;
  }

  const folderEnd = version ? fileIdx - 1 : fileIdx;
  const publicIdParts = segments.slice(segmentStart, folderEnd);
  publicIdParts.push(fileBase);

  return {
    cloud,
    version,
    publicPath: publicIdParts.join("/"),
  };
}

function buildCloudinaryVideoUrl(
  parsed: ParsedCloudinaryVideo,
  transforms: string,
  extension: string
): string {
  const versionSegment = parsed.version ? `${parsed.version}/` : "";
  return `https://res.cloudinary.com/${parsed.cloud}/video/upload/${transforms}/${versionSegment}${parsed.publicPath}.${extension}`;
}

/** Apply Cloudinary delivery optimizations for faster start + smaller payloads. */
export function optimizeCloudinaryVideoUrl(url: string): string {
  const trimmed = String(url || "").trim();
  if (!trimmed || !isCloudinaryVideoUrl(trimmed)) return trimmed;

  if (/upload\/[^/]*(f_auto|q_auto|vc_auto)/.test(trimmed)) {
    return trimmed.replace(/\?.*$/, "");
  }

  const parsed = parseCloudinaryVideoUrl(trimmed);
  if (!parsed) return trimmed;

  return buildCloudinaryVideoUrl(parsed, CLOUDINARY_VIDEO_TRANSFORMS, "mp4");
}

/** First-frame poster derived from a Cloudinary video URL. */
export function getHeroPosterUrl(videoUrl: string, fallback = DEFAULT_HERO_POSTER_URL): string {
  const trimmed = String(videoUrl || "").trim();
  if (!isCloudinaryVideoUrl(trimmed)) return fallback;

  const parsed = parseCloudinaryVideoUrl(trimmed);
  if (!parsed) return fallback;

  return buildCloudinaryVideoUrl(parsed, CLOUDINARY_POSTER_TRANSFORMS, "jpg");
}

export function getHeroVideoUrl(settings: Record<string, unknown> = {}): string {
  const url = String(settings.hero_video_url || "").trim();
  return optimizeCloudinaryVideoUrl(url || DEFAULT_HERO_VIDEO_URL);
}

export function getHeroAudioUrl(settings: Record<string, unknown> = {}): string {
  return String(settings.hero_audio_url || "").trim();
}

export function getDefaultHeroPreloadAssets() {
  const videoUrl = optimizeCloudinaryVideoUrl(DEFAULT_HERO_VIDEO_URL);
  return { videoUrl, posterUrl: DEFAULT_HERO_POSTER_URL };
}

export function isCloudinaryAsset(url: string): boolean {
  return url.includes("res.cloudinary.com");
}
