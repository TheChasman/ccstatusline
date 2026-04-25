# Hostname Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Hostname` widget to the Environment category that shows the machine's friendly local name (e.g. `Host: Kirk`).

**Architecture:** A single new widget file follows the established Widget interface pattern used by all other widgets. macOS uses `scutil --get LocalHostName` for the friendly Bonjour name; other platforms fall back to `os.hostname().split('.')[0]`. The widget is exported from the index and registered in the manifest.

**Tech Stack:** TypeScript, Node.js `os` module, `child_process.execSync`, Vitest

> **Note:** The codebase uses American spelling `'gray'` for the grey colour — not `'grey'`.

---

### Task 1: Create `Hostname.ts` with failing tests

**Files:**
- Create: `src/widgets/Hostname.ts`
- Create: `src/widgets/__tests__/Hostname.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/widgets/__tests__/Hostname.test.ts`:

```ts
import { execSync } from 'child_process';
import os from 'os';
import type { Mock } from 'vitest';
import {
    beforeEach,
    describe,
    expect,
    it,
    vi
} from 'vitest';

import type { RenderContext } from '../../types/RenderContext';
import { DEFAULT_SETTINGS } from '../../types/Settings';
import type { WidgetItem } from '../../types/Widget';
import { HostnameWidget } from '../Hostname';

vi.mock('child_process', () => ({ execSync: vi.fn() }));
vi.mock('os', () => ({
    default: {
        platform: vi.fn(),
        hostname: vi.fn()
    }
}));

const mockExecSync = execSync as Mock;
const mockPlatform = os.platform as Mock;
const mockHostname = os.hostname as Mock;

const widget = new HostnameWidget();
const item: WidgetItem = { id: 'hostname', type: 'hostname' };
const rawItem: WidgetItem = { id: 'hostname', type: 'hostname', rawValue: true };
const context: RenderContext = { data: { cwd: '/repo' } };

describe('HostnameWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns prefixed preview string', () => {
        expect(widget.render(item, { isPreview: true }, DEFAULT_SETTINGS)).toBe('Host: Kirk');
    });

    it('returns raw preview string', () => {
        expect(widget.render(rawItem, { isPreview: true }, DEFAULT_SETTINGS)).toBe('Kirk');
    });

    it('uses scutil on macOS', () => {
        mockPlatform.mockReturnValue('darwin');
        mockExecSync.mockReturnValue('SpocksPad\n');
        expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('Host: SpocksPad');
        expect(mockExecSync).toHaveBeenCalledWith('scutil --get LocalHostName', { encoding: 'utf8' });
    });

    it('omits prefix in raw mode on macOS', () => {
        mockPlatform.mockReturnValue('darwin');
        mockExecSync.mockReturnValue('Kirk\n');
        expect(widget.render(rawItem, context, DEFAULT_SETTINGS)).toBe('Kirk');
    });

    it('falls back to os.hostname on non-macOS', () => {
        mockPlatform.mockReturnValue('linux');
        mockHostname.mockReturnValue('spock');
        expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('Host: spock');
    });

    it('strips domain suffix from os.hostname', () => {
        mockPlatform.mockReturnValue('linux');
        mockHostname.mockReturnValue('kirk.local');
        expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('Host: kirk');
    });

    it('falls back to os.hostname when scutil throws', () => {
        mockPlatform.mockReturnValue('darwin');
        mockExecSync.mockImplementation(() => { throw new Error('scutil not found'); });
        mockHostname.mockReturnValue('macbook.local');
        expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('Host: macbook');
    });

    it('has correct metadata', () => {
        expect(widget.getDefaultColor()).toBe('gray');
        expect(widget.getDisplayName()).toBe('Hostname');
        expect(widget.getDescription()).toBe('Shows the machine\'s friendly local hostname');
        expect(widget.getCategory()).toBe('Environment');
        expect(widget.supportsRawValue()).toBe(true);
        expect(widget.supportsColors(item)).toBe(true);
    });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun test src/widgets/__tests__/Hostname.test.ts
```

Expected: all tests fail with `Cannot find module '../Hostname'`

- [ ] **Step 3: Create the widget implementation**

Create `src/widgets/Hostname.ts`:

```ts
import { execSync } from 'child_process';
import os from 'os';

import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';

function getShortHostname(): string {
    if (os.platform() === 'darwin') {
        try {
            return execSync('scutil --get LocalHostName', { encoding: 'utf8' }).trim();
        } catch {
            // fall through to os.hostname fallback
        }
    }

    return os.hostname().split('.')[0];
}

export class HostnameWidget implements Widget {
    getDefaultColor(): string { return 'gray'; }
    getDescription(): string { return 'Shows the machine\'s friendly local hostname'; }
    getDisplayName(): string { return 'Hostname'; }
    getCategory(): string { return 'Environment'; }

    getEditorDisplay(_item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        if (context.isPreview)
            return item.rawValue ? 'Kirk' : 'Host: Kirk';

        const name = getShortHostname();
        return item.rawValue ? name : `Host: ${name}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(_item: WidgetItem): boolean { return true; }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun test src/widgets/__tests__/Hostname.test.ts
```

Expected: all 8 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/widgets/Hostname.ts src/widgets/__tests__/Hostname.test.ts
git commit -m "feat(widget): add HostnameWidget"
```

---

### Task 2: Wire the widget into the registry

**Files:**
- Modify: `src/widgets/index.ts` — add export at end of file
- Modify: `src/utils/widget-manifest.ts` — register `hostname` type near other Environment widgets

- [ ] **Step 1: Export from the widget index**

In `src/widgets/index.ts`, append after the last line:

```ts
export { HostnameWidget } from './Hostname';
```

- [ ] **Step 2: Register in the manifest**

In `src/utils/widget-manifest.ts`, add the entry after the `free-memory` line (currently line 67):

```ts
    { type: 'free-memory', create: () => new widgets.FreeMemoryWidget() },
    { type: 'hostname', create: () => new widgets.HostnameWidget() },
```

- [ ] **Step 3: Run the full test suite**

```bash
bun test
```

Expected: all tests pass, no regressions

- [ ] **Step 4: Verify the widget appears in the TUI**

```bash
bun run start
```

Navigate: Edit Line → Add Widget → Category: Environment → confirm `Hostname` appears in the list

- [ ] **Step 5: Commit**

```bash
git add src/widgets/index.ts src/utils/widget-manifest.ts
git commit -m "feat(widget): register Hostname widget type"
```

---

### Task 3: Deploy

- [ ] **Step 1: Build and deploy**

```bash
bun run deploy
```

Expected: build completes, `~/.config/ccstatusline/ccstatusline.js` is updated

- [ ] **Step 2: Verify the deployed build includes the widget**

```bash
grep -c "hostname\|Hostname\|scutil" ~/.config/ccstatusline/ccstatusline.js
```

Expected: non-zero count
