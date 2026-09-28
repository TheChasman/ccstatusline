# Braille Context Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Context Bar's block progress display with a precise, coloured Braille bar that protects its numeric readout on narrow lines.

**Architecture:** A pure utility converts raw token counts into a fixed-width Braille or ASCII rail. `ContextBarWidget` supplies counts, formatting, configuration, and scoped ANSI colours. The line renderer measures its fully assembled output and re-renders Context Bar at a shorter width before ordinary truncation.

**Tech Stack:** TypeScript, Bun, Vitest, existing ANSI and widget utilities.

**Spec:** `docs/ccstatusline-usage-upgrade.md`

## Global Constraints

- Keep the current raw `current_usage` and transcript fallbacks and the numeric `used/limit (percent)` readout.
- Default width 25 cells; shrink to 10 cells, then omit the rail when space is insufficient.
- Fill ramp `⠀⡀⡄⡆⡇⣇⣧⣷⣿`, dotted track `⣀`, heavy vertical delimiters `┃`.
- Threshold defaults are 50% and 75%, with green, amber, red fill only; expose width, thresholds, and colours through existing widget metadata.
- ASCII `|#-|` fallback under a non-UTF-8 locale; no changes to slider modes or other usage widgets.
- Use `bun test`, `bun run lint`, and `bun run build` for verification.

## Review Focus

- A neighbouring widget consumes width before Context Bar: shrink the rail before truncating the numeric readout.
- With only a rounded `used_percentage`, preserve the old fallback without claiming raw-count precision.
- A global foreground override strips the bar's intrinsic foreground while leaving the visible rail intact.
- Powerline mode retains its segment structure when the rail shrinks or disappears.
- A non-UTF-8 locale produces only ASCII bar characters.

---

### Task 1: Pure bar geometry

**Files:**
- Create: `src/utils/braille-context-bar.ts`
- Create: `src/utils/__tests__/braille-context-bar.test.ts`

**Interfaces:**
- Produces: `makeBrailleContextBar(used: number, limit: number, width: number, ascii?: boolean): string` returning an uncoloured rail.
- Produces: `resolveBrailleBarWidth(metadata?: Record<string, string>): number` returning a clamped integer width (10–80, default 25).

- [ ] **Step 1: Write failing geometry tests.** Assert literal rails for 0, 1, 2, 4, 5, 20 and 100 percent at width 25; assert 1 token lights one step, above-limit fills the rail, zero limit is empty, a 0–100% sweep keeps a constant closing-delimiter column, and ASCII fallback contains only `|`, `#`, `-`.
- [ ] **Step 2: Run** `bun test src/utils/__tests__/braille-context-bar.test.ts`; expect failure because the utility does not exist.
- [ ] **Step 3: Implement** the eight-dot ramp, integer-step clamping, dotted track, ASCII fallback, and width metadata validation. For partial cells use `ramp[remainder]`; for zero remainder use only track cells. For positive usage below one computed step, use one step.
- [ ] **Step 4: Run** `bun test src/utils/__tests__/braille-context-bar.test.ts`; expect all tests to pass.
- [ ] **Step 5: Commit** as `feat(context): add braille bar geometry`.

### Task 2: Widget colours, numeric readout, and line fitting

**Files:**
- Modify: `src/widgets/ContextBar.ts`
- Modify: `src/types/RenderContext.ts`
- Modify: `src/utils/renderer.ts`
- Modify: `src/widgets/__tests__/ContextBar.test.ts`
- Create: `src/utils/__tests__/renderer-context-bar-fit.test.ts`

**Interfaces:**
- Consumes: `makeBrailleContextBar` and `resolveBrailleBarWidth` from Task 1.
- Produces: `RenderContext.contextBarWidth?: number`, an internal override (0 means omit rail).
- Preserves: `ContextBarWidget.render(item, context, settings)` and existing slider modes.

- [ ] **Step 1: Write failing widget tests.** Check raw counts drive a 25-cell rail and existing numeric readout; 50% is amber, 75% red, below 50% green; metadata changes thresholds and colour; the label and numeric text are outside coloured spans; the rail ends in an SGR reset; missing counts produce an empty rail without numeric text; `LANG=C` emits ASCII; slider modes keep their existing output.
- [ ] **Step 2: Write failing renderer tests.** Put Context Bar after a neighbouring text widget, render at wide, medium, and narrow widths, and assert that the rail is 25, shortened to 10–24, or absent while the numeric readout remains intact. Check a global foreground override and powerline output. Use literal visible text and `getVisibleWidth`, not the bar generator as an oracle.
- [ ] **Step 3: Run** `bun test src/widgets/__tests__/ContextBar.test.ts src/utils/__tests__/renderer-context-bar-fit.test.ts`; expect failures from the old block bar and truncation.
- [ ] **Step 4: Implement** widget metadata parsing and scoped ANSI fill/track/delimiter colouring with `getColorAnsiCode`; return intrinsic colours only for progress modes. Replace block progress rendering in previews and live data, leave slider modes unchanged, and return an empty rail on missing values. Add `contextBarWidth` to the render context.
- [ ] **Step 5: Implement** renderer fitting: measure assembled content before truncation, reduce Context Bar's width by the overflow to a minimum of 10, or omit its rail, then render the line normally. Apply to regular and powerline paths; leave unrelated widgets' truncation behaviour intact.
- [ ] **Step 6: Run** `bun test src/widgets/__tests__/ContextBar.test.ts src/utils/__tests__/renderer-context-bar-fit.test.ts`; expect all task tests to pass.
- [ ] **Step 7: Commit** as `feat(context): render and fit coloured braille bar`.

### Task 3: Repair pre-existing Git test contract and verify branch

**Files:**
- Modify: `src/utils/__tests__/git-test-helpers.ts`
- Modify: `src/widgets/__tests__/GitDeletions.test.ts`

**Interfaces:**
- The injectable `GitCommandRunner` has no `timeout` field; direct `execFileSync` test calls retain their timeout assertion.

- [ ] **Step 1: Confirm baseline failure.** Run `bun test src/widgets/__tests__/GitDeletions.test.ts`; expect the cumulative-deletions test to fail because `expectGitExecOptions` requires `timeout: 5000` on a `GitCommandRunner` options object.
- [ ] **Step 2: Correct the test helper** with an optional timeout assertion, and use the no-timeout variant only for the injectable runner calls. No production Git code changes.
- [ ] **Step 3: Run** `bun test src/widgets/__tests__/GitDeletions.test.ts`; expect 10/10 pass.
- [ ] **Step 4: Run** `bun test`, `bun run lint`, and `bun run build`; expect all to pass. Run a piped status payload to check actual output width and colour reset.
- [ ] **Step 5: Commit** as `test(git): match injectable runner options`.
