import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';
import { DictionaryRepo } from './dictionary';

export function useDictionary(): DictionaryRepo {
  const db = useSQLiteContext();
  return useMemo(() => new DictionaryRepo(db), [db]);
}
