export interface LyricLine {
  id: string;
  text: string;
  timestamp?: number; // Start time in seconds
}

export enum AppStep {
  UPLOAD = 'UPLOAD',
  LYRICS = 'LYRICS',
  BACKGROUND = 'BACKGROUND',
  SYNC = 'SYNC',
  PREVIEW = 'PREVIEW',
}

export type AspectRatio = '16:9' | '9:16';

export interface ProjectState {
  audioFile: File | null;
  audioUrl: string | null;
  rawLyrics: string;
  parsedLyrics: LyricLine[];
  backgroundImageUrl: string | null;
  aspectRatio: AspectRatio;
  textColor: string;
}