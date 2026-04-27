import { jewelry } from "./jewelry";
import { clothing } from "./clothing";
import { furniture } from "./furniture";
import { bottle } from "./bottle";
import type { ProductProfile } from "./types";

export const PROFILES: Record<string, ProductProfile> = {
  jewelry,
  clothing,
  furniture,
  bottle,
};

export const PROFILE_LIST = Object.values(PROFILES);

export const getProfile = (id: string): ProductProfile | undefined => PROFILES[id];

export type { ProductProfile, Template, ShotType, SizeConfig, SocialPreset } from "./types";
