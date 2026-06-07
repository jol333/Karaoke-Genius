import { AppStep } from './types';

export const RESOLUTIONS = {
  '16:9': { width: 3840, height: 2160 },
  '9:16': { width: 2160, height: 3840 },
};


export const STEP_IDS: Record<AppStep, number> = {
  [AppStep.UPLOAD]: 1,
  [AppStep.LYRICS]: 2,
  [AppStep.BACKGROUND]: 3,
  [AppStep.SYNC]: 4,
  [AppStep.PREVIEW]: 5,
};

export const STEPS = [
  { id: 1, label: 'Upload Audio', value: AppStep.UPLOAD },
  { id: 2, label: 'Enter Lyrics', value: AppStep.LYRICS },
  { id: 3, label: 'Background', value: AppStep.BACKGROUND },
  { id: 4, label: 'Sync Timing', value: AppStep.SYNC },
  { id: 5, label: 'Export Video', value: AppStep.PREVIEW },
];