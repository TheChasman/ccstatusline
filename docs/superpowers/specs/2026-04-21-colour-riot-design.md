# Colour Riot — Traffic-Light Expansion + Effort Widget Fix

**Branch:** `colour-riot`  
**Date:** 2026-04-21

## Problem

Claude Code 2.1.111+ introduced two new effort levels (`xhigh`, `auto`) alongside the existing four (`low`, `medium`, `high`, `max`). The widget and transcript parser only knew about the original four, so `xhigh` and `auto` silently fell through to `medium` (amber). Additionally, the three-stop traffic-light palette (green / amber / red) was too narrow to faithfully represent six distinct effort levels.

## Scope

1. Expand the traffic-light system from 3 stops to 5, renaming `amber` → `orange`
2. Fix the effort widget to correctly parse and display all 6 levels
3. Colour picker rewrite is **deferred** — not part of this change

## Design

### 1. Traffic-Light System (`src/utils/traffic-light.ts`)

Replace the 3-stop `TRAFFIC_LIGHT_COLOURS` constant with a 5-stop version. Drop the `ansi16` field entirely — the system now operates at ansi256 minimum.

| Stop | ansi256 | truecolor |
|------|---------|-----------|
| `green` | `ansi256:34` | `hex:00AF00` |
| `yellow` | `ansi256:220` | `hex:FFD700` |
| `orange` | `ansi256:214` | `hex:FFAF00` |
| `red` | `ansi256:196` | `hex:FF0000` |
| `purple` | `ansi256:93` | `hex:8700FF` |

`orange` carries the same ansi256/truecolor values as the old `amber` — existing rendered output is unchanged for any widget that was using `amber`; only the key name changes.

`getTrafficLightColor` clamps `colorLevel`: any value below `2` is treated as `2`. Callers pass `settings.colorLevel` as before — the upgrade is transparent.

`TrafficLightColor` type becomes `'green' | 'yellow' | 'orange' | 'red' | 'purple'`.

Any existing caller passing `'amber'` is updated to `'orange'` (grep-and-replace).

### 2. Transcript Parser (`src/utils/jsonl-metadata.ts`)

`TranscriptThinkingEffort` type expands to include `xhigh` and `auto`:

```
'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'auto'
```

The regex gains the two new alternatives:

```
/with (low|medium|high|xhigh|max|auto) effort/i
```

`normalizeThinkingEffort` accepts all six values; unrecognised strings still return `undefined`.

### 3. Effort Widget (`src/widgets/ThinkingEffort.ts`)

`ThinkingEffortLevel` type expands to match the parser:

```
'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'auto'
```

**Level → colour mapping:**

| Level | `getDynamicColors` treatment |
|-------|------------------------------|
| `low` | green fg |
| `medium` | yellow fg |
| `high` | orange fg |
| `xhigh` | red fg |
| `max` | red bg + bold white (existing, unchanged) |
| `auto` | purple fg |

Powerline mode: `low` through `xhigh` use traffic-light colour as `backgroundColor` + `black` text, same as today. `max` keeps red bg + bold white in both modes. `auto` in powerline: purple `backgroundColor` + `black` text.

**Render output** — no brackets; colour alone identifies `auto`:

| `rawValue` | Output |
|-----------|--------|
| `false` | `Eff: <level>` |
| `true` | `<level>` |

Preview mode continues to show `Eff: high` / `high`.

Default fallback (no transcript, no settings) remains `medium` — now renders yellow instead of the old amber, same semantic meaning.

### 4. Tests (`src/widgets/__tests__/ThinkingEffort.test.ts`)

**Existing tests that require updating:**
- `getDynamicColors` assertions for `medium` → now expect `getTrafficLightColor('yellow', ...)`
- `getDynamicColors` assertions for `high` → now expect `getTrafficLightColor('orange', ...)`
- Any `amber` references → `orange`

**New render tests:**
- `xhigh` renders as `Eff: xhigh` and `xhigh` (raw)
- `auto` renders as `Eff: auto` and `auto` (raw)
- Transcript regex matches `xhigh` and `auto` in `/model` stdout
- `normalizeThinkingEffort` accepts `xhigh` and `auto`, rejects unknown strings

**New `getDynamicColors` tests:**
- `medium` → yellow traffic-light colour
- `high` → orange traffic-light colour
- `xhigh` → red fg (foreground only, not background)
- `auto` → purple fg, non-powerline mode
- `auto` → purple bg + black text, powerline mode

**New traffic-light clamping test (added to `ThinkingEffort.test.ts` — no dedicated traffic-light test file exists):**
- `getTrafficLightColor` called with `colorLevel: 1` returns the ansi256 value

## Files Changed

| File | Change |
|------|--------|
| `src/utils/traffic-light.ts` | Expand stops, rename `amber`→`orange`, drop ansi16, clamp resolver |
| `src/utils/jsonl-metadata.ts` | Widen type + regex |
| `src/widgets/ThinkingEffort.ts` | Widen type + normaliser, update `getDynamicColors`, update `getDescription` to list all 6 levels |
| `src/widgets/__tests__/ThinkingEffort.test.ts` | Update broken assertions, add new cases |
| Any file calling `getTrafficLightColor('amber', ...)` | Rename to `'orange'` |

## Out of Scope

- Colour picker / TUI slider rewrite (deferred)
- ansi16 support for new stops (not added; existing ansi16 users see ansi256 output instead)
- Per-model effort level filtering (the widget is display-only; CC's UI governs availability)
