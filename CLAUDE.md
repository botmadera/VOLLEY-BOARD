# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Notes and memory live in this file

The owner works from several machines. Anything worth remembering about this project — decisions, constraints, gotchas — goes **in this file and is committed**, never only into a machine-local memory directory, which does not sync and would leave the other machines blind.

## What this is

A single-page web app for a volleyball coach: paste a roster, drag six players onto the court to set the starting lineup, and generate the six rotations as cards. Rosters and their starting positions can be saved in the browser and reopened. It replaces the hand-drawn process captured in `data/team.txt`.

## Public repo — no real data

Published as a public repo at `github.com/botmadera/VOLLEY-BOARD` (MIT). The names in `data/team.txt`, the tests and the `index.html` placeholder are **fictional** stand-ins for a real roster (which included minors): they keep every property the tests rely on (the `Ramiro`/`Ramírez` → `RAMI` collision, an accent in `Sofía`, a `Nina D` two-word name, a surname-only entry). **Never commit a real roster**, and commit with the GitHub noreply address, not a personal email.

## Running it

Open `index.html` directly — double-click or `open index.html`. **No build, no npm, no dev server.**

Scripts are loaded as classic `<script>` tags in dependency order (`rotations → roster → storage → court → app`), each attaching to a single `window.CB` namespace. This is deliberate: `<script type="module">` is blocked by CORS under `file://` and would break opening the page by double-click. Do not convert these to ES modules.

## Tests

```
node test/logic.test.js     # sin dependencias
npm install && npm test     # incluye el flujo en jsdom
```

`package.json` exists **only for the tests** — the app itself must never require npm.

- `test/logic.test.js` loads `js/rotations.js` / `js/roster.js` / `js/storage.js` into a `vm` context and asserts against `data/team.txt`. Zero dependencies. `-v` prints the full rotation sequence.
- `test/dom.test.js` drives the real page through `JSDOM.fromFile`, clicking through paste → generate players → edit label → place six → generate rotations → clear → save/open/delete templates → reload.

Neither environment has a real `localStorage`, so both inject an in-memory double: `logic.test.js` puts one in the `vm` sandbox (with a `fail` flag to exercise the quota-exceeded path), `dom.test.js` injects one through JSDOM's `beforeParse` hook. The DOM one is deliberately shared between two `JSDOM` instances — that is how "reload the browser" is simulated. Do not rely on jsdom's own `localStorage`: the page is loaded from `file://`, an opaque origin where it may be unavailable.

jsdom has no `DataTransfer`, so **native drag & drop is not covered** — only the click-to-select/click-to-place path. Changes to the drag handlers need manual checking in a browser.

## Architecture

| File | Role |
|---|---|
| `js/rotations.js` | Pure rotation math. No DOM, no state. |
| `js/roster.js` | Text → player list; label generation. Pure. |
| `js/storage.js` | `localStorage` read/write + the pure conversions between state and stored shape. No DOM. |
| `js/court.js` | DOM builders (`playerChip`, `renderCourt`, `rotationCard`). Stateless — takes data, returns nodes. |
| `js/app.js` | The only stateful module: `state`, event wiring, `render()`. |

Single in-memory state object; `localStorage` is written through, never read except at startup:

```js
{ roster: [], lineup: {1..6}, rotations: null, selectedId: null, dragId: null,
  templates: [], templateId: null, confirmId: null }
```

Every mutation calls `render()`, which repaints the panel, the court, and the cards from scratch. With 9 players this is instant, and a full repaint is exactly what the E-Ink aesthetic wants — don't introduce incremental DOM diffing.

The one exception is `refreshLabels()`: editing a label fires on every keystroke, and a full `renderPanel()` would destroy the focused `<input>`. It updates chip text in place instead. Any new per-keystroke interaction needs the same treatment.

Any change to the starting lineup sets `rotations = null` (`touchLineup()`), so stale cards can never be displayed next to a court they no longer match.

## Persistence

Two `localStorage` keys, both wrapped with a `v` field so a future shape change can be detected instead of crashing:

```js
// cb.templates.v1
{ v: 1, templates: [ { id, name, text, labels: {name: label}, lineups: [ {id, name, spots} ] } ] }

// cb.session.v1  — autosaved, whatever the coach was doing last
{ v: 1, templateId, text, labels, spots }
```

**A lineup is nested inside its template, not a sibling collection.** A starting position is meaningless without the roster it refers to, so nesting removes any possibility of orphan references and makes deleting a team take its formations with it.

**Everything is stored by player *name*, never by id.** `parseRoster` regenerates `p1..pN` on every parse, so ids do not survive a reload — or even adding a player to the top of the list. `spotsOf` / `lineupFrom` in `js/storage.js` do the conversion; the id-remapping idea is the same one `onGeneratePlayers()` already used to keep the court alive across a re-parse. **Any new persisted field that references a player must follow this rule.**

Restoring labels goes through the existing path: `Storage.asPrevious(labels)` fabricates the `previous` argument that `parseRoster` already knows how to honour. Don't re-implement label logic.

Other constraints baked into this feature:

- Every `localStorage` access is wrapped in `try/catch` and `available()` is probed once. Private mode, blocked cookies and a full quota must degrade to "can't save" — shown as a `.hint` in the panel — and never break the app.
- `saveSession()` runs at the end of `render()` and `refreshLabels()`, plus on `input` in the textarea (typing the roster repaints nothing but does need saving).
- Opening a saved lineup assigns `state.lineup` wholesale. **Do not route it through `place()`** — that does position-by-position swaps against a court that isn't there yet.
- Saving with a name that already exists **updates in place and keeps the template's lineups**. That is the only way to edit one.
- Deleting takes **two clicks** (the button arms itself, `is-confirming`) instead of `confirm()`: native dialogs break the E-Ink look and jsdom doesn't implement them.
- Clicks inside `.saved` are handled at the top of `onClick` and return early. This is not optional: a separate listener on the list would be followed by the document-level handler, which would see a button that `renderSaved()` had already detached from the DOM, fail its `.closest(".saved")` test, and both disarm the delete and treat the click as "remove the selected player from the court".

## Rotation model

Regulation numbering, net at top:

```
        ── NET ──
   P4     P3     P2      front row
   P5     P6     P1      back row
```

Clockwise rotation follows `CYCLE = [1, 6, 5, 4, 3, 2]` — each player moves to the next position in that cycle. `GRID_ORDER = [4, 3, 2, 5, 6, 1]` is the paint order (front row first).

This is not a guess. The first two blocks of `data/team.txt` are a real hand-written transition, and they match the model in all six positions:

```
TOB NIN RAM      VER TOB NIN
VER R33 PIL  →   R33 PIL RAM
```

**Acceptance test for any change to rotation logic:** starting from front `VER TOB NIN` / back `R33 PIL RAM`, R2 must equal that second block. Blocks 3 and 4 in the file are duplicates of block 2 — an unfinished sheet, not evidence.

## Roster parsing

`data/team.txt` must paste in verbatim and yield 9 players. That drives three rules in `parseRoster`:

- The file has U+2060 WORD JOINER embedded in its numbering — invisible characters are stripped first.
- If the text contains **any** numbered lines, unnumbered lines (`Niñas`) are group headers, not players. If nothing is numbered, every line is a player (hand-typed lists).
- Lines with a tab or 3+ whitespace-separated columns are already-drawn rotation blocks and are skipped, so pasting the whole file works.

Labels are the first 4 alphanumeric characters, accents stripped, uppercased. `Ramiro` and `Ramírez` both give `RAMI`; duplicates get a dashed border so the coach resolves them by hand (that's where the file's `R33` comes from). Hand-edited labels set `labelEdited` and survive re-parsing, keyed by player name.

## Design constraints (`Requirements/theme.txt`)

The E-Ink look is a hard constraint, not decoration. `css/theme.css` is that spec's CSS with three deliberate deviations, all documented in the file:

- **No transitions or animations anywhere.** The rule is universal (`*, *::before, *::after`), not the spec's `body`-only `!important`, which would not stop a child from animating. State changes must be instant — this rules out animated drag previews, fades, and easing.
- `html, body` drops the spec's `max-width: 800px` and `padding`, which conflict with the wide panel + court layout.
- **Always light, always Fira Mono.** The spec's `prefers-color-scheme: dark` block is gone and `color-scheme: light` is set, so the page stays light on a machine in dark mode (including native controls). Background is `#FAFAFA`. The spec's serif body / sans-serif headings split is replaced by one monospace family everywhere via `--eink-font`.

Fira Mono is bundled in `assets/fira/` (SIL OFL, license kept alongside) and declared with three `@font-face` blocks — 400/500/700, `font-display: block` so there is no mid-load font swap. It does not depend on the font being installed. Note that some browsers refuse to load `@font-face` files over `file://`; serve the directory (`python3 -m http.server`) if the type falls back to the system mono.

Otherwise unchanged: 2px borders, buttons that invert on `:active`, `img { filter: grayscale(100%) contrast(120%) }`. `assets/groovepaper.png` tiles as the body background — it is already near-white and neutral, so it needs no blend mode or filter.

Selection state is rendered as a full color inversion, and "already on court" as a switch to `--eink-accent` — never opacity fades or shadows. The open template (`.saved__item.is-current`) and an armed delete button (`.is-confirming`) follow the same rule.

`theme.css` styles by element, not by class, and has nothing for `<select>` or `<dialog>` — both would fall back to the OS-native control and leave the E-Ink look. The saved list uses plain `<button>`s instead. `.saved__open` deliberately drops the theme's 2px border (a column of bordered buttons swamps the panel) and `.saved__title` duplicates `.roster__group`'s look rather than reusing the class, because `dom.test.js` counts `.roster__group` to check the roster's group divider.

## Interaction

Two input paths, both required: HTML5 drag & drop (`draggable` + `dragstart`/`dragover`/`drop`), and click-to-select → click-to-place. The second exists because native DnD does not respond to touch, and a coach on a tablet is the expected user. **Any new placement affordance must work through both.**

Dropping onto an occupied cell swaps; dropping onto the panel removes from court. Rotation cards are rendered by the same `renderCourt` in `readonly` mode and ignore all input (`.court--mini` guards in the handlers).

The saved-templates list is inside the panel but is **not** a placement affordance — it is navigation, so it is click-only and excluded from the panel's "drop here to remove" area (`.saved` guards in `onClick` / `onDragOver` / `onDrop`).

## Language

Specs, data, code comments and UI copy are in Spanish.
