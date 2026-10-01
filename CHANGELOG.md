# Changelog

## [Unreleased]

### Changed

- Review cards now speak when you tap the Urdu word, with no separate Speak button.
- Review ahead is a slider instead of a days box: it snaps from Now through 1, 2, 3, 5, 8, 12, 16 and 20 hours, days, weeks and months to 1 year, and says how many more items each step adds.
- The ChatGPT buttons on the Vocab tab read as matching pairs: **Copy new-vocab prompt** (was Copy prompt) and **Paste check reply** (was Paste corrections).
- The ChatGPT prompts ask for strict JSON with no double quotes inside the text, so replies paste first time; a bad paste now says what to ask the chat for.
- The ChatGPT buttons sit at the top of the Vocab tab instead of below the list, and saving fill-ins updates the count of items still missing fields.

### Added

- A **Dash** tab after Review shows what you know and what to do next: how many items are Known (an interval of 14 days or more) and the band mix over time; reviews due over the next two weeks, with overdue and never-reviewed counts; your 30-day recall against an 80–90% target, with a hint about the review spacing; the items you keep missing, each a tap away from its entry; the learning backlog against weekly additions; and a 12-week review calendar. Viewing it changes nothing.
- A Back button in reviews lets you revisit the previous card and correct an accidental grade, including after the last card.
- **Find new words** on the Vocab tab: paste a word list from ChatGPT to see which words you already have, then copy only the new ones back to the chat for `vocab-json`. The ChatGPT Project instructions gain a `vocab-list` command that gives that list in Urdu script, one word per line.
- An ⓘ beside each ChatGPT button row on the Vocab tab shows that round trip's steps.
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
