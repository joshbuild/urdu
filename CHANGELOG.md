# Changelog

## [Unreleased]

### Added

- Mobile app shell with personal-secret unlock, vocabulary and due counts, and device locking.
- App manifest and icons for standalone installation.
- Vocabulary storage with duplicate detection, tagging, search and due-item selection.
- Review recording on the five-grade scale, with mastery and next-review dates maintained by the ladder.
- Full JSON export of the vault.
- First deployment to `urdu.umber-amber.workers.dev`, installable on Android.
- One-time import of the Airtable vocabulary into the vault, preserving mastery and review dates, with a cross-check report of any row where Airtable's schedule disagrees with the ladder.
- Read, Vocab, Review and Settings tabs.
- Reader: paste Urdu and read it right-to-left in a self-hosted Nastaliq font; the text is kept across reloads.
- Tap any word in the reader to hear it spoken in an Urdu voice.
- Voice picker in Settings, defaulting to Pakistani Urdu and listing Urdu voices first, with a sample to listen to.
- Select text in the reader to get a Speak · Add · Define bar above the tab bar.
- Add a selected word or phrase to the vault from the reader, with the sentence it came from saved in notes; an existing entry is shown instead of creating a duplicate.
- Define a selection: shows your saved entry if you have one, otherwise links to Rekhta, Wiktionary and Google Translate.

### Changed

- Per-version preview URLs are no longer published for deployed versions.
