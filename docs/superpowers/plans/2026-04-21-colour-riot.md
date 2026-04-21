# Colour Riot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the traffic-light colour system from 3 stops to 5, rename `amber`→`orange`, add `yellow` and `purple`, then fix the effort widget to correctly handle all 6 Claude Code effort levels (`low`, `medium`, `high`, `xhigh`, `max`, `auto`).

**Architecture:** Traffic-light is the shared colour primitive — all changes flow outward from it. Expand it first, then fix callers in dependency order: `Model` (simple rename), `jsonl-metadata` (parser), `ThinkingEffort` (widget). Each task is TDD: failing tests first, then minimal implementation.

**Tech Stack:** TypeScript, Bun, Vitest. Run tests with `bun test <path>`. Lint with `bun run lint`.

---

## File Map

| File | Change |
|------|--------|
| `src/utils/traffic-light.ts` | Expand to 5 stops, drop ansi16, clamp resolver |
| `src/utils/__tests__/traffic-light.test.ts` | Rewrite for new stops + clamping |
| `src/widgets/Model.ts` | `amber` → `orange` (type + value) |
| `src/widgets/__tests__/Model.test.ts` | `amber` → `orange` (4 assertions) |
| `src/utils/jsonl-metadata.ts` | Widen type + regex to include `xhigh`/`auto` |
| `src/widgets/ThinkingEffort.ts` | Widen type + normaliser, new colour map, update description |
| `src/widgets/__tests__/ThinkingEffort.test.ts` | Update broken assertions, add new cases |

---

## Task 1: Expand the traffic-light system

**Files:**
- Modify: `src/utils/__tests__/traffic-light.test.ts`
- Modify: `src/utils/traffic-light.ts`

- [ ] **Step 1: Replace the traffic-light test file**

Full replacement of `src/utils/__tests__/traffic-light.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getTrafficLightColor, TRAFFIC_LIGHT_COLOURS } from '../traffic-light';

describe('traffic-light utility', () => {
    it('exports all five traffic-light stops', () => {
        expect(TRAFFIC_LIGHT_COLOURS).toHaveProperty('green');
        expect(TRAFFIC_LIGHT_COLOURS).toHaveProperty('yellow');
        expect(TRAFFIC_LIGHT_COLOURS).toHaveProperty('orange');
        expect(TRAFFIC_LIGHT_COLOURS).toHaveProperty('red');
        expect(TRAFFIC_LIGHT_COLOURS).toHaveProperty('purple');
    });

    it('resolves green', () => {
        expect(getTrafficLightColor('green', 2)).toBe('ansi256:34');
        expect(getTrafficLightColor('green', 3)).toBe('hex:00AF00');
    });

    it('resolves yellow', () => {
        expect(getTrafficLightColor('yellow', 2)).toBe('ansi256:220');
        expect(getTrafficLightColor('yellow', 3)).toBe('hex:FFD700');
    });

    it('resolves orange', () => {
        expect(getTrafficLightColor('orange', 2)).toBe('ansi256:214');
        expect(getTrafficLightColor('orange', 3)).toBe('hex:FFAF00');
    });

    it('resolves red', () => {
        expect(getTrafficLightColor('red', 2)).toBe('ansi256:196');
        expect(getTrafficLightColor('red', 3)).toBe('hex:FF0000');
    });

    it('resolves purple', () => {
        expect(getTrafficLightColor('purple', 2)).toBe('ansi256:93');
        expect(getTrafficLightColor('purple', 3)).toBe('hex:8700FF');
    });

    it('clamps colorLevel 1 to ansi256', () => {
        expect(getTrafficLightColor('green', 1)).toBe('ansi256:34');
        expect(getTrafficLightColor('orange', 1)).toBe('ansi256:214');
        expect(getTrafficLightColor('purple', 1)).toBe('ansi256:93');
    });
});
```

- [ ] **Step 2: Run tests to confirm failures**

```bash
bun test src/utils/__tests__/traffic-light.test.ts
```

Expected: multiple failures — `amber` not found, `yellow`/`orange`/`purple` not found, clamping test fails.

- [ ] **Step 3: Replace `src/utils/traffic-light.ts`**

```typescript
import type { ColorLevel } from '../types/ColorLevel';

export const TRAFFIC_LIGHT_COLOURS = {
    green:  { ansi256: 'ansi256:34',  truecolor: 'hex:00AF00' },
    yellow: { ansi256: 'ansi256:220', truecolor: 'hex:FFD700' },
    orange: { ansi256: 'ansi256:214', truecolor: 'hex:FFAF00' },
    red:    { ansi256: 'ansi256:196', truecolor: 'hex:FF0000' },
    purple: { ansi256: 'ansi256:93',  truecolor: 'hex:8700FF' },
} as const;

export type TrafficLightColor = keyof typeof TRAFFIC_LIGHT_COLOURS;

/**
 * Resolve a traffic-light colour to the appropriate ANSI code based on colour depth.
 * Operates at ansi256 minimum — colorLevel 1 is treated as 2.
 */
export function getTrafficLightColor(level: TrafficLightColor, colorLevel: ColorLevel): string {
    const effectiveLevel = colorLevel < 2 ? 2 : colorLevel;
    if (effectiveLevel === 2) {
        return TRAFFIC_LIGHT_COLOURS[level].ansi256;
    }
    return TRAFFIC_LIGHT_COLOURS[level].truecolor;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun test src/utils/__tests__/traffic-light.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/traffic-light.ts src/utils/__tests__/traffic-light.test.ts
git commit -m "feat: expand traffic-light palette to 5 stops, drop ansi16"
```

---

## Task 2: Rename `amber` → `orange` in the Model widget

**Files:**
- Modify: `src/widgets/__tests__/Model.test.ts`
- Modify: `src/widgets/Model.ts`

- [ ] **Step 1: Update Model.test.ts — replace all four `amber` references**

Lines 100, 142, 155, 168 in `src/widgets/__tests__/Model.test.ts`. Change every occurrence of `'amber'` to `'orange'` and update the test description on line 92:

```typescript
// Line 92 — description
it('returns orange for sonnet models', () => {

// Line 100 — assertion
color: getTrafficLightColor('orange', DEFAULT_SETTINGS.colorLevel)

// Line 142 — assertion
color: getTrafficLightColor('orange', DEFAULT_SETTINGS.colorLevel)

// Line 155 — assertion
backgroundColor: getTrafficLightColor('orange', settings.colorLevel),

// Line 168 — assertion
color: getTrafficLightColor('orange', DEFAULT_SETTINGS.colorLevel)
```

- [ ] **Step 2: Run tests to confirm failures**

```bash
bun test src/widgets/__tests__/Model.test.ts
```

Expected: 4 failures — `'amber'` is not a valid `TrafficLightColor`.

- [ ] **Step 3: Update Model.ts — two occurrences of `amber`**

In `src/widgets/Model.ts`, change line 54:

```typescript
// Before
let trafficLightLevel: 'green' | 'amber' | 'red' | null = null;

// After
let trafficLightLevel: 'green' | 'orange' | 'red' | null = null;
```

And line 59:

```typescript
// Before
trafficLightLevel = 'amber';

// After
trafficLightLevel = 'orange';
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun test src/widgets/__tests__/Model.test.ts
```

Expected: all Model tests pass.

- [ ] **Step 5: Run full suite to confirm no regressions**

```bash
bun test
```

Expected: all tests pass. If any test outside these two files still references `'amber'` as a `TrafficLightColor`, it will fail here — fix the reference before continuing.

- [ ] **Step 6: Commit**

```bash
git add src/widgets/Model.ts src/widgets/__tests__/Model.test.ts
git commit -m "fix: rename amber→orange in Model widget to match traffic-light palette"
```

---

## Task 3: Expand the transcript parser

**Files:**
- Modify: `src/widgets/__tests__/ThinkingEffort.test.ts` (transcript + settings sections)
- Modify: `src/utils/jsonl-metadata.ts`

- [ ] **Step 1: Add two new constants and four new tests to `ThinkingEffort.test.ts`**

Add these two constants alongside the existing ones near the top of the file (after `MODEL_WITHOUT_EFFORT`):

```typescript
const MODEL_WITH_XHIGH_EFFORT = '<local-command-stdout>Set model to \u001b[1mopus (claude-opus-4-7)\u001b[22m with \u001b[1mxhigh\u001b[22m effort</local-command-stdout>';
const MODEL_WITH_AUTO_EFFORT  = '<local-command-stdout>Set model to \u001b[1mopus (claude-opus-4-7)\u001b[22m with \u001b[1mauto\u001b[22m effort</local-command-stdout>';
```

Inside the `describe('transcript source')` block, add after the existing `'supports max effort'` test:

```typescript
it('reads xhigh effort from the latest /model transcript stdout', () => {
    const result = render({
        fileContent: makeTranscriptEntry(MODEL_WITH_XHIGH_EFFORT),
    });
    expect(result).toBe('Eff: xhigh');
});

it('reads auto effort from the latest /model transcript stdout', () => {
    const result = render({
        fileContent: makeTranscriptEntry(MODEL_WITH_AUTO_EFFORT),
    });
    expect(result).toBe('Eff: auto');
});
```

Inside the `describe('Claude settings fallback')` block, add after the existing `'supports max effortLevel'` test:

```typescript
it('supports xhigh effortLevel', () => {
    const result = render({ settingsValue: { effortLevel: 'xhigh' } });
    expect(result).toBe('Eff: xhigh');
});

it('supports auto effortLevel', () => {
    const result = render({ settingsValue: { effortLevel: 'auto' } });
    expect(result).toBe('Eff: auto');
});
```

- [ ] **Step 2: Run tests to confirm failures**

```bash
bun test src/widgets/__tests__/ThinkingEffort.test.ts
```

Expected: 4 new failures — `xhigh` and `auto` are not recognised by the parser or normaliser, so results fall back to `'Eff: medium'`.

- [ ] **Step 3: Update `src/utils/jsonl-metadata.ts`**

```typescript
import { getVisibleText } from './ansi';
import {
    parseJsonlLine,
    readJsonlLinesSync
} from './jsonl-lines';

export type TranscriptThinkingEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'auto';

const MODEL_STDOUT_PREFIX = '<local-command-stdout>Set model to ';
const MODEL_STDOUT_EFFORT_REGEX = /^<local-command-stdout>Set model to[\s\S]*? with (low|medium|high|xhigh|max|auto) effort<\/local-command-stdout>$/i;

interface TranscriptEntry { message?: { content?: string } }

function normalizeThinkingEffort(value: string | undefined): TranscriptThinkingEffort | undefined {
    if (!value) {
        return undefined;
    }

    const normalized = value.toLowerCase();
    if (
        normalized === 'low' || normalized === 'medium' || normalized === 'high' ||
        normalized === 'xhigh' || normalized === 'max' || normalized === 'auto'
    ) {
        return normalized;
    }

    return undefined;
}

export function getTranscriptThinkingEffort(transcriptPath: string | undefined): TranscriptThinkingEffort | undefined {
    if (!transcriptPath) {
        return undefined;
    }

    try {
        const lines = readJsonlLinesSync(transcriptPath);

        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i];
            if (!line) {
                continue;
            }

            const entry = parseJsonlLine(line) as TranscriptEntry | null;
            if (typeof entry?.message?.content !== 'string') {
                continue;
            }

            const visibleContent = getVisibleText(entry.message.content).trim();
            if (!visibleContent.startsWith(MODEL_STDOUT_PREFIX)) {
                continue;
            }

            const match = MODEL_STDOUT_EFFORT_REGEX.exec(visibleContent);
            return normalizeThinkingEffort(match?.[1]);
        }
    } catch {
        return undefined;
    }

    return undefined;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun test src/widgets/__tests__/ThinkingEffort.test.ts
```

Expected: the 4 new tests pass; existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/jsonl-metadata.ts src/widgets/__tests__/ThinkingEffort.test.ts
git commit -m "feat: expand transcript parser to recognise xhigh and auto effort levels"
```

---

## Task 4: Update the ThinkingEffort widget

**Files:**
- Modify: `src/widgets/__tests__/ThinkingEffort.test.ts` (getDynamicColors section)
- Modify: `src/widgets/ThinkingEffort.ts`

- [ ] **Step 1: Update and extend the `getDynamicColors` tests**

In `src/widgets/__tests__/ThinkingEffort.test.ts`, inside `describe('getDynamicColors')`:

**Update existing test descriptions and assertions** (the colour semantics have shifted):

```typescript
// Was: 'returns amber for medium effort'
it('returns yellow for medium effort', () => {
    const widget = new ThinkingEffortWidget();
    const context: RenderContext = {
        data: { thinking_effort: 'medium' },
    };
    const item: WidgetItem = { id: '1', type: 'thinking-effort' };

    const result = widget.getDynamicColors?.(item, context, DEFAULT_SETTINGS);
    expect(result).toEqual({
        color: getTrafficLightColor('yellow', DEFAULT_SETTINGS.colorLevel),
    });
});

// Was: 'returns red for high effort'
it('returns orange for high effort', () => {
    const widget = new ThinkingEffortWidget();
    const context: RenderContext = {
        data: { thinking_effort: 'high' },
    };
    const item: WidgetItem = { id: '1', type: 'thinking-effort' };

    const result = widget.getDynamicColors?.(item, context, DEFAULT_SETTINGS);
    expect(result).toEqual({
        color: getTrafficLightColor('orange', DEFAULT_SETTINGS.colorLevel),
    });
});

// Was: 'defaults to amber when no effort data'
it('defaults to yellow when no effort data', () => {
    const widget = new ThinkingEffortWidget();
    const context: RenderContext = { data: {} };
    const item: WidgetItem = { id: '1', type: 'thinking-effort' };

    const result = widget.getDynamicColors?.(item, context, DEFAULT_SETTINGS);
    expect(result).toEqual({
        color: getTrafficLightColor('yellow', DEFAULT_SETTINGS.colorLevel),
    });
});
```

**Add new tests** after the existing `getDynamicColors` cases:

```typescript
it('returns red for xhigh effort', () => {
    const widget = new ThinkingEffortWidget();
    const context: RenderContext = {
        data: { thinking_effort: 'xhigh' },
    };
    const item: WidgetItem = { id: '1', type: 'thinking-effort' };

    const result = widget.getDynamicColors?.(item, context, DEFAULT_SETTINGS);
    expect(result).toEqual({
        color: getTrafficLightColor('red', DEFAULT_SETTINGS.colorLevel),
    });
});

it('returns purple for auto effort (normal mode)', () => {
    const widget = new ThinkingEffortWidget();
    const context: RenderContext = {
        data: { thinking_effort: 'auto' },
    };
    const item: WidgetItem = { id: '1', type: 'thinking-effort' };
    const settings = structuredClone(DEFAULT_SETTINGS);
    settings.powerline.enabled = false;

    const result = widget.getDynamicColors?.(item, context, settings);
    expect(result).toEqual({
        color: getTrafficLightColor('purple', settings.colorLevel),
    });
});

it('returns purple background + black text for auto effort (powerline mode)', () => {
    const widget = new ThinkingEffortWidget();
    const context: RenderContext = {
        data: { thinking_effort: 'auto' },
    };
    const item: WidgetItem = { id: '1', type: 'thinking-effort' };
    const settings = structuredClone(DEFAULT_SETTINGS);
    settings.powerline.enabled = true;

    const result = widget.getDynamicColors?.(item, context, settings);
    expect(result).toEqual({
        backgroundColor: getTrafficLightColor('purple', settings.colorLevel),
        color: 'black',
    });
});
```

- [ ] **Step 2: Run tests to confirm failures**

```bash
bun test src/widgets/__tests__/ThinkingEffort.test.ts
```

Expected: 3 updated assertions fail (still returning old amber/red values), 3 new tests fail (xhigh/auto not handled).

- [ ] **Step 3: Replace `src/widgets/ThinkingEffort.ts`**

```typescript
import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    DynamicColors,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { loadClaudeSettingsSync } from '../utils/claude-settings';
import { getTrafficLightColor, type TrafficLightColor } from '../utils/traffic-light';
import { getTranscriptThinkingEffort } from '../utils/jsonl';

export type ThinkingEffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'auto';

/**
 * Resolve thinking effort from transcript and settings.
 */
function normalizeThinkingEffort(value: string | undefined): ThinkingEffortLevel | undefined {
    if (!value) {
        return undefined;
    }

    const normalized = value.toLowerCase();
    if (
        normalized === 'low' || normalized === 'medium' || normalized === 'high' ||
        normalized === 'xhigh' || normalized === 'max' || normalized === 'auto'
    ) {
        return normalized;
    }

    return undefined;
}

function resolveThinkingEffortFromSettings(): ThinkingEffortLevel | undefined {
    try {
        const settings = loadClaudeSettingsSync({ logErrors: false });
        return normalizeThinkingEffort(settings.effortLevel);
    } catch {
        // Settings unavailable, return undefined
    }

    return undefined;
}

function resolveThinkingEffort(context: RenderContext): ThinkingEffortLevel {
    return getTranscriptThinkingEffort(context.data?.transcript_path)
        ?? resolveThinkingEffortFromSettings()
        ?? 'medium';
}

export class ThinkingEffortWidget implements Widget {
    getDefaultColor(): string { return 'magenta'; }
    getDescription(): string { return 'Displays the current thinking effort level (low, medium, high, xhigh, max, auto).\nMay be incorrect when multiple Claude Code sessions are running due to current Claude Code limitations.'; }
    getDisplayName(): string { return 'Thinking Effort'; }
    getCategory(): string { return 'Core'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? 'high' : 'Eff: high';
        }

        const effort = resolveThinkingEffort(context);
        return item.rawValue ? effort : `Eff: ${effort}`;
    }

    getDynamicColors(
        item: WidgetItem,
        context: RenderContext,
        settings: Settings
    ): DynamicColors | null {
        let effortLevel: ThinkingEffortLevel;

        if (context.data?.thinking_effort) {
            const normalized = normalizeThinkingEffort(context.data.thinking_effort as string);
            effortLevel = normalized ?? resolveThinkingEffort(context);
        } else {
            effortLevel = resolveThinkingEffort(context);
        }

        if (effortLevel === 'max') {
            return {
                backgroundColor: getTrafficLightColor('red', settings.colorLevel),
                color: 'white',
                bold: true,
            };
        }

        if (effortLevel === 'auto') {
            if (settings.powerline.enabled) {
                return {
                    backgroundColor: getTrafficLightColor('purple', settings.colorLevel),
                    color: 'black',
                };
            }
            return {
                color: getTrafficLightColor('purple', settings.colorLevel),
            };
        }

        const trafficMap: Record<'low' | 'medium' | 'high' | 'xhigh', TrafficLightColor> = {
            low: 'green',
            medium: 'yellow',
            high: 'orange',
            xhigh: 'red',
        };

        const color = getTrafficLightColor(trafficMap[effortLevel], settings.colorLevel);

        if (settings.powerline.enabled) {
            return {
                backgroundColor: color,
                color: 'black',
            };
        }

        return { color };
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
```

- [ ] **Step 4: Run the ThinkingEffort tests**

```bash
bun test src/widgets/__tests__/ThinkingEffort.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Run the full test suite**

```bash
bun test
```

Expected: all tests pass with no regressions.

- [ ] **Step 6: Lint**

```bash
bun run lint
```

Expected: no errors or warnings.

- [ ] **Step 7: Build**

```bash
bun run build
```

Expected: clean build with no errors.

- [ ] **Step 8: Commit**

```bash
git add src/widgets/ThinkingEffort.ts src/widgets/__tests__/ThinkingEffort.test.ts
git commit -m "feat: add xhigh and auto effort levels with full colour mapping"
```
