# Offline Tagalog↔Bisaya Translator — Design Spec

**Date:** 2026-07-08
**Status:** Approved by user (brainstorming session)
**Working name:** LeyText Learn (subject to change before store listing)

## 1. Summary

An Android app, published on the Google Play Store, that translates between
Tagalog and Bisaya (Cebuano) **fully offline** — no network calls at all.
Built with Expo / React Native in TypeScript. Version 1 uses a bundled
dictionary + phrase table; the architecture reserves a slot for an on-device
neural model in version 2 (phased hybrid).

## 2. Decisions Made

| Topic | Decision |
|---|---|
| Platform | Android mobile app (iOS possible later via same codebase) |
| Distribution | Public release on Google Play Store |
| Engine strategy | Phased hybrid: dictionary/phrases in v1, on-device neural model (NLLB via ONNX) in v2 |
| Stack | Expo / React Native, TypeScript, EAS cloud builds (dev machine is Windows) |
| Dictionary data | Compiled from open sources (Wiktionary, public wordlists, Tatoeba) + ~300–500 hand-curated phrases; user reviews/extends as a bilingual speaker |
| Voice input (v1) | Phone's built-in speech recognizer, Tagalog side only; offline when the device has the offline language pack; graceful notice otherwise |
| TTS | Device Filipino voice for both languages, with a one-time notice that Bisaya audio uses a Filipino voice |
| v1 features | Text translation, browsable phrasebook, history & favorites, TTS, voice input (as above) |

## 3. Architecture

```
┌─────────────────────────────────────────────┐
│                  App (Expo)                 │
│                                             │
│  Screens                                    │
│   ├─ Translate (main: type → result)        │
│   ├─ Phrasebook (browse by category)        │
│   ├─ History & Favorites                    │
│   └─ Settings                               │
│                                             │
│  Translation Engine (pure TS module)        │
│   ├─ 1. exact phrase match  ──┐             │
│   ├─ 2. word-by-word lookup ──┼─ v1         │
│   └─ 3. neural model (ONNX) ──── v2 slot    │
│                                             │
│  Data (all on-device, bundled with app)     │
│   ├─ SQLite: dictionary + phrases           │
│   └─ SQLite: history + favorites            │
└─────────────────────────────────────────────┘
```

### Translation engine (core isolated module)

- Single interface: `translate(text, direction) → TranslationResult`.
- Tries strategies in order:
  1. **Exact phrase match** — normalized lookup against the phrase table; instant, high quality.
  2. **Word-by-word dictionary lookup** — tokenize, look up each word, reassemble; words not found are passed through and flagged.
  3. **Neural model (v2 slot)** — quantized NLLB-200 via `onnxruntime-react-native`; not built in v1, but the strategy interface is defined now.
- `TranslationResult` carries the produced text, per-token found/not-found
  flags, and a `method` field (`phrase` | `word-by-word` | `neural`) so the
  UI can label results honestly ("exact match" vs "approximate").
- Pure TypeScript, no native dependencies → fully unit-testable.

### Data layer

- **Word dictionary** (~5,000–15,000 entries at launch): Tagalog↔Cebuano
  pairs with part of speech and optional notes. One table, indexed in both
  directions.
- **Phrase table** (~300–500 entries): Tagalog, Cebuano, category
  (greetings, directions, food, shopping, emergencies, small talk),
  pronunciation hint. This single dataset powers both phrase-match
  translation and the Phrasebook screen.
- **Normalization rules**: lowercase, strip punctuation, common Tagalog
  spelling-variant handling (e.g. po/ho, ng/nang) applied before lookup.
- Source of truth is **editable CSV files in the repo**; a build script
  compiles them into a prebuilt SQLite database bundled with the app.
  Growing the dictionary = editing CSV, no backend ever.
- Separate on-device SQLite DB for history (last 200, auto-pruned) and
  favorites (kept until removed).

## 4. Screens

1. **Translate (home).** Direction toggle TL⇄CEB with swap button; text
   input; live (debounced) local translation as you type. Result card:
   translation text, method badge, untranslated words in gray/italic,
   speaker icon (TTS), star (favorite), copy. Mic button for voice input on
   the Tagalog side; hidden/disabled with explanation when the recognizer
   is unavailable offline.
2. **Phrasebook.** Category grid → phrase list → expandable phrase with
   pronunciation hint, TTS, favorite. Search within phrases.
3. **History & Favorites.** Two tabs; tap any entry to reload it into the
   translator. Clearable in Settings.
4. **Settings.** Default direction, TTS voice/speed, clear history, About
   page with open-data license credits (Wiktionary/Tatoeba CC licenses).

## 5. Error Handling

No network = no network errors. Real failure modes:

- **Word not found** → shown as-is in gray/italic, result labeled
  approximate; offer closest dictionary matches beneath.
- **Voice input unavailable** (no recognizer / no offline pack, offline) →
  mic disabled with a short explanation and a pointer to install the
  offline Tagalog language pack.
- **TTS voice missing** → speaker icons disabled with a hint to install
  Google TTS Filipino voice.

## 6. Testing

- **Unit tests (Jest)** on the translation engine: normalization, phrase
  matching, word lookup, direction handling, not-found flagging.
- **Manual checklist** for screens (translate flow, phrasebook browse,
  history/favorites persistence, TTS, voice input, settings).
- **Release gate:** full end-to-end pass on a real Android device in
  airplane mode.

## 7. v2 Slot (not built in v1)

- Quantized NLLB-200 (supports Tagalog `tgl_Latn` and Cebuano `ceb_Latn`)
  via `onnxruntime-react-native` as engine strategy 3.
- Delivered as an **optional in-app download (~300MB)**, keeping the base
  APK small; users opt into "full sentence AI mode".
- No v1 UI or engine-interface changes required; method badge gains an
  "AI translation" value.
- No v2 work begins until v1 has shipped.

## 8. Play Store Release

- EAS Build (cloud) → signed AAB → Play Console. Works from Windows.
- One-time $25 Google Play developer account (user's task).
- Privacy policy page: trivial — app collects nothing and makes no network
  calls.
- Store listing assets (screenshots, copy) generated during release prep.
- Open-data attribution in the About screen as required by CC licenses.

## 9. Out of Scope (v1)

- iOS build and App Store release.
- Neural/AI translation (v2).
- Bundled offline speech recognition (Whisper/Vosk) — reconsidered in v2.
- Cebuano voice input (no viable recognizer support).
- Any backend, accounts, analytics, or telemetry.
