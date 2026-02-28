export type ChangeType = 'added' | 'removed' | 'unchanged';

export interface DiffChunk {
  id: string;
  value: string;
  type: ChangeType;
  originalIndex: number; // Index in the raw diff array
}

export enum AppStep {
  INPUT = 'INPUT',
  RESULT = 'RESULT'
}
