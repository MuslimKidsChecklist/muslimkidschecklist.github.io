# Muslim Kids Checklist

A picture-first weekly chore and homework checklist for children, built to be usable by a child who
cannot yet read. Every task is identifiable from its artwork alone. Includes an Islamic daily
routine (wudu, the five prayers, Qur'an) alongside ordinary chores and homework.

One self-contained HTML file. No build step, no dependencies, no external requests — it runs from a
locked-down iPad with no open web access, added to the Home Screen.

Live at **https://muslimkidschecklist.github.io/**.

---

## Status

**Built, tested, and live.** Not yet selling — the Gumroad account and its four products haven't
been created yet, so the buy path has nowhere to send anyone. See `gumroad-setup.md` in the
Dropbox ENTITY folder for what's left.

The license gate is written and tested against Gumroad's API (34 automated tests, `_gate/gate.test.js`),
but has not yet been walked end to end against Gumroad's real servers.

## Repository layout

| File / folder | Purpose |
|---|---|
| `index.html` | The application — markup, styles, script, 37 base64 WebP icons, and the inlined license gate |
| `privacy.html` | Privacy policy |
| `terms.html` | Terms of service |
| `_gate/` | Source for the trial + license gate (`gate.js`, `gate.css`, `tour.js`, `tour.css`) and its test suite (`gate.test.js`), inlined into `index.html` |
| `README.md` | This file |
| `.gitignore` / `.gitattributes` | Keep local backups and OS clutter out of version control |

`index.html` is the deliverable a browser loads; `_gate/` is where the gate logic is authored and
tested before being inlined.

---

## Design rules

The product exists because a first-grader who cannot read well still needs to know what to do. Every
rule below serves that and none are cosmetic.

- **The picture carries the meaning, not the label.** Two tasks that can appear on the same day must
  never share an icon.
- **No emoji as the primary icon** — real artwork. Emoji remain in the data as a fallback only.
- **Cream backgrounds for home routines, purple for schoolwork**, so "chore vs school work" reads
  before the picture does.
- Icon names are capitalized, spaced, plain English — "Empty bag", "Spell Ar", "Math multiply".
- Fonts are `ui-rounded` / `SF Pro Rounded` so it feels native on iOS.

## Storage keys — do not change these

Changing a key orphans every existing setup.

- Checks are keyed `taskId|sectionId|dayIndex`, stored under `week:YYYY-MM-DD`
- Configuration lives under **`cfg:v3`**
- Week buckets stay Sunday-anchored and day numbers stay absolute (`0` = Sunday) regardless of the
  configured week start. Never key checks off display order.
- Only the current and previous week are retained

## After any edit

1. Icon block byte-identical to the previous version
2. `cfg:v3` unchanged
3. `node --check` on the extracted script — browser brace-checkers have given false passes here

## Testing

iOS Home Screen web apps suppress `confirm()`, `alert()`, `prompt()`, `window.open()` and print
dialogs silently. Desktop Chrome cannot reproduce this, or the 7-day storage eviction, or the print
block. **Test on the iPad or don't claim it's fixed.**
