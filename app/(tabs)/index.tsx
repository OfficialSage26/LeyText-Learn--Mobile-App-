import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, TextInput } from 'react-native';
import { translate } from '../../src/engine/engine';
import type { Direction, TranslationResult } from '../../src/engine/types';
import { getSettings } from '../../src/data/settings';
import { useDictionary } from '../../src/data/useDictionary';
import { UserRepo } from '../../src/data/userRepo';
import { DirectionToggle } from '../../src/ui/DirectionToggle';
import { MicButton } from '../../src/ui/MicButton';
import { ResultCard } from '../../src/ui/ResultCard';
import { theme } from '../../src/ui/theme';

export default function TranslateScreen() {
  const dict = useDictionary();
  const [direction, setDirection] = useState<Direction>('tl-ceb');
  const [text, setText] = useState('');
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [repo, setRepo] = useState<UserRepo | null>(null);
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    UserRepo.create().then(setRepo);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSettings().then((s) => {
      if (!cancelled) setDirection(s.defaultDirection);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      if (text.trim() === '') {
        setResult(null);
        setSuggestions([]);
        return;
      }
      const r = await translate(text, direction, dict);
      if (cancelled) return;
      setResult(r);
      // Offer near-matches only for a single unknown word.
      if (r.method === 'word-by-word' && r.tokens.length === 1 && r.hasMisses) {
        const s = await dict.findSuggestions(r.tokens[0].source.slice(0, 3), direction);
        if (!cancelled) setSuggestions(s);
      } else {
        setSuggestions([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [text, direction, dict]);

  useEffect(() => {
    if (!repo || !result || result.output === '') return;
    let cancelled = false;
    const handle = setTimeout(() => {
      repo.addHistory({ input: result.input, output: result.output, direction: result.direction, method: result.method });
    }, 1500);
    repo.isFavorite(result.input, result.direction).then((v) => {
      if (!cancelled) setIsFav(v);
    });
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [repo, result]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Text style={styles.title}>Translate</Text>
        <DirectionToggle value={direction} onChange={setDirection} />
        <TextInput
          style={styles.input}
          multiline
          placeholder={direction === 'tl-ceb' ? 'Isulat ang Tagalog dito\u2026' : 'Isulat ang Bisaya dinhi\u2026'}
          placeholderTextColor={theme.colors.muted}
          value={text}
          onChangeText={setText}
          autoCorrect={false}
        />
        <MicButton enabled={direction === 'tl-ceb'} onTranscript={setText} />
        {result && (
          <ResultCard
            result={result}
            suggestions={suggestions}
            isFavorite={isFav}
            onToggleFavorite={async () => {
              if (!repo || !result) return;
              setIsFav(await repo.toggleFavorite(result.input, result.output, result.direction));
            }}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: 16 },
  title: { fontSize: 28, fontWeight: '700', color: theme.colors.text, marginTop: 8 },
  input: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 16,
    fontSize: 18,
    minHeight: 110,
    textAlignVertical: 'top',
    color: theme.colors.text,
  },
});
