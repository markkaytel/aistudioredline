import * as Diff from 'diff';
import { DiffChunk, ChangeType } from '../types';

// Simple UUID generator for chunks
const generateId = () => Math.random().toString(36).substr(2, 9);

export const calculateDiffs = (original: string, revised: string): DiffChunk[] => {
  // Use diffWords for prose. For code we might use diffLines, but the prompt implies text.
  const rawDiffs = Diff.diffWords(original, revised);
  
  return rawDiffs.map((part, index) => {
    let type: ChangeType = 'unchanged';
    if (part.added) type = 'added';
    if (part.removed) type = 'removed';

    return {
      id: generateId(),
      value: part.value,
      type,
      originalIndex: index
    };
  });
};

export const getCleanText = (chunks: DiffChunk[]): string => {
  // Returns the "final" text assuming all changes are accepted
  return chunks
    .map(chunk => {
      if (chunk.type === 'unchanged') return chunk.value;
      if (chunk.type === 'added') return chunk.value;
      // Removed chunks are omitted
      return '';
    })
    .join('');
};

export const getRedlineHtml = (chunks: DiffChunk[]): string => {
  return chunks
    .map(chunk => {
      const text = chunk.value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");

      if (chunk.type === 'unchanged') {
        return `<span>${text}</span>`;
      }
      
      if (chunk.type === 'added') {
        // Green underline for additions
        return `<span style="background-color: #dcfce7; color: #166534; text-decoration: underline;">${text}</span>`;
      }
      
      if (chunk.type === 'removed') {
        // Red strikethrough for deletions
        return `<span style="background-color: #fee2e2; color: #991b1b; text-decoration: line-through;">${text}</span>`;
      }
      
      return '';
    })
    .join('');
};
