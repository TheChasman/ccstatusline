# Traffic-Light Dynamic Colours for Widgets

**Date:** 2026-04-11
**Status:** Approved
**Branch:** traffic-lights

## Overview

Introduce dynamic, value-based colouring for widgets. Model and ThinkingEffort widgets adopt a traffic-light colour scheme (green/amber/red) that changes based on their current value. This is always on — no toggle required.

The underlying mechanism (`getDynamicColors()`) is generic and reusable by future widgets (e.g. ContextBar shifting colour as context fills).

## Widget Interface Extension

A new optional method on the `Widget` interface:

```typescript
getDynamicColors?(item: WidgetItem, context: RenderContext, settings: Settings): DynamicColors | null;
```

Return type:

```typescript
interface DynamicColors {
    color?: string;
    backgroundColor?: string;
    bold?: boolean;
}
```

- Same signature as `render()` — full access to context and settings.
- Returns `null` to mean "no override, use static config colour as today".
- When values are returned, they override `item.color` / `item.backgroundColor` / `item.bold`.

### Colour Priority Chain

1. Global overrides (`settings.overrideForegroundColor`, `settings.overrideBackgroundColor`) — highest
2. Dynamic colours from `getDynamicColors()`
3. Widget config (`item.color`, `item.backgroundColor`)
4. Widget default (`getDefaultColor()`) — lowest

In powerline mode, when a widget returns dynamic colours, theme colour cycling is skipped for that widget only. Other widgets in the line still get their theme colours.

## Traffic-Light Colour Map

Shared utility at `src/utils/traffic-light.ts`. Colours are defined per colour depth for best fidelity:

| Level   | ansi16   | ansi256       | truecolor     |
|---------|----------|---------------|---------------|
| Green   | `green`  | `ansi256:34`  | `hex:00AF00`  |
| Amber   | `yellow` | `ansi256:214` | `hex:FFAF00`  |
| Red     | `red`    | `ansi256:196` | `hex:FF0000`  |

Helper function resolves the correct colour string for a given traffic-light level and colour depth (`settings.colorLevel`: 1=ansi16, 2=ansi256, 3=truecolor).

## Model Widget

**File:** `src/widgets/Model.ts`

`getDynamicColors()` implementation:

- Extracts the model display name (same logic as `render()`).
- Case-insensitive keyword match against the display name:

| Contains | Colour |
|----------|--------|
| `haiku`  | Green  |
| `sonnet` | Amber  |
| `opus`   | Red    |
| other    | No override (returns `null`) |

**Normal mode:** returns `color` only (coloured text on default background).

**Powerline mode** (`settings.powerline.enabled`): returns `backgroundColor` + `color: 'black'` (coloured segment with black text).

## ThinkingEffort Widget

**File:** `src/widgets/ThinkingEffort.ts`

`getDynamicColors()` implementation:

- Resolves the effort level (same logic as `render()`: transcript > settings > default).
- Maps effort level to colour:

| Value    | Colour | Treatment |
|----------|--------|-----------|
| `low`    | Green  | Normal: green text. Powerline: green bg, black text |
| `medium` | Amber  | Normal: amber text. Powerline: amber bg, black text |
| `high`   | Red    | Normal: red text. Powerline: red bg, black text |
| `max`    | Red    | **Both modes:** red background, bold white text |

Max is the exception — it always gets red background + bold white text regardless of normal/powerline mode, to make it unmissable.

## Renderer Changes

**File:** `src/utils/renderer.ts`

### Normal Mode (`renderStatusLine()`)

After calling `widget.render()` and before applying colours:

1. Check if the widget implements `getDynamicColors()`.
2. If it returns overrides, use them instead of `item.color` / `item.backgroundColor` / `item.bold`.
3. Global overrides still applied last (no change to existing logic).

### Powerline Mode (`renderPowerlineStatusLine()`)

Same check, but dynamic colours feed into powerline segment colouring:

- Dynamic `backgroundColor` replaces the theme-cycled or config background for that segment.
- Dynamic `color` replaces the theme-cycled or config foreground.
- Dynamic `bold` is respected.
- Separator arrow colours between segments update automatically — the renderer already derives arrow foreground from the previous segment's background colour.
- Theme colour cycling is skipped for widgets that return dynamic colours.

No changes to `applyColors()` or the colour system itself.

## Files Changed

| File | Change |
|------|--------|
| `src/types/Widget.ts` | Add optional `getDynamicColors()` to `Widget` interface, add `DynamicColors` type |
| `src/utils/traffic-light.ts` | **New.** Shared traffic-light colour map with per-depth values, resolver helper |
| `src/widgets/Model.ts` | Implement `getDynamicColors()` |
| `src/widgets/ThinkingEffort.ts` | Implement `getDynamicColors()` |
| `src/utils/renderer.ts` | Check for and apply dynamic colours in both normal and powerline render paths |

## Not Changed

- Config schema, settings migration — no new settings fields
- Colour system (`colors.ts`) — existing infrastructure is sufficient
- Widget registry, widget manifest — no new widget types
- TUI components — no UI changes
- All other widgets — unaffected, they don't implement `getDynamicColors()`
