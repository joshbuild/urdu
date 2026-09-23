# Changelog

## [Unreleased]

### Changed

- The ChatGPT buttons sit at the top of the Vocab tab instead of below the list, and saving fill-ins updates the count of items still missing fields.

### Added

- Settings › About shows the app's version (the commit it was built from), when that commit was made and when the app was built.
- Ready-made instructions for a ChatGPT Project: type `vocab-json` at the end of a chat to get the new words as JSON for Paste new vocab.
- Voice tab: talk Urdu with the Coach, with a live transcript, elapsed time and a running cost; ask it to add a word and see each add succeed or fail before it confirms. Leaving the tab or hiding the app ends the session.

- ChatGPT round trip on the Vocab tab: copy a prompt, paste ChatGPT's JSON reply to add new words (duplicates flagged), or copy the incomplete items and paste back their missing fields, previewed before saving.
- Review spacing setting with five presets (Dense to Very wide, Moderate by default); reviews start at 3 hours and reach up to 10 years, and changing the setting moves no due dates. Each preset lists its intervals grouped by hours, days, weeks, months and years.
- Reviews are scheduled to the hour: lists show "Due in 7 h", and mastery pills show the level and interval ("Firm • 3 wk").

- Review tab: due-item sessions in either direction, with speak, reveal, five grades, skip, end early and a tally.
- Review ahead by a number of days.
- Mastery shown as colour-coded pills ("0 • New") in the vocabulary list and detail; the vocabulary sort order is remembered on the device.
- English → Urdu reviews cost less when missed (Wrong −1, Partially correct 0).
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
- Vocab tab: search your vault by Urdu, Roman or English, filter by tag or due items, and sort by date added, next review or mastery.
- Open any vocab item to hear it, see its mastery and review dates, edit any field (including mastery), or delete it.
- Add vocab by hand from the Vocab tab.
- When Add finds an existing entry, an Open it button takes you to that item.
- Review session size setting (default 20).

### Changed

- Per-version preview URLs are no longer published for deployed versions.
