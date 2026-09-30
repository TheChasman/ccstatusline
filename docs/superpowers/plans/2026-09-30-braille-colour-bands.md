# Braille Context Bar Colour Bands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render adjacent green, amber, and red filled regions in the Braille Context Bar, then expose its alert percentages in the TUI.

**Architecture:** `ContextBarWidget` retains percentage metadata and chooses ANSI colours per displayed cell band. A dedicated TUI editor updates only the two threshold metadata strings through the existing widget editor contract.

**Tech Stack:** TypeScript, React/Ink, Bun, Vitest.

**Spec:** [Braille colour bands design](../specs/2026-09-30-braille-colour-bands-design.md)

## Global constraints

- Keep stored defaults at 50% warning and 75% critical; round only display cell boundaries.
- Keep unfilled cells neutral and preserve existing slider modes.
- Use `bun test` and `bun run lint` for verification.

## Review focus

- A partial cell at a boundary uses one colour and still represents the same number of dots.
- A reduced rail rounds boundaries from its actual width, not the nominal 25 cells.
- ASCII fallback uses the same bands.
- Invalid metadata retains the current default pair.
- Editor cancellation and invalid input never persist metadata.

### Task 1: Colour the filled rail by position

**Files:** `src/widgets/ContextBar.ts`, `src/widgets/__tests__/ContextBar.test.ts`, `docs/USAGE.md`, `docs/DESIGN_REGISTER.md`.

- [ ] Add tests asserting adjacent ANSI colour runs at 80% and 100%, exact glyphs and colour resets, configured thresholds, narrow and ASCII rails, and colour-off output. Run `bun test src/widgets/__tests__/ContextBar.test.ts` and confirm new assertions fail for the existing single-colour fill.
- [ ] Replace the single fill colour selection in `renderBrailleRail` with three slices at `Math.round(width * warning / 100)` and `Math.round(width * critical / 100)`, capped to the actual filled length. Resolve each region's existing configurable colour independently. Keep the neutral track and delimiters.
- [ ] Update usage documentation and design register to describe adjacent bands and display-only boundary rounding.
- [ ] Run `bun test`, `bun run lint`, review the diff, and commit this task alone.

### Task 2: Edit alert levels in the TUI

**Files:** `src/widgets/ContextBar.ts`, `src/tui/components/ContextBarAlertEditor.tsx`, tests under `src/tui/components/__tests__/`, `docs/USAGE.md`.

- [ ] Add a widget keybind such as `(l)evels` that opens a dedicated alert editor through `renderEditor`. Test the keybind and editor with real Ink input.
- [ ] Show the stored/default warning and critical percentages. Accept percentages 0–100, including decimals, with warning < critical; preserve unrelated metadata, and call `onComplete` only for a valid confirmed edit. Cancel calls `onCancel` without changes.
- [ ] Document the TUI path. Run targeted tests, then `bun test` and `bun run lint`; review the diff and commit the second task.

### Final review

- [ ] Review the full branch diff against the spec and verify a clean worktree. Follow the project agent workflow for local integration; do not push without explicit authorisation.
