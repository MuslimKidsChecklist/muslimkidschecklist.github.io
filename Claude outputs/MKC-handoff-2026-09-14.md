# MKC — handoff from the sync-and-wipe chat
**14 September 2026. This chat is being archived; everything below is the record.**

## One-liner on GitHub

**Everything is pushed and verified. `origin/main` is at `76e66e6`, the live site is serving it, and the servable `_gate` files are gone from the site — all checked in the browser, not assumed.** Nothing is waiting to be committed or pushed.

---

## 1. Where the repo actually stands

| | |
|---|---|
| `origin/main` | `76e66e6` — the TASK-382 follow-up, on top of `58ad933` (TASK-402) |
| Kathryn's clone | `76e66e6`, clean, 0 ahead / 0 behind |
| Live site | serving it — confirmed by loading the app and by seven 404s (see §5) |

Recent history, newest first:

```
76e66e6  TASK-382 follow-up: take the servable gate files back out, and ignore them
02d9ac7  1   <- accidentally re-added the gate files; 76e66e6 undoes it
58ad933  TASK-402: put an earlier day back from the Grown-ups panel
dfb6947  Rename tour.js to tour.js.SUPERSEDED.txt          ) TASK-382,
8ede6b0  Rename tour.css to tour.css.SUPERSEDED.txt        ) pushed by
9d9a150  Rename gate.test.js to gate.test.js.SUPERSEDED.txt) another
39a9e71  Rename gate.css to gate.css.SUPERSEDED.txt        ) session
16d10e2  ASK-382: fix typo from the previous rename
d9e2d1a  TASK-382: rename _gate/gate.html off a servable extension
f9a9624  TASK-382: rename _gate/gate.js off a servable extension
95aa0ca  TASK-382: delete stale git lock index.lock.stale-1787452062
ddca448  TASK-382: delete stale git lock index.lock.stale-1787449884
a8a346c  TASK-382: delete _to_delete/_page.css
a6408fb  TASK-387: one sync row per child, daily history, and three fixes
981ba5c  TASK-362: correct two stale comments in the entitlement lists
```

### Correcting two things the other thread was told

That thread's P0 was *"push `a6408fb`, and paste a query showing why the write side of sync silently drops rows."* **Both were already done.**

1. **`a6408fb` has been on origin since 11 September.** There was never anything to push. What Kathryn's GitHub Desktop was showing — *Pull origin (10 commits)* — was correct: her clone was ten commits **behind**, not ahead.
2. **The silent row-drop was found and fixed on 14 September** (TASK-401, below). It was three separate gates stacked on top of each other, each invisible until the one before it was open.

---

## 2. TASK-401 — why sync silently dropped rows *(closed, verified)*

Three independent faults, all in Supabase, all silent:

1. **`pull_checklist` had no `ORDER BY`.** PostgREST caps a response at 1000 rows, so the family got an arbitrary — in practice the *oldest* — slice. Newer rows simply never arrived.
2. **`push_checklist` had an allowlist of `('cfg','check')`.** Anything else returned **HTTP 204 and inserted nothing.** A success code for a write that did not happen.
3. **The table's `checklist_progress_kind_ok` CHECK constraint** allowed the same two kinds and rejected the rest with `23514`.

All three are fixed. `pull_checklist` now orders non-check rows first and filters check rows older than sixteen days; `push_checklist` accepts `('cfg','check','kid','cfghist')`; the constraint matches.

**Evidence, live, 14 September:**

```
push  cfg|cfg · kid|majd · kid|amira · cfghist|2026-09-14   → all 204
pull  751 rows:  cfg 1 · kid 2 · cfghist 1 · check 747
      kid|majd → Majd Dean / 45 tasks · kid|amira → Amira / 54 tasks
      cfghist|2026-09-14 → Majd Dean:45, Amira:54
```

If that thread wants to confirm it independently:

```sql
select kind, count(*), max(to_timestamp(updated_ms/1000)) as newest
from public.checklist_progress
where fp = (select fp from public.checklist_progress group by fp order by count(*) desc limit 1)
group by kind order by kind;
```

Four kinds should come back — `cfg`, `cfghist`, `check`, `kid`. Before 14 September it would have shown two.

**Standing rule that came out of this:** Supabase's *"Success. No rows returned"* is what it says for **any** DDL, including one that did not apply. One of these three fixes reported success and had not been saved. **Every schema change now ends with a `select` read-back.** That is written into the Product Implementation & Verification guide.

---

## 3. TASK-387 — the family-profile wipe *(closed 14 September)*

**What happened:** if a device could not read its saved setup, the app showed the built-in demo child "Yusuf", **overwrote its own stored copy with it**, and the next thing the parent tapped was pushed over the whole family's record on every device. Tapping *"Clear all tasks"* to get rid of the strange demo child — the most natural thing a parent would do — was the thing that armed the push.

Reproduced byte-for-byte, including `"wk":0` and key order, against the build that was live on 9 September.

**Shipped in `a6408fb`:**

1. A device that failed to read no longer overwrites its own stored copy.
2. A device can only push a setup it actually loaded, **and** only if one of its children is one the family already has.
3. The cloud always wins while a device is showing the demo child.
4. **One sync row per child**, with per-child timestamps and tombstones — Spelling Quest's and One Ayah's design, which is why neither of them has ever had this failure. A bad device can now at worst damage the children it holds.
5. **A dated copy of the whole setup once a day**, never replaced by a copy with fewer children or fewer tasks.
6. Rolling local snapshots of the last five working setups.
7. The *"could not read your settings"* warning and Retry button, which were **dead code** behind a flag that is always true on GitHub Pages.
8. A record of **why** a read failed — missing, empty, unparseable with length, no kids field, zero children, or storage threw — plus whether the licence survived, and the user agent.

**Recovery is finished.** Both children were rebuilt from the 2 September config plus five later tasks reconstructed from surviving check rows and identified with Kathryn one by one. Backups saved to Drive for 9 and 10 September.

**The one thing still open — and it is not this card's to hold.** We know what turned a bad read into a family-wide wipe, and that path is closed. We do **not** know what made the saved setup unreadable in the first place. The iOS-eviction theory has a hole: eviction clears the licence key too, and a device with no licence cannot sync at all, so it could not have pushed anything — and on Kathryn's Mac the licence sat right next to the wiped config. **A single unreadable config value fits the evidence better than a whole-origin eviction.** Item 8 exists to answer it the next time rather than reasoning about it; the diagnostics are armed and have not yet caught an occurrence. **That question now sits with the scheduled MKC review on 25 September.**

**Add to Home Screen is not the product's answer** — Kathryn's call, 10 September: families will not do it on every device, and a product that loses a paying customer's setup unless they know an iOS trick is broken.

---

## 4. TASK-402 — "Go back to a day" *(built, pushed, verified live today)*

The daily copies existed but **nothing read them**, so recovery still meant querying the store by hand. A parent cannot do that — and a school night can add five tasks in thirty-seven minutes, which is what Kathryn's own data shows for 10 September.

**Now in the Grown-ups panel:**

- **"Go back to a day"** lists the saved days newest first, each with its children and task counts. Today and yesterday are named rather than dated.
- **A preview before anything changes** — *Comes back* and *Goes away*, by child and task count, and a plain line saying it changes every device. Never a silent replace.
- **Restore goes through the same path a normal edit takes**, so the per-child rows and their timestamps are written too. A raw config overwrite would leave the child rows stale and the next pull would quietly undo the restore. Children the chosen day does not have are **tombstoned**, or another device puts them straight back.
- **The state from just before a restore is kept**, so a mistaken restore is itself undoable.
- **A family with no saved days yet is told copies start today**, rather than shown an empty box.

**Tested before push**, isolated browser, three seeded days including one holding a child who no longer exists: the restore pushed the config, all three child rows including the returning child, and the day's history row; the undo pushed that child's tombstone and cleared its slot. The wipe and per-child regression suites still pass. No horizontal overflow at 390px or 820px.

**Verified live** in Kathryn's browser with her real licence:

```
"Go back to a day" present · preview · "Put this day back" · "Undo the restore"
cfg on this device   → Majd Dean 45, Amira 54
saved days read back → 2026-09-14 -> Majd Dean 45 tasks, Amira 54 tasks
```

**One saved day so far, which is correct** — the daily copies only began when TASK-401 opened the sync rows this afternoon. **A second day appears tomorrow, and that is the first real test of the list.**

---

## 5. Open items

| Item | State |
|---|---|
| **TASK-403** — check-mark retention | On Hold to **9 October**. Kathryn's point: no parent asks whether their child brushed their teeth two days ago, but they do ask where their tasks went. Filtering old check rows out of the response gets the benefit with none of the risk. Deliberately held until the TASK-387 trigger question is answered. |
| **Removing "Save a backup" / "Restore a backup"** | Kathryn's stated goal. **Her rule: not until the new screen has been live and watched for a couple of weeks.** The call gets made at the 25 September review. |
| **Untracked gate files** | **Closed, 14 September.** It did not merely nearly happen — commit `02d9ac7` put all six servable files and `_to_delete/` back on GitHub. Undone in `76e66e6`: the files were byte-identical to their `.SUPERSEDED.txt` copies, so nothing was lost; they are now in `.gitignore`, and they have been deleted off the machine. **Verified live — `_gate/gate.js`, `gate.html`, `gate.css`, `gate.test.js`, `tour.js`, `tour.css` and `_to_delete/_page.css` all return 404**, and the app still loads with the restore screen. No task needed. |
| **Git lock files** | Git cannot unlink its own `.lock` files under the Drive-mounted folder, so **every git command can leave one behind** and GitHub Desktop then refuses with *"a lock file already exists in the repository"*. This is the cause of that error, not a crashed process. Fourteen stale leftovers were cleared on 14 September. Workaround (rename rather than delete) is in the guide. **A clone outside the mounted folder would end it for good** — still worth doing. |

## 6. Scheduled

- **MKC twice-weekly backup check** — Mondays and Thursdays. Cloud-only, no device binding.
- **MKC two-week review** — **25 September**. Carries: the unproven trigger; whether the restore screen has behaved; whether the manual backup can come out; and it unblocks TASK-403.

## 7. Where the documents are

All in Google Drive. Nothing lives only in this chat.

- `INBOX/Ready/` — TASK-387 (CLOSED), TASK-401 (CLOSED), TASK-402 (CLOSED)
- `INBOX/On Hold/` — TASK-403, held to 9 October
- `INBOX/_TASK-ID-REGISTER.md` — 401, 402, 403 allocated
- `Universal Files/Product-Implementation-and-Verification-Project-Guide.md` — **v3**, with all four former addendums folded in and none left loose
- `Muslim Kids Checklist ENTITY/` — family backups for 9 and 10 September
- Superseded versions parked in `Inbox Context/Previous routing/`

Only the app code lives outside Drive, in the repo.
