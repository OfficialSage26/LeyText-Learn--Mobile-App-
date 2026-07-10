# Graph Report - .  (2026-07-10)

## Corpus Check
- 61 files · ~64,412 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 264 nodes · 351 edges · 37 communities (13 shown, 24 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.92)
- Token cost: 699,126 input · 13,000 output

## Community Hubs (Navigation)
- App Screens & Local Storage
- Expo Runtime Dependencies
- Package & Build Tooling
- Expo App Configuration
- Translator Plan & Spec Concepts
- Translation Engine & DB Build
- Data Repositories (Dictionary/User)
- Phrasebook & Category Browsing
- Android Adaptive Icon Config
- TypeScript Config
- Project Documentation
- Offline-First Guarantee
- Metro Bundler Config
- Android Icon Brand Mark
- Expo Badge (White)
- Play Store Release
- Expo Symbol Asset
- Grid Overlay Asset
- Android Icon Background
- Android Monochrome Icon
- Expo Badge
- Expo Logo
- Favicon
- App Icon
- Logo Glow Asset
- React Logo @2x
- React Logo @3x
- React Logo
- Splash Icon
- Explore Tab Icon @2x
- Explore Tab Icon @3x
- Explore Tab Icon
- Home Tab Icon @2x
- Home Tab Icon @3x
- Home Tab Icon
- Expo Starter Screenshot

## God Nodes (most connected - your core abstractions)
1. `Direction` - 18 edges
2. `expo` - 15 edges
3. `UserRepo` - 12 edges
4. `theme` - 11 edges
5. `DictionaryRepo` - 10 edges
6. `scripts` - 9 edges
7. `getSettings()` - 8 edges
8. `translate()` - 8 edges
9. `useDictionary()` - 7 edges
10. `Lexicon` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Expo App Template (create-expo-app)` --conceptually_related_to--> `Offline Tagalog-Bisaya Translator v1 Implementation Plan`  [INFERRED]
  README.md → docs/superpowers/plans/2026-07-08-offline-translator-v1.md
- `File-Based Routing (expo-router)` --conceptually_related_to--> `Offline Tagalog-Bisaya Translator v1 Implementation Plan`  [INFERRED]
  README.md → docs/superpowers/plans/2026-07-08-offline-translator-v1.md
- `TranslateScreen()` --calls--> `useDictionary()`  [EXTRACTED]
  app/(tabs)/index.tsx → src/data/useDictionary.ts
- `TranslateScreen()` --calls--> `translate()`  [EXTRACTED]
  app/(tabs)/index.tsx → src/engine/engine.ts
- `PhrasebookScreen()` --calls--> `useDictionary()`  [EXTRACTED]
  app/(tabs)/phrasebook.tsx → src/data/useDictionary.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phased Translation Strategy Cascade (phrase, word-by-word, neural)** — docs_superpowers_specs_2026_07_08_offline_tagalog_bisaya_translator_design_exact_phrase_match, docs_superpowers_specs_2026_07_08_offline_tagalog_bisaya_translator_design_word_by_word_lookup, docs_superpowers_specs_2026_07_08_offline_tagalog_bisaya_translator_design_neural_v2_slot, docs_superpowers_plans_2026_07_08_offline_translator_v1_translation_engine [EXTRACTED 1.00]
- **Four-Tab App Shell (Translate, Phrasebook, Saved, Settings)** — docs_superpowers_plans_2026_07_08_offline_translator_v1_translate_screen, docs_superpowers_plans_2026_07_08_offline_translator_v1_phrasebook_screen, docs_superpowers_plans_2026_07_08_offline_translator_v1_saved_screen, docs_superpowers_plans_2026_07_08_offline_translator_v1_settings_screen [EXTRACTED 1.00]
- **Offline-First Guarantee Across Design, Plan, Privacy, and Release** — docs_superpowers_specs_2026_07_08_offline_tagalog_bisaya_translator_design_offline_first, docs_superpowers_plans_2026_07_08_offline_translator_v1_zero_network_constraint, docs_privacy_policy_no_data_collection, docs_release_checklist_airplane_mode_release_gate [INFERRED 0.85]

## Communities (37 total, 24 thin omitted)

### Community 0 - "App Screens & Local Storage"
Cohesion: 0.11
Nodes (26): styles, TranslateScreen(), SavedScreen(), styles, SettingsScreen(), styles, DEFAULTS, getSettings() (+18 more)

### Community 1 - "Expo Runtime Dependencies"
Cohesion: 0.06
Nodes (32): dependencies, expo, expo-asset, expo-clipboard, expo-constants, expo-dev-client, expo-device, expo-font (+24 more)

### Community 2 - "Package & Build Tooling"
Cohesion: 0.07
Nodes (26): devDependencies, better-sqlite3, csv-parse, jest, jest-expo, tsx, @types/better-sqlite3, @types/jest (+18 more)

### Community 3 - "Expo App Configuration"
Cohesion: 0.08
Nodes (25): projectId, reactCompiler, typedRoutes, expo, experiments, extra, icon, ios (+17 more)

### Community 4 - "Translator Plan & Spec Concepts"
Cohesion: 0.09
Nodes (26): Device Speech Recognizer Online-Processing Caveat, SQLite Build Script (scripts/build-db.ts), CSV Files as Data Source of Truth, DictionaryRepo SQLite Lexicon Adapter, Direction Type ('tl-ceb' | 'ceb-tl'), Honest Labeling of Translation Method, Lexicon Interface (findPhrase/findWord seam), MicButton Voice Input Component (expo-speech-recognition) (+18 more)

### Community 5 - "Translation Engine & DB Build"
Cohesion: 0.13
Nodes (14): CATEGORIES, counts, db, insertPhrase, insertWord, PhraseRow, phrases, WordRow (+6 more)

### Community 6 - "Data Repositories (Dictionary/User)"
Cohesion: 0.15
Nodes (3): DictionaryRepo, UserRepo, Direction

### Community 7 - "Phrasebook & Category Browsing"
Cohesion: 0.33
Nodes (7): CategoryScreen(), styles, PhrasebookScreen(), styles, PhraseEntry, useDictionary(), CATEGORY_META

### Community 8 - "Android Adaptive Icon Config"
Cohesion: 0.22
Nodes (9): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled (+1 more)

### Community 9 - "TypeScript Config"
Cohesion: 0.22
Nodes (8): compilerOptions, paths, strict, types, extends, include, @/*, @/assets/*

### Community 10 - "Project Documentation"
Cohesion: 0.33
Nodes (6): LeyText Learn Privacy Policy, Release Checklist, Offline Tagalog-Bisaya Translator v1 Implementation Plan, Offline Tagalog-Bisaya Translator Design Spec, Expo App Template (create-expo-app), File-Based Routing (expo-router)

### Community 11 - "Offline-First Guarantee"
Cohesion: 0.67
Nodes (4): No Data Collection / Fully Offline Claim, Airplane-Mode Real-Device Release Gate, Zero Network Calls Constraint, Offline-First Principle (no network calls at all)

## Knowledge Gaps
- **148 isolated node(s):** `name`, `slug`, `version`, `orientation`, `icon` (+143 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Expo Runtime Dependencies` to `Package & Build Tooling`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `Direction` connect `Data Repositories (Dictionary/User)` to `App Screens & Local Storage`, `Translation Engine & DB Build`, `Phrasebook & Category Browsing`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `name`, `slug`, `version` to the rest of the system?**
  _150 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Screens & Local Storage` be split into smaller, more focused modules?**
  _Cohesion score 0.10801393728222997 - nodes in this community are weakly interconnected._
- **Should `Expo Runtime Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `Package & Build Tooling` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `Expo App Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._