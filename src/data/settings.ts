import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Direction } from '../engine/types';

export interface Settings {
  defaultDirection: Direction;
  ttsRate: number;
  bisayaVoiceNoticeShown: boolean;
}

const KEY = 'settings.v1';
const DEFAULTS: Settings = { defaultDirection: 'tl-ceb', ttsRate: 0.9, bisayaVoiceNoticeShown: false };

export async function getSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

let writeQueue: Promise<void> = Promise.resolve();

export function saveSettings(patch: Partial<Settings>): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    const current = await getSettings();
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }));
  });
  return writeQueue;
}
