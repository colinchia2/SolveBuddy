# SolveBuddy — Agent Handoff

**Owner:** Colin (software engineer + entrepreneur, NYC; builds with Claude + Claude Code)
**Date of handoff:** 2026-10-20
**Scope of this agent:** the SolveBuddy app: product, game rules, solver/hint engine, puzzle generation and packs, offline architecture, and UI/UX per the approved mockups.
**Related:** SolveBuddy is one of six "Buddy" apps → see `BUDDY_FAMILY_HANDOFF.md` for naming, the logo system and portfolio context.

> **DECIDED** = Colin explicitly chose it. **RECOMMENDED** = Claude proposed it and Colin didn't push back; confirm before big irreversible work. **OPEN** = not decided.

---

## 1. Why SolveBuddy exists (Colin's motivation)

- Colin loves daily logic and word puzzles. It started with the NYT Mini crossword, then Wordle, Connections, Sudoku, and now **Star Battle / LinkedIn "Queens."** He also plays LinkedIn's **Tango, Patches and Mini Sudoku**, and has "plenty, plenty more" favorites.
- Pain points:
  - NYT and LinkedIn games are beautifully designed and have hints or solution reveals, but you **get one a day**, and if you miss one you can't go back.
  - Free sites have unlimited puzzles but **the UI/UX isn't as thoughtful.**
  - He **gets stuck** (especially on Star Battle) and doesn't know what to look for next.
  - **Screenshots to Claude, ChatGPT or Gemini give unreliable hints.** LLMs aren't dependable at this logic.
  - He wants fun Sudoku variants (thermometer, killer, etc.) too, which need sophisticated hints.
  - Sourcing and generating puzzles reliably is a worry ("so close but not reliable").
- The vision: **one app with lots of each puzzle type, playable any time, a bespoke UX he loves, and a great hint button** that analyzes the current board and gives the next step.

## 2. Core technical principles (DECIDED / RECOMMENDED)

1. **No LLM at runtime for hints or generation.** All of these puzzles are constraint-satisfaction problems. A **deterministic solver** is perfectly reliable.
2. **Hints come from a human-style technique solver.** Implement named techniques ranked by difficulty, for example:
   - "region confined to one row/column claims that line";
   - "N regions confined to N columns";
   - "cells around a star are eliminated";
   - Sudoku: naked/hidden singles, pairs, pointing, etc.
3. **Generation = generate + verify.** Randomly generate a layout or givens. The solver checks there is **exactly one solution** (otherwise discard). The **difficulty grade = the hardest technique required.** This gives unlimited, verified, graded puzzles.
4. **Least AI cost** (family-wide principle). An LLM may optionally rephrase hint text; the logic always stays in code.
5. **Fully offline** (DECIDED): download puzzle packs, then play **and get hints in airplane mode.** The solver runs on the device. **No backend needed.**
6. **Platforms** (DECIDED): **iPhone app (TestFlight; Colin has the Apple Developer Program) + website.** RECOMMENDED: an installable PWA for web; native iOS with packs bundled or downloaded.

## 3. Hint system — final spec (DECIDED)

- There is **no fixed number of hints per puzzle.** Each tap of **Hint** analyzes the board **as it is right now**:
  1. **Mistakes first.** If anything placed contradicts the unique solution, the hint points to the mistake (e.g. "Something's off in row 4") instead of a hint elsewhere. This is **algorithm behavior, not a user setting.** Colin clarified "check for mistakes" was a note for the algorithm, so there is **no settings toggle** for it.
  2. If there are no mistakes, it finds the **simplest applicable technique** for the next step.
- Each hint has **three levels of detail, clicked through in order:** **Nudge → Explain → Show me.** No settings to configure this; "they just are this way."
  - Nudge, e.g. "Look at the orange region."
  - Explain, e.g. "Orange lives entirely in the bottom row, so its star must be there — eliminate the striped cells."
  - Show me: it performs or marks the move.
- After **any** board change (from a hint or the player's own move), the next hint is recomputed from the new state.
- Visuals:
  - the focus region/box is highlighted in full color, others dimmed;
  - cells to eliminate get diagonal terracotta stripes;
  - the target cell gets a terracotta ring;
  - a step indicator shows three bars;
  - a technique chip names it (e.g. "Confined region", "Last cell in box").

## 4. Games & naming (DECIDED)

Use **generic names**, not trademarks. Don't copy NYT/LinkedIn names, branding, styling or their puzzles.

| SolveBuddy name | Equivalent | Rules |
|---|---|---|
| **Star Battle** | LinkedIn Queens | One star per row, column and colored region. Stars never touch, even diagonally. Tap once = ×, twice = ★. |
| **Sudoku** (Mini 6×6, Classic 9×9, variants later) | Mini Sudoku / Sudoku | Each row, column and box holds each number once. Variants later: **killer** (cages that add up), **thermo**, others. |
| **Binairo** (aka Takuzu / binary puzzle) | LinkedIn Tango | Two symbols. No more than two of the same adjacent in a row or column. Equal counts per row and column. Tango-style "=" / "×" clues between cells (classic Binairo instead forbids identical rows/columns). Colin: "okay good to keep." |
| **Shikaku** | LinkedIn Patches | Split the grid into rectangles; each contains one number equal to its area (Patches also constrains shape: square / tall / wide). |
| **Five Letters** | Wordle | Guess the hidden 5-letter word in six tries (word list based). |
| **Groups** | NYT Connections | Sort 16 words into 4 hidden groups. **Handmade**: generating good misdirection is creative, so Colin wants to **brainstorm terms with Claude and create them himself** later. |

- **v1 priority:** asked but not answered. Working assumption: **Star Battle + Sudoku first.** OPEN.
- **Puzzle sources:** generated only, or also importing puzzles Colin finds? OPEN (affects Packs).

## 5. Design system (current approved state)

Brand: the SolveBuddy face (blue `#4D96FF`, light-bulb eyes), from the finalized Buddy logo set. Ink `#5D4E37`.

**Colors**

| Role | Value |
|---|---|
| Background | warm off-white `#F6F4F1`, with soft blurred background glows: pale blue `#DCE9F2`, mint `#BFE3D8`, lavender `#E8E4F3` (opacity ~0.6–0.7, `filter: blur(50px)`) |
| Ink (text) | `#2A211B` |
| Body text | `#4E433A` |
| Muted | `#6B5D52` |
| Accent (terracotta): hints, highlights | `#C24E2A` / dark `#A23F20` / soft `#FBE3D6` / mid `#F4C7B2` |
| Sudoku selection & pencil marks (blue) | selected cell `#C9DBF7` + ring `#2F6FD6`; peers (row/col/box) `#EEF3FA`; same digit `#D7E4F8`; user digits & pencil marks `#2F5FB8`; givens stay ink `#2A211B` |
| Board surface | `#FFFDF9`, thin lines `#E6DACD`, thick lines `#2A211B` (3px) |

Per-game tile colors (soft bg / ink):

| Game | Soft bg | Ink |
|---|---|---|
| Star Battle | `#FBE3D6` | `#C24E2A` |
| Sudoku | `#D7EEEA` | `#1F6F73` |
| Binairo | `#F8EBC9` | `#8C5F00` |
| Shikaku | `#F8DDE5` | `#A8325A` |
| Five Letters | `#ECE2F7` | `#6A45B0` |
| Groups | `#DDEFD9` | `#2F6B4A` |

Star Battle region palette, displayed **lightened**: `color-mix(in srgb, <color> ~42–48%, #FFFDF9)`. Colin wants the soft/transparent look.
- A `#D8C3EA`
- B `#FFD08A`
- C `#A6D8D0`
- D `#C6E2A6`
- E `#F5C2C9`
- F `#FFB48A` (or `#FF9F6E` for the highlighted hint region)
- G `#BFD3F2`
- H `#E9D9B8`

Rule conflicts: cell `#F4A6A0`, star `#B3261E`.

**Liquid glass — clear, NOT tinted** (DECIDED). Colin rejected the orange tint.
- **Glass control:** `background: rgba(255,255,255,0.3); backdrop-filter: blur(18px) saturate(160%); border: 1px solid rgba(255,255,255,0.75); box-shadow: 0 6px 18px rgba(30,30,30,0.07), inset 0 1px 0 rgba(255,255,255,0.9)`.
- **Glass card:** `rgba(255,255,255,0.38–0.42)`, blur 16, white border 0.8.
- **Sheets/modals:** `rgba(255,255,255,0.62–0.72)`, blur 28.
- Shadows are neutral `rgba(30,30,30,…)`, never warm brown.
- The tint came from warm background glows showing through the glass, so the glows must stay cool or neutral.

**Shape:** "2/10 roundness": gentle, not pill-shaped.
- buttons 10–12px; cards 14–16px; chips 8px; icon tiles 10px; boards 10px;
- floating tab bar 22px; sheet tops 22px; modal 20px.
- Pill buttons were rejected.

**Type**
- **Bricolage Grotesque** 700/800 for titles.
- **Inter** 400–700 for UI.

**Iconography:** Colin wants **lots of icons**. Inline stroke SVGs everywhere:
- buttons (Restart, Undo, Hint bulb, Show me eye, Next arrow, Got it check, Erase, Notes pencil);
- section headers, chips, status, chevrons;
- streak flame `#E8743F`.

**Layout rules**
- Every screen must fit **one phone screen (390×844) with no scrolling or scrollbars** (DECIDED).
- Touch targets ≥44px.
- Header controls are 44×44 glass squares.

## 6. Screens (approved mockups — SolveBuddy canvas)

All artboards are 390×844 and interactive in the canvas "Play" mode.

### Home (`Main.dc.html`)
- **Header:** SolveBuddy face (40px) + "SolveBuddy" wordmark. Right side: streak chip (flame + "5 days") and a **profile avatar** (a "C" circle, `#FBE3D6` / `#A23F20`). The avatar opens **Profile & settings** (DECIDED: avatar on Home → settings).
- **"Daily set" removed** (DECIDED).
- **Center of the screen:** "What are we solving?" with a **2×3 grid of all six puzzles**. Each tile: 56px icon tile, name, count ("60 puzzles", "Classic + variants", "30 puzzles", "Unlimited", "Handmade").
- **Tap a tile:** a glass card **zooms out from that tile's position to the center** (`transform-origin` set per tile, a scale 0.35 → 1.04 → 1 overshoot animation, ~0.45s); a blurred dim backdrop; staggered fade-up content.
  - Card contents: big icon, name, one-line rules, **"Choose difficulty": Easy / Medium / Hard / Expert** (2×2 buttons with 1–4 ascending bars; notes "Warm-up / Some thinking / Real deductions / No mercy"), **Play {level}** button, close ×.
  - Play routing in the mock:
    - Star Battle: Easy/Medium → 6×6, Hard/Expert → 8×8.
    - Sudoku: Easy → 6×6 Mini, else → 9×9.
- **Bottom bar:** floating clear-glass tab bar with **3 tabs: Library · Packs · Stats** (DECIDED; earlier 4 tabs were rejected). The active tab gets a white glass pill.

### Star Battle 6×6 with hint demo (`StarBattle.dc.html`)
- **Header:** back · title "Star Battle" + "6×6 · Starter pack · #12" · top right: **? (rules) · Undo · Hint**. These are small 44px glass buttons (DECIDED: moved from a big row under the board to the **top right**). Hint pressed = white glass + dark border.
- **Info row:** timer · "1 per row, column & region" · **Restart** (renamed from Reset; DECIDED).
- **Board:** 56px cells, thick borders between regions.
- **Hint panel demo:** the 3-step ladder on a sample puzzle (Region F in the bottom row → eliminate three cells).
- Sample regions:
  ```
  AAABBC
  AABBCC
  DABCCC
  DDEECC
  DEEEEE
  DDEFFF
  ```

### Star Battle 8×8, no hints (`StarBattle8.dc.html`)
- The board is **vertically centered** on the screen (DECIDED). 44px cells, lightened region colors.
- **Tap cycles empty → × → ★.** Conflicting stars (same row/col/region or touching) turn red.
- Star counter "n / 8 stars"; tip "Tap once for ×, twice for a star."
- **"?" opens a "How to play" bottom sheet** with icon rows (one star per row/column/region; stars never touch; × vs ★ taps; hint behavior).
- Sample regions:
  ```
  AAABBBCC
  AABBBCCC
  ADBBCCHH
  DDDEECHH
  DDEEEFFH
  DEEEFFGG
  DDFFFGGG
  DFFFGGGG
  ```

### Sudoku 9×9 (`Sudoku9.dc.html`), the reference Sudoku design
- Header the same as Star Battle (back, title "Sudoku" / "Classic 9×9 · Medium", ? · Undo · Hint). Timer + Restart.
- **Selecting a cell** highlights its **row, column and 3×3 box** in soft blue. All cells with the **same number** get a slightly deeper blue. The selected cell is light blue with a blue ring. Transitions are 0.15s.
- **Pencil marks:** mode bar **Normal | Corner | Center | Erase** (glass segmented control with icons).
  - **Corner** marks fill the corners first (TL, TR, BL, BR), then the top/bottom middle, then the side middles, as small blue digits.
  - **Center** marks are small blue digits in the middle of the cell.
  - Entering a value clears the marks; Erase clears value + marks.
- **Keypad: 3×3 grid of 1–9** (DECIDED; rejected a single row of 9).
- No hint panel showing by default.

### Mini Sudoku 6×6 (`Sudoku.dc.html`)
- **Aligned with the 9×9 design** (DECIDED): same highlighting, blue selection, pencil modes, ? rules sheet, and a 3×2 keypad (1–6) under the mode bar. Boxes are 2×3.
- **Hint** is a **glass card that slides up from the bottom** when the bulb is tapped. It steps **Nudge → Explain → Show me**, then closes. The demo uses the "last cell in box" technique with a terracotta box highlight and target ring.

### Puzzle packs (`Packs.dc.html`)
- Header "Puzzle packs" (package icon): "Download once, play anywhere — even in airplane mode. Hints work offline too."
- **Two collapsible sections with animation** (DECIDED). A chevron button rotates; the section height animates via grid-template-rows 1fr↔0fr + opacity, ~0.4s ease-out.
  - **On this phone · 3:** Star Battle Starter (6×6, 30, Easy–Medium, 12/30), Star Battle Classic (8×8, 30, Medium–Hard, 0/30), Mini Sudoku Dailies (6×6, 30, Easy, 9/30). Each has a downloaded check and a progress bar.
  - **Get more · 3:** Killer Sudoku (Get), Binairo Starter (Get), Handmade Groups "Written by Colin" (Soon).
- 3-tab glass bar (Packs active).

### Profile & settings (`Settings.dc.html`)
- **Profile card on top:** avatar "C", "Colin", "5-day streak · 47 solved", Edit.
- **Gameplay settings grouped per game, with labeled headers and game icons** (DECIDED: make it clear which settings belong to which game):
  - **All puzzles:** Show timer (on) · Show mistakes as I play (off) · Haptics (on)
  - **Sudoku:** Highlight row, column & box (on) · Highlight matching numbers (on)
  - **Star Battle:** Auto-cross around stars (on)
- **Appearance:** Theme Light / Dark / Auto (segmented).
- **Offline:** Download packs on Wi-Fi only (on) · Manage packs → Packs.
- **Removed** (DECIDED): "Check for mistakes first" toggle and "First hint shows" selector.
- Switches: 50×30, dark `#2A211B` when on.

### Stats (`Stats.dc.html`)
- Colin likes this as a starting point. Fun visualizations come later.
- Contents:
  - three tiles: Day streak (5), Solved (47), Best streak (12);
  - an **October calendar heatmap** (puzzles per day, 5-step terracotta scale, today ringed, future dashed);
  - **By puzzle** rows (icon, solved count, average time, bar): Star Battle 18 · 3:12, Sudoku 21 · 4:05, Binairo 6 · 1:58, Shikaku 2 · 2:40;
  - a **"68% solved without hints"** ring + "Most-used hint: confined region."
- These are sample numbers.
- 3-tab bar (Stats active).

## 7. Iteration history (what Colin rejected — don't regress)

1. Cool blue-grey palette → **warmer** palette.
2. Fully pill-rounded buttons → **2/10 roundness**.
3. Too few icons → **more icons everywhere**.
4. Solid bottom bar → **floating liquid-glass bar**.
5. Big Undo/Hint buttons under the board → **small, top right**.
6. "Reset" → **"Restart"**.
7. Today's set dominating Home → **Library grid centered**, and the Daily set strip later **removed** entirely.
8. 4 tabs (Today/Library/Packs/Stats) → **3 tabs (Library/Packs/Stats)**.
9. Orange-tinted glass → **clear glass** (cool background glows).
10. Scrollbars → **every screen fits one 390×844 screen**.
11. Dark Star Battle regions on 8×8 → **lightened** like the 6×6.
12. Sudoku keypad in one row → **3×3 keypad**.
13. Red/terracotta Sudoku selection and pencil marks → **blue**.
14. Hint settings → **none**; hints always Nudge → Explain → Show me.
15. Settings gear on Home → **profile avatar** that opens Profile & settings.

## 8. Suggested architecture (RECOMMENDED — confirm with Colin)

- **Engine package** (pure TypeScript, shared by iOS and web), per game:
  - `rules` (validate a board);
  - `solver` (unique-solution search);
  - `techniques[]` (ordered, each returning `{ name, focusCells, eliminate/place, nudgeText, explainText }`);
  - `generator` (layout + uniqueness + difficulty grading);
  - `hint(board)` = mistakes-vs-solution check first, then the first applicable technique.
- **Puzzle pack format:** JSON per pack:
  - `{ id, game, size, difficulty, puzzles: [{ id, givens/regions, solution, difficultyScore, techniquesUsed }] }`;
  - shipped bundled or downloaded, cached for offline.
- **Clients:**
  - an iOS app (Expo/React Native fits Colin's TasteBuddy stack; TestFlight);
  - a web PWA with a service worker for offline;
  - progress, stats and settings stored on the device (sync is OPEN).
- **Visual tokens:** mirror §5 in one tokens file shared by both clients (TasteBuddy's rule: web and app tokens must match exactly).

## 9. Open questions for Colin

1. v1 game priority (assumed Star Battle + Sudoku first). Which Sudoku variants first (killer? thermo?).
2. Generated puzzles only, or also importing puzzles he finds?
3. Native iOS framework (Expo like TasteBuddy?) + PWA — confirm.
4. Star Battle sizes / multi-star variants (2-star 10×10?) for Expert.
5. Dark theme design (the setting exists; no mockup yet).
6. Stats visualizations to add later; whether stats or progress sync across devices.
7. Daily puzzles concept: removed from Home. Does any "daily" exist (for streaks)?
8. Groups: start the handmade-word brainstorming with Claude when ready.

## 10. Artifacts & files

- **SolveBuddy design canvas:** https://claude.ai/artifact/X4xg7mJWsbHr38WbVCppqi (private to Colin). Artboards:
  - Row 1: `Main.dc.html` (Home), `StarBattle.dc.html` (6×6 + hint), `Sudoku.dc.html` (Mini 6×6), `Packs.dc.html`.
  - Row 2: `StarBattle8.dc.html` (8×8), `Sudoku9.dc.html` (9×9 + pencil marks), `Settings.dc.html` (Profile & settings), `Stats.dc.html`.
- Source copies of every artboard are in `design/solvebuddy/` (+ `canvas.json`).
  - Each is a self-contained HTML design component: inline styles hold the exact tokens; the `<script data-dc-script>` block holds the interaction logic (hint steps, pencil-mark modes, highlighting, tap cycling, collapsible sections, zoom modal).
  - Use them as the visual and behavioral spec. They are not production code.
- Logo: SolveBuddy face SVG (also in the Buddy handoff's `logos/`):
  `<circle cx="50" cy="50" r="45" fill="#4D96FF"/>` + white light-bulb eyes with `#5D4E37` outlines and base lines + smile `M25 57 Q50 85 75 57`.
