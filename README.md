# Kids' Weekly Checklist

A picture-first weekly chore and homework checklist for children, built to be usable by a child who
cannot yet read. Every task is identifiable from its artwork alone.

One self-contained HTML file. No build step, no dependencies, no external requests — it runs from a
locked-down iPad with no open web access, added to the Home Screen.

---

## Status

**Private working version.** Not yet published, not yet for sale.

## Repository layout

| File | Purpose |
|---|---|
| `index.html` | The entire application — markup, styles, script, and 34 base64 WebP icons |
| `README.md` | This file |
| `.gitignore` | Keeps local backups and OS clutter out of version control |

`index.html` is the deliverable. There is deliberately nothing else.

---

## ⚠️ Before this repository is made public

GitHub Pages requires a public repository, and everything in a public repo is readable by anyone —
including its whole history. A file committed once stays in that history even after it is edited out.

**All of the following must be true first:**

- [ ] `defaults()` no longer contains real children's names, routines, medications, or schedules —
      replace with neutral sample data
- [ ] No personal name, address, location, or family detail anywhere in the file
- [ ] The IXL and Raz-Kids icons are replaced with original artwork *(they are those companies'
      logos; fine for private family use, not for anything distributed)*
- [ ] Privacy grep run over the built file — see the playbook's Phase 7

Until every box is ticked, **keep this repository private.**

---

## Design rules

The product exists because a first-grader who cannot read well still needs to know what to do. Every
rule below serves that and none are cosmetic.

- **The picture carries the meaning, not the label.** Two tasks that can appear on the same day must
  never share an icon.
- **No emoji as the primary icon** — real artwork. Emoji remain in the data as a fallback only.
- **Cream backgrounds for home routines, purple for schoolwork**, so "chore vs school work" reads
  before the picture does.
- Icon names are capitalised, spaced, plain English — "Empty bag", "Spell Ar", "Math multiply".
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
