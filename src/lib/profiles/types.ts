export interface TemplatePreview {
  /** CSS gradient or solid color for the preview card background */
  bg: string;
  /** Short visual keywords shown as tags */
  tags: string[];
  /** Mood/style one-liner shown in the preview */
  mood: string;
}

export interface Template {
  id: string;
  name: string;
  icon: string;
  prompt: string;
  description: string;
  dynamic?: boolean;
  preview?: TemplatePreview;
}

export interface ShotType {
  id: string;
  label: string;
  scenePrompt: string;
  aspectRatio?: string;
}

export interface SizeConfig {
  /** Translation key for the label (e.g. "studio.sizeLabel.garment") */
  label: string;
  /** Translation key for the placeholder (e.g. "studio.sizePlaceholder.garment") */
  placeholder: string;
  getSizePrompt: (productType: string, placement: string, dimension: string) => string;
}

export interface SocialPreset {
  id: string;
  platform: string;
  label: string;
  width: number;
  height: number;
  aspectRatio: string;
}

export interface ProductProfile {
  id: string;
  name: string;
  icon: string;
  description: string;

  // Analysis — GPT-4o system prompt for product analysis
  analysisSystemPrompt: string;

  // Templates
  templates: Template[];

  // Consistent model
  shotTypes: ShotType[];
  supportsConsistentModel: boolean;

  // Prompts
  consistencyPrefix: string;

  // Size
  sizeConfig?: SizeConfig;

  // Defaults
  defaultAspectRatio: string;
  defaultVideoRatio: string;
  defaultOutfit: string;

  // Social
  socialPresets: SocialPreset[];
}
