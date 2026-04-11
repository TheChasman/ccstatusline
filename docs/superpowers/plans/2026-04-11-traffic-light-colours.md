# Traffic-Light Dynamic Colours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dynamic, value-based colouring to Model and ThinkingEffort widgets using a traffic-light scheme (green/amber/red), with special red+bold+white treatment for max effort.

**Architecture:** Introduce an optional `getDynamicColors()` method on the Widget interface. Widgets return colour overrides based on their current value. The renderer checks for this method and applies the returned colours in the priority chain before global overrides. Traffic-light colours are defined once in a shared utility and reused by both widgets. In normal mode, colours are applied as text; in powerline mode, they become segment backgrounds with black or white text as appropriate.

**Tech Stack:** TypeScript, existing Widget interface, existing colour system (`applyColors`, `getColorAnsiCode`), Vitest for testing.

---

### Task 1: Create shared traffic-light colour utility

**Files:**
- Create: `src/utils/traffic-light.ts`

- [ ] **Step 1: Write the traffic-light utility with colour definitions**

Create `src/utils/traffic-light.ts`:

```typescript
import { ColorLevel } from '../types/ColorLevel';

export const TRAFFIC_LIGHT_COLOURS = {
  green: {
    ansi16: 'green',
    ansi256: 'ansi256:34',
    truecolor: 'hex:00AF00',
  },
  amber: {
    ansi16: 'yellow',
    ansi256: 'ansi256:214',
    truecolor: 'hex:FFAF00',
  },
  red: {
    ansi16: 'red',
    ansi256: 'ansi256:196',
    truecolor: 'hex:FF0000',
  },
} as const;

export type TrafficLightColor = keyof typeof TRAFFIC_LIGHT_COLOURS;

/**
 * Resolve a traffic-light colour to the appropriate ANSI code based on colour depth.
 * @param level - 'green', 'amber', or 'red'
 * @param colorLevel - Colour depth: 1=ansi16, 2=ansi256, 3=truecolor
 */
export function getTrafficLightColor(level: TrafficLightColor, colorLevel: ColorLevel): string {
  if (colorLevel === 1) {
    return TRAFFIC_LIGHT_COLOURS[level].ansi16;
  }
  if (colorLevel === 2) {
    return TRAFFIC_LIGHT_COLOURS[level].ansi256;
  }
  // colorLevel === 3 (truecolor)
  return TRAFFIC_LIGHT_COLOURS[level].truecolor;
}
```

- [ ] **Step 2: Add tests for the traffic-light utility**

Create `src/utils/__tests__/traffic-light.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getTrafficLightColor, TRAFFIC_LIGHT_COLOURS } from '../traffic-light';

describe('traffic-light utility', () => {
  it('exports traffic light colours', () => {
    expect(TRAFFIC_LIGHT_COLOURS).toHaveProperty('green');
    expect(TRAFFIC_LIGHT_COLOURS).toHaveProperty('amber');
    expect(TRAFFIC_LIGHT_COLOURS).toHaveProperty('red');
  });

  it('resolves green at each colour level', () => {
    expect(getTrafficLightColor('green', 1)).toBe('green');
    expect(getTrafficLightColor('green', 2)).toBe('ansi256:34');
    expect(getTrafficLightColor('green', 3)).toBe('hex:00AF00');
  });

  it('resolves amber at each colour level', () => {
    expect(getTrafficLightColor('amber', 1)).toBe('yellow');
    expect(getTrafficLightColor('amber', 2)).toBe('ansi256:214');
    expect(getTrafficLightColor('amber', 3)).toBe('hex:FFAF00');
  });

  it('resolves red at each colour level', () => {
    expect(getTrafficLightColor('red', 1)).toBe('red');
    expect(getTrafficLightColor('red', 2)).toBe('ansi256:196');
    expect(getTrafficLightColor('red', 3)).toBe('hex:FF0000');
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `bun test src/utils/__tests__/traffic-light.test.ts`

Expected: All 5 tests passing.

- [ ] **Step 4: Commit**

```bash
git add src/utils/traffic-light.ts src/utils/__tests__/traffic-light.test.ts
git commit -m "feat: add traffic-light colour utility with per-depth definitions"
```

---

### Task 2: Extend Widget interface with getDynamicColors

**Files:**
- Modify: `src/types/Widget.ts`

- [ ] **Step 1: Add DynamicColors type and optional method**

Read `src/types/Widget.ts` first to see the current Widget interface.

Then add the new type before the Widget interface:

```typescript
export interface DynamicColors {
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
}
```

Then add the optional method to the Widget interface (alongside the existing methods):

```typescript
getDynamicColors?(item: WidgetItem, context: RenderContext, settings: Settings): DynamicColors | null;
```

The full Widget interface should now include all existing methods plus this new optional one.

- [ ] **Step 2: Run type check to verify no errors**

Run: `bun run lint`

Expected: No type errors, linting passes.

- [ ] **Step 3: Commit**

```bash
git add src/types/Widget.ts
git commit -m "feat: add optional getDynamicColors method to Widget interface"
```

---

### Task 3: Implement getDynamicColors in Model widget

**Files:**
- Modify: `src/widgets/Model.ts`
- Test: `src/widgets/__tests__/Model.test.ts`

- [ ] **Step 1: Write tests for Model dynamic colours**

Read `src/widgets/__tests__/Model.test.ts` to see existing tests. Add new tests at the end:

```typescript
import { getTrafficLightColor } from '../../utils/traffic-light';

describe('Model widget - getDynamicColors', () => {
  const widget = getWidget('model');

  it('returns green for haiku models', () => {
    const context: RenderContext = {
      data: { model: 'Claude 3.5 Haiku' },
    };
    const item: WidgetItem = { id: '1', type: 'model' };
    const settings = getDefaultSettings();

    const result = widget.getDynamicColors?.(item, context, settings);
    expect(result).toEqual({
      color: getTrafficLightColor('green', settings.colorLevel),
    });
  });

  it('returns amber for sonnet models', () => {
    const context: RenderContext = {
      data: { model: 'Claude 3.5 Sonnet' },
    };
    const item: WidgetItem = { id: '1', type: 'model' };
    const settings = getDefaultSettings();

    const result = widget.getDynamicColors?.(item, context, settings);
    expect(result).toEqual({
      color: getTrafficLightColor('amber', settings.colorLevel),
    });
  });

  it('returns red for opus models', () => {
    const context: RenderContext = {
      data: { model: 'Claude 3 Opus' },
    };
    const item: WidgetItem = { id: '1', type: 'model' };
    const settings = getDefaultSettings();

    const result = widget.getDynamicColors?.(item, context, settings);
    expect(result).toEqual({
      color: getTrafficLightColor('red', settings.colorLevel),
    });
  });

  it('returns null for unknown models', () => {
    const context: RenderContext = {
      data: { model: 'CustomModel' },
    };
    const item: WidgetItem = { id: '1', type: 'model' };
    const settings = getDefaultSettings();

    const result = widget.getDynamicColors?.(item, context, settings);
    expect(result).toBeNull();
  });

  it('returns null when no model data', () => {
    const context: RenderContext = { data: {} };
    const item: WidgetItem = { id: '1', type: 'model' };
    const settings = getDefaultSettings();

    const result = widget.getDynamicColors?.(item, context, settings);
    expect(result).toBeNull();
  });

  it('matches model family case-insensitively', () => {
    const context: RenderContext = {
      data: { model: 'CLAUDE 3.5 SONNET' },
    };
    const item: WidgetItem = { id: '1', type: 'model' };
    const settings = getDefaultSettings();

    const result = widget.getDynamicColors?.(item, context, settings);
    expect(result).toEqual({
      color: getTrafficLightColor('amber', settings.colorLevel),
    });
  });

  it('returns backgroundColor and color for powerline mode', () => {
    const context: RenderContext = {
      data: { model: 'Claude 3.5 Sonnet' },
    };
    const item: WidgetItem = { id: '1', type: 'model' };
    const settings = getDefaultSettings();
    settings.powerline.enabled = true;

    const result = widget.getDynamicColors?.(item, context, settings);
    expect(result).toEqual({
      backgroundColor: getTrafficLightColor('amber', settings.colorLevel),
      color: 'black',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/widgets/__tests__/Model.test.ts`

Expected: All new tests FAIL with "getDynamicColors is not a function" or similar.

- [ ] **Step 3: Implement getDynamicColors in Model widget**

Read `src/widgets/Model.ts` to understand the current structure. Then add this method to the ModelWidget class:

```typescript
getDynamicColors(
  item: WidgetItem,
  context: RenderContext,
  settings: Settings
): DynamicColors | null {
  const model = context.data?.model;
  const modelDisplayName = typeof model === 'string'
    ? model
    : (model?.display_name ?? model?.id);

  if (!modelDisplayName) {
    return null;
  }

  const lowerName = modelDisplayName.toLowerCase();
  let trafficLightLevel: 'green' | 'amber' | 'red' | null = null;

  if (lowerName.includes('haiku')) {
    trafficLightLevel = 'green';
  } else if (lowerName.includes('sonnet')) {
    trafficLightLevel = 'amber';
  } else if (lowerName.includes('opus')) {
    trafficLightLevel = 'red';
  } else {
    return null;
  }

  const color = getTrafficLightColor(trafficLightLevel, settings.colorLevel);

  if (settings.powerline.enabled) {
    return {
      backgroundColor: color,
      color: 'black',
    };
  }

  return {
    color,
  };
}
```

Add the import at the top of the file:

```typescript
import { getTrafficLightColor } from '../utils/traffic-light';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/widgets/__tests__/Model.test.ts`

Expected: All tests passing (both existing and new).

- [ ] **Step 5: Run full test suite to ensure no regressions**

Run: `bun test`

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/widgets/Model.ts src/widgets/__tests__/Model.test.ts
git commit -m "feat: implement getDynamicColors in Model widget for traffic-light colouring"
```

---

### Task 4: Implement getDynamicColors in ThinkingEffort widget

**Files:**
- Modify: `src/widgets/ThinkingEffort.ts`
- Test: `src/widgets/__tests__/ThinkingEffort.test.ts`

- [ ] **Step 1: Write tests for ThinkingEffort dynamic colours**

Read `src/widgets/__tests__/ThinkingEffort.test.ts` to see existing tests. Add new tests at the end:

```typescript
import { getTrafficLightColor } from '../../utils/traffic-light';

describe('ThinkingEffort widget - getDynamicColors', () => {
  const widget = getWidget('thinking-effort');

  it('returns green for low effort', () => {
    const context: RenderContext = {
      data: { thinking_effort: 'low' },
    };
    const item: WidgetItem = { id: '1', type: 'thinking-effort' };
    const settings = getDefaultSettings();

    const result = widget.getDynamicColors?.(item, context, settings);
    expect(result).toEqual({
      color: getTrafficLightColor('green', settings.colorLevel),
    });
  });

  it('returns amber for medium effort', () => {
    const context: RenderContext = {
      data: { thinking_effort: 'medium' },
    };
    const item: WidgetItem = { id: '1', type: 'thinking-effort' };
    const settings = getDefaultSettings();

    const result = widget.getDynamicColors?.(item, context, settings);
    expect(result).toEqual({
      color: getTrafficLightColor('amber', settings.colorLevel),
    });
  });

  it('returns red for high effort', () => {
    const context: RenderContext = {
      data: { thinking_effort: 'high' },
    };
    const item: WidgetItem = { id: '1', type: 'thinking-effort' };
    const settings = getDefaultSettings();

    const result = widget.getDynamicColors?.(item, context, settings);
    expect(result).toEqual({
      color: getTrafficLightColor('red', settings.colorLevel),
    });
  });

  it('returns red background + bold white for max effort (normal mode)', () => {
    const context: RenderContext = {
      data: { thinking_effort: 'max' },
    };
    const item: WidgetItem = { id: '1', type: 'thinking-effort' };
    const settings = getDefaultSettings();
    settings.powerline.enabled = false;

    const result = widget.getDynamicColors?.(item, context, settings);
    expect(result).toEqual({
      backgroundColor: getTrafficLightColor('red', settings.colorLevel),
      color: 'white',
      bold: true,
    });
  });

  it('returns red background + bold white for max effort (powerline mode)', () => {
    const context: RenderContext = {
      data: { thinking_effort: 'max' },
    };
    const item: WidgetItem = { id: '1', type: 'thinking-effort' };
    const settings = getDefaultSettings();
    settings.powerline.enabled = true;

    const result = widget.getDynamicColors?.(item, context, settings);
    expect(result).toEqual({
      backgroundColor: getTrafficLightColor('red', settings.colorLevel),
      color: 'white',
      bold: true,
    });
  });

  it('returns null when no effort data', () => {
    const context: RenderContext = { data: {} };
    const item: WidgetItem = { id: '1', type: 'thinking-effort' };
    const settings = getDefaultSettings();

    const result = widget.getDynamicColors?.(item, context, settings);
    // Note: ThinkingEffort defaults to 'medium' if no data, so this should return amber
    expect(result).toEqual({
      color: getTrafficLightColor('amber', settings.colorLevel),
    });
  });

  it('returns backgroundColor and white for powerline mode (low)', () => {
    const context: RenderContext = {
      data: { thinking_effort: 'low' },
    };
    const item: WidgetItem = { id: '1', type: 'thinking-effort' };
    const settings = getDefaultSettings();
    settings.powerline.enabled = true;

    const result = widget.getDynamicColors?.(item, context, settings);
    expect(result).toEqual({
      backgroundColor: getTrafficLightColor('green', settings.colorLevel),
      color: 'black',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/widgets/__tests__/ThinkingEffort.test.ts`

Expected: All new tests FAIL with "getDynamicColors is not a function" or similar.

- [ ] **Step 3: Implement getDynamicColors in ThinkingEffort widget**

Read `src/widgets/ThinkingEffort.ts` to understand how it resolves the effort level. Then add this method to the ThinkingEffortWidget class:

```typescript
getDynamicColors(
  item: WidgetItem,
  context: RenderContext,
  settings: Settings
): DynamicColors | null {
  // Resolve effort level using the same logic as render()
  let effortLevel = 'medium';

  if (context.data?.thinking_effort) {
    effortLevel = context.data.thinking_effort;
  } else if (settings.effortLevel) {
    effortLevel = settings.effortLevel;
  }

  // Max gets special treatment: red background + bold white, both modes
  if (effortLevel === 'max') {
    return {
      backgroundColor: getTrafficLightColor('red', settings.colorLevel),
      color: 'white',
      bold: true,
    };
  }

  // Map low/medium/high to traffic-light colours
  let trafficLightLevel: 'green' | 'amber' | 'red';

  if (effortLevel === 'low') {
    trafficLightLevel = 'green';
  } else if (effortLevel === 'high') {
    trafficLightLevel = 'red';
  } else {
    // medium (or any other unknown value defaults to medium)
    trafficLightLevel = 'amber';
  }

  const color = getTrafficLightColor(trafficLightLevel, settings.colorLevel);

  if (settings.powerline.enabled) {
    return {
      backgroundColor: color,
      color: 'black',
    };
  }

  return {
    color,
  };
}
```

Add the import at the top of the file:

```typescript
import { getTrafficLightColor } from '../utils/traffic-light';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/widgets/__tests__/ThinkingEffort.test.ts`

Expected: All tests passing (both existing and new).

- [ ] **Step 5: Run full test suite to ensure no regressions**

Run: `bun test`

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/widgets/ThinkingEffort.ts src/widgets/__tests__/ThinkingEffort.test.ts
git commit -m "feat: implement getDynamicColors in ThinkingEffort widget with max alarm treatment"
```

---

### Task 5: Integrate dynamic colours into the renderer (normal mode)

**Files:**
- Modify: `src/utils/renderer.ts`

- [ ] **Step 1: Locate the normal-mode rendering logic**

Read `src/utils/renderer.ts` to find the `renderStatusLine()` function. Identify where widgets are rendered and where colours are applied.

- [ ] **Step 2: Add dynamic colour check after widget render**

In the widget rendering loop (where each widget's `render()` is called), add a check after getting the rendered text:

```typescript
// After: const renderedText = widget.render(item, renderContext, settings);

let widgetColor = item.color ?? widget.getDefaultColor();
let widgetBackgroundColor = item.backgroundColor;
let widgetBold = item.bold;

// Check for dynamic colours
const dynamicColors = widget.getDynamicColors?.(item, renderContext, settings);
if (dynamicColors) {
  if (dynamicColors.color !== undefined) {
    widgetColor = dynamicColors.color;
  }
  if (dynamicColors.backgroundColor !== undefined) {
    widgetBackgroundColor = dynamicColors.backgroundColor;
  }
  if (dynamicColors.bold !== undefined) {
    widgetBold = dynamicColors.bold;
  }
}

// Then pass widgetColor, widgetBackgroundColor, widgetBold to applyColors or wherever colours are applied in the normal path
```

The exact location depends on the current structure of `renderStatusLine()`. You're inserting this check right after `render()` returns and before the colours are applied.

- [ ] **Step 3: Verify the colour application uses the dynamic values**

Make sure the code that applies colours uses `widgetColor`, `widgetBackgroundColor`, and `widgetBold` instead of directly reading from `item.color`, `item.backgroundColor`, `item.bold`.

- [ ] **Step 4: Run type check**

Run: `bun run lint`

Expected: No type errors.

- [ ] **Step 5: Run full test suite**

Run: `bun test`

Expected: All tests pass. Existing renderer tests should still pass because widgets without `getDynamicColors()` will return `undefined` and the fallback to config colours still applies.

- [ ] **Step 6: Commit**

```bash
git add src/utils/renderer.ts
git commit -m "feat: integrate dynamic colours into normal-mode rendering"
```

---

### Task 6: Integrate dynamic colours into the renderer (powerline mode)

**Files:**
- Modify: `src/utils/renderer.ts`

- [ ] **Step 1: Locate the powerline rendering logic**

Read the `renderPowerlineStatusLine()` function in `src/utils/renderer.ts` to understand how powerline segments are coloured and how theme cycling works.

- [ ] **Step 2: Add dynamic colour check in powerline rendering**

For each widget in the powerline rendering loop, add the same check as Task 5:

```typescript
let widgetColor = item.color ?? widget.getDefaultColor();
let widgetBackgroundColor = item.backgroundColor;
let widgetBold = item.bold;

// Check for dynamic colours
const dynamicColors = widget.getDynamicColors?.(item, renderContext, settings);
if (dynamicColors) {
  if (dynamicColors.color !== undefined) {
    widgetColor = dynamicColors.color;
  }
  if (dynamicColors.backgroundColor !== undefined) {
    widgetBackgroundColor = dynamicColors.backgroundColor;
  }
  if (dynamicColors.bold !== undefined) {
    widgetBold = dynamicColors.bold;
  }
}
```

- [ ] **Step 3: Skip theme colour cycling when dynamic colours are present**

Find the code that applies theme colours to widgets in powerline mode. Add a check: if `dynamicColors` was non-null, skip the theme colour cycling for this widget and use the dynamic colours instead.

Pseudo-code:

```typescript
if (dynamicColors) {
  // Use dynamic colours, skip theme cycling
  // Apply widgetColor and widgetBackgroundColor as powerline segment colours
} else {
  // Apply theme colours (existing logic)
}
```

- [ ] **Step 4: Verify separator colouring works**

The separator arrows between segments are already derived from the previous segment's background colour (converted to foreground). Since you're now using dynamic background colours, the separators should automatically get the right colours — no additional changes needed. But verify by tracing the separator code path.

- [ ] **Step 5: Run type check**

Run: `bun run lint`

Expected: No type errors.

- [ ] **Step 6: Run full test suite**

Run: `bun test`

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/utils/renderer.ts
git commit -m "feat: integrate dynamic colours into powerline-mode rendering with theme skip"
```

---

### Task 7: Manual testing — normal mode

**Files:**
- Test: Command line / TUI testing

- [ ] **Step 1: Start the interactive TUI**

Run: `bun run start`

Expected: TUI launches.

- [ ] **Step 2: Configure a status line with Model and ThinkingEffort widgets**

In the TUI, navigate to the line editor and add:
1. A Model widget with no colour override (so dynamic colours apply)
2. A separator
3. A ThinkingEffort widget with no colour override

Save and exit.

- [ ] **Step 3: Test Model widget colours with piped input**

Run (with a mock Sonnet model):

```bash
echo '{"model":{"id":"claude-sonnet-4-6","display_name":"Claude 3.5 Sonnet"},"transcript_path":"test.jsonl"}' | bun run src/ccstatusline.ts
```

Expected: Model widget renders in **amber** (yellow in ansi16, ansi256:214 in 256-colour).

Run (with a mock Haiku model):

```bash
echo '{"model":{"id":"claude-haiku-4-5","display_name":"Claude 3.5 Haiku"},"transcript_path":"test.jsonl"}' | bun run src/ccstatusline.ts
```

Expected: Model widget renders in **green**.

Run (with a mock Opus model):

```bash
echo '{"model":{"id":"claude-opus-4-6","display_name":"Claude 3 Opus"},"transcript_path":"test.jsonl"}' | bun run src/ccstatusline.ts
```

Expected: Model widget renders in **red**.

- [ ] **Step 4: Test ThinkingEffort widget colours**

Run (with low effort):

```bash
echo '{"thinking_effort":"low","transcript_path":"test.jsonl"}' | bun run src/ccstatusline.ts
```

Expected: ThinkingEffort widget renders in **green**.

Run (with medium effort):

```bash
echo '{"thinking_effort":"medium","transcript_path":"test.jsonl"}' | bun run src/ccstatusline.ts
```

Expected: ThinkingEffort widget renders in **amber**.

Run (with high effort):

```bash
echo '{"thinking_effort":"high","transcript_path":"test.jsonl"}' | bun run src/ccstatusline.ts
```

Expected: ThinkingEffort widget renders in **red**.

Run (with max effort):

```bash
echo '{"thinking_effort":"max","transcript_path":"test.jsonl"}' | bun run src/ccstatusline.ts
```

Expected: ThinkingEffort widget renders with **red background and bold white text**.

- [ ] **Step 5: Verify case-insensitive model matching**

Run:

```bash
echo '{"model":"CLAUDE 3.5 SONNET","transcript_path":"test.jsonl"}' | bun run src/ccstatusline.ts
```

Expected: Model widget renders in **amber** (case-insensitive matching works).

- [ ] **Step 6: Verify global overrides still take precedence**

Configure in TUI: set `overrideForegroundColor` to `blue` in settings. Then test a Model widget with Sonnet (which would normally be amber). Run the piped test again.

Expected: Model widget renders in **blue** (global override wins over dynamic colour).

---

### Task 8: Manual testing — powerline mode

**Files:**
- Test: Command line / TUI testing

- [ ] **Step 1: Enable powerline mode in settings**

In the TUI, navigate to settings and enable powerline mode. Set theme to 'custom' (no auto-cycling).

- [ ] **Step 2: Configure a status line with Model and ThinkingEffort**

Add both widgets with no colour overrides.

- [ ] **Step 3: Test Model widget in powerline mode**

Run (Sonnet):

```bash
echo '{"model":"Claude 3.5 Sonnet","transcript_path":"test.jsonl"}' | bun run src/ccstatusline.ts
```

Expected: Model widget renders as an **amber/yellow background segment with black text**. Separator arrows around it use amber as the transition colour.

Run (Haiku):

```bash
echo '{"model":"Claude 3.5 Haiku","transcript_path":"test.jsonl"}' | bun run src/ccstatusline.ts
```

Expected: Model widget renders as a **green background segment with black text**.

Run (Opus):

```bash
echo '{"model":"Claude 3 Opus","transcript_path":"test.jsonl"}' | bun run src/ccstatusline.ts
```

Expected: Model widget renders as a **red background segment with black text**.

- [ ] **Step 4: Test ThinkingEffort in powerline mode**

Run (low):

```bash
echo '{"thinking_effort":"low","transcript_path":"test.jsonl"}' | bun run src/ccstatusline.ts
```

Expected: ThinkingEffort widget renders as a **green background segment with black text**.

Run (medium):

```bash
echo '{"thinking_effort":"medium","transcript_path":"test.jsonl"}' | bun run src/ccstatusline.ts
```

Expected: ThinkingEffort widget renders as an **amber background segment with black text**.

Run (max):

```bash
echo '{"thinking_effort":"max","transcript_path":"test.jsonl"}' | bun run src/ccstatusline.ts
```

Expected: ThinkingEffort widget renders as a **red background segment with bold white text** (not black, to stand out even more).

- [ ] **Step 5: Test separator transitions**

In powerline mode with both Model (Sonnet/amber) and ThinkingEffort (high/red), the separator arrow between them should:
- Use **amber as foreground** (from Model's background)
- Have **red as background** (from ThinkingEffort's background)

Expected: You see an amber arrow on a red background, creating a visual transition.

- [ ] **Step 6: Test theme skip (verify dynamic colours override theme)**

In the TUI, set powerline theme to 'nord' (which has its own colour cycling). Configure Model and ThinkingEffort in the line.

Run:

```bash
echo '{"model":"Claude 3.5 Sonnet","thinking_effort":"low","transcript_path":"test.jsonl"}' | bun run src/ccstatusline.ts
```

Expected: Model renders in **amber** (not nord's cycled colour), ThinkingEffort renders in **green** (not nord's cycled colour). Dynamic colours override the theme.

---
