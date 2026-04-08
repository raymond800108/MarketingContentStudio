import type { SocialPreset } from "./types";

export const SOCIAL_PRESETS: SocialPreset[] = [
  { id: "ig-post", platform: "Instagram", label: "Post", width: 1080, height: 1080, aspectRatio: "1:1" },
  { id: "ig-story", platform: "Instagram", label: "Story", width: 1080, height: 1920, aspectRatio: "9:16" },
  { id: "ig-reels", platform: "Instagram", label: "Reels", width: 1080, height: 1920, aspectRatio: "9:16" },
  { id: "tiktok", platform: "TikTok", label: "Video", width: 1080, height: 1920, aspectRatio: "9:16" },
  { id: "fb-post", platform: "Facebook", label: "Post", width: 1200, height: 1200, aspectRatio: "1:1" },
  { id: "fb-cover", platform: "Facebook", label: "Cover", width: 820, height: 312, aspectRatio: "820:312" },
  { id: "pinterest", platform: "Pinterest", label: "Pin", width: 1000, height: 1500, aspectRatio: "2:3" },
  { id: "xhs", platform: "Xiaohongshu", label: "Post", width: 1080, height: 1440, aspectRatio: "3:4" },
];
