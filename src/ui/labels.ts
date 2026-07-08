import type { Direction } from '../engine/types';

export const DIRECTION_LABELS: Record<Direction, { from: string; to: string }> = {
  'tl-ceb': { from: 'Tagalog', to: 'Bisaya' },
  'ceb-tl': { from: 'Bisaya', to: 'Tagalog' },
};

export const METHOD_LABELS = {
  phrase: 'Exact match',
  'word-by-word': 'Approximate',
} as const;
