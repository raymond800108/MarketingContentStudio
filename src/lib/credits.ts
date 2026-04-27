import type { ApiAction } from "./usage";

export const ACTION_CREDITS: Record<ApiAction, number> = {
  "image-generate": 1,
  "video-generate": 5,
  "product-analysis": 1,
  "caption-generate": 1,
  "video-prompt-refine": 0,
  "file-upload": 0,
  "blotato-publish": 0,
  "blotato-media": 0,
  "blotato-accounts": 0,
  "blotato-schedules": 0,
};

export const PLAN_CREDITS: Record<string, number> = {
  free: 50,
  starter: 150,
  pro: 500,
  business: 2000,
};

export function getCreditsForAction(action: ApiAction): number {
  return ACTION_CREDITS[action] ?? 1;
}
