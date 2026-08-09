---
name: figma-alignment
description: >-
  Run the advisory Figma visual-alignment review (Layer 2): for an epic, compare
  each live Playwright app screenshot against its Figma Design UI frame and write
  a per-epic alignment report. Use when asked to check or regenerate the
  Figma↔runtime visual alignment, run the "Layer 2" / visual-alignment review,
  confirm the UI generally matches the design frames, or produce/update an
  alignment report for an epic (Homepage, Orchestration Study, Realtime Study,
  Camera Registry) — typically after the e2e screenshots change. Depends on
  Layer 1: it consumes the screenshots captured by the Playwright e2e suite
  (run the e2e tests first if they are missing or stale).

---

# Figma visual-alignment review (Layer 2)

Layer 1 (the Playwright suites) captures a screenshot of each UI state. This
skill pairs each screenshot with the corresponding Figma Design frame and judges
**general** visual alignment (NOT a pixel diff), writing an advisory markdown
report. It is advisory — not a CI gate — and needs the Figma MCP, so it runs
locally/on demand.

## Where things live (read from `docs/figma-sources.yaml`)
- **Mapping:** `docs/figma-sources.yaml` — `epics[].stories[].ui[] = { node, shot }`
  (desktop) plus an optional parallel `ui_mobile[]` for stories whose `@mobile`
  behaviour diverges, plus `file_key` and each epic's `epic_dir`.
- **App screenshots:** desktop at `e2e/__screens__/<epic_dir>/<shot>.png`,
  mobile at `e2e/__screens__/<epic_dir>/mobile/<shot>.png` (both gitignored;
  produced by Layer 1).
- **Report output:** `e2e/<epic_dir>-alignment.md` (gitignored).
- **Figma frames:** fetched via the Figma MCP by `file_key` + `node`.

Each pair from `list_pairs.py` carries a `viewport` field (`"desktop"` or
`"mobile"`) and its `screenshot` path already points at the right directory, so
treat desktop and mobile pairs the same way — only the source frame and the
screenshot location differ. Mobile Figma frames may not exist yet (`node: null`),
in which case list them under "Drift to reconcile" like any other `shot: null`
pair.

## Workflow

1. **Get the pairs** (run from the repo root):
   ```bash
   python3 .claude/skills/figma-alignment/scripts/list_pairs.py <epic|all>
   ```
   Prints JSON per epic: `file_key`, `report_path`, and `pairs[]` of
   `{ story, viewport, node, shot, screenshot, screenshot_exists }`.

2. **Ensure screenshots exist.** If any `screenshot_exists` is `false` (and `shot`
   is not null), capture them first, then re-run the helper.

3. **For each pair that has a screenshot:**
   - Fetch the Figma frame. Load the tool if deferred:
     `ToolSearch select:mcp__304deedb-d707-4810-85d4-782de69af92d__get_screenshot`,
     then call it with `fileKey` + `nodeId` (the `node`) and `maxDimension: 1184`.
     It returns a short-lived URL + a curl command; download and view it:
     ```bash
     curl -s -o /tmp/fig-<shot>.png "<url>"
     ```
     Then Read `/tmp/fig-<shot>.png`. (If that MCP errors, fall back to
     `mcp__figma-desktop__get_screenshot` with the same `nodeId` — needs the
     desktop app.)
   - Read the app screenshot at `screenshot`.
   - Judge **general** alignment using the rubric below.

4. **Pairs with `shot: null`** have no app screenshot (design-ahead frame, no
   runtime equivalent yet) — don't fetch/compare them; list them under "Drift to
   reconcile."

5. **Write the report** to the epic's `report_path` (template below).

6. **Return** the summary table + the drift list, and confirm the report path.

## Rubric — general alignment, NOT pixel diff
A live browser render never pixel-matches a mockup; judge *intent*:
- Same overall layout / regions (header, grid, controls, footer).
- Key elements present and roughly placed (camera tiles, status indicators,
  sound/fullscreen controls, wordmark, study selector).
- Mint accent (`#00FFB2` or similar) where expected for highlights and active states.
- Copy matches (allow minor wording differences and font reflow).

Per pair, give a **verdict** — `Aligned` / `Minor differences` / `Notable
differences` — plus 1–3 notes. When they differ, name the likely **drift
direction**: stale Figma frame (behind the shipped runtime) vs runtime drift
(behind the design). This review doubles as Figma↔runtime drift detection.

## Report template
Write `e2e/<epic_dir>-alignment.md`:

```markdown
# <Epic> — Figma alignment (advisory)

General visual-alignment check of the live app (Playwright screenshots) vs the
Figma Design frames. Not a pixel diff — judges layout/structure/copy intent.

| shot | verdict | note |
|---|---|---|
| <shot> | Aligned / Minor / Notable | one-line note |
| …

## <shot> — <verdict>
- match: …
- differs: …
- drift: stale frame | runtime drift | n/a

## Drift to reconcile
- <shot> (node <node>): … (and any `shot: null` design-ahead frames)
```
