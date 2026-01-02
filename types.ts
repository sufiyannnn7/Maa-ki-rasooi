
export enum AppState {
  ONBOARDING = 'ONBOARDING',
  CHOOSING_FLOW = 'CHOOSING_FLOW',
  FLOW_1_TYPE = 'FLOW_1_TYPE',
  FLOW_1_INGREDIENTS = 'FLOW_1_INGREDIENTS',
  FLOW_2_PREFERENCES = 'FLOW_2_PREFERENCES',
  SUGGESTING_DISHES = 'SUGGESTING_DISHES',
  VIEWING_RECIPE = 'VIEWING_RECIPE',
  VOICE_MODE = 'VOICE_MODE'
}

export interface OnboardingData {
  language: string;
  interactionMode: 'Voice' | 'Text' | 'Both';
  experience: 'Beginner' | 'Intermediate' | 'Expert';
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  image?: string;
  isRecipe?: boolean;
}
