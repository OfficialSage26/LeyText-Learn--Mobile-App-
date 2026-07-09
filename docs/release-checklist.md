# Release Checklist (run before every release)

## Automated
- [ ] `npm test` - all green
- [ ] `npm run build:db` - exits 0, counts printed

## On a real Android device, AIRPLANE MODE ON
- [ ] Fresh install launches without errors
- [ ] TL->CEB word, sentence, and known phrase translate correctly
- [ ] CEB->TL direction works after swap
- [ ] Unknown word shows gray/italic + note
- [ ] Phrasebook: all six categories open, search works
- [ ] History records; favorites star/unstar; both survive app restart
- [ ] TTS speaks (or icon hidden if no Filipino voice)
- [ ] Mic: works with offline pack, or shows friendly notice
- [ ] Settings: default direction persists; clear history works

## Store
- [ ] Version bumped in app.json
- [ ] `npx eas-cli build --platform android --profile production`
- [ ] Upload .aab to Play Console, attach privacy policy URL
