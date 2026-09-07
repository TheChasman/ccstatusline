import {
    beforeEach,
    describe,
    expect,
    it
} from 'vitest';

import type {
    GitCommandOptions,
    GitCommandRunner,
    RenderContext
} from '../../types/RenderContext';
import { DEFAULT_SETTINGS } from '../../types/Settings';
import type { WidgetItem } from '../../types/Widget';
import { clearGitCache } from '../../utils/git';
import { GitConflictsWidget } from '../GitConflicts';

type MockGitCommandRunner = GitCommandRunner & {
    calls: [string, GitCommandOptions][];
    mockImplementation: (impl: (command: string) => string) => void;
    mockReturnValue: (value: string) => void;
    mockReturnValueOnce: (value: string) => void;
};

function createGitCommandRunner(): MockGitCommandRunner {
    const calls: [string, GitCommandOptions][] = [];
    const queuedValues: string[] = [];
    let implementation: (command: string) => string = () => '';

    const runner = ((command: string, options: GitCommandOptions) => {
        calls.push([command, options]);
        const queuedValue = queuedValues.shift();
        return queuedValue ?? implementation(command);
    }) as MockGitCommandRunner;

    runner.calls = calls;
    runner.mockImplementation = (impl) => {
        implementation = impl;
    };
    runner.mockReturnValue = (value) => {
        implementation = () => value;
    };
    runner.mockReturnValueOnce = (value) => {
        queuedValues.push(value);
    };

    return runner;
}

function conflictListing(count: number): string {
    return Array.from({ length: count }, (_, index) => [
        `100644 hash 1\tconflict-${index}`,
        `100644 hash 2\tconflict-${index}`,
        `100644 hash 3\tconflict-${index}`
    ].join('\n')).join('\n');
}

function mockConflictCount(count: number): MockGitCommandRunner {
    const gitCommandRunner = createGitCommandRunner();
    gitCommandRunner.mockReturnValueOnce('true\n');
    gitCommandRunner.mockReturnValueOnce(conflictListing(count));
    return gitCommandRunner;
}

function render(options: {
    gitCommandRunner?: GitCommandRunner;
    isPreview?: boolean;
    rawValue?: boolean;
    hide?: string;
    hideNoGit?: boolean;
    zeroDisplay?: string;
    cleanSymbol?: string;
} = {}) {
    const widget = new GitConflictsWidget();
    const context: RenderContext = {
        isPreview: options.isPreview,
        gitCommandRunner: options.gitCommandRunner ?? createGitCommandRunner()
    };
    const hide = options.hide ?? (options.hideNoGit ? 'no-git' : undefined);
    const metadata: Record<string, string> = {
        ...(hide !== undefined ? { hide } : {}),
        ...(options.zeroDisplay ? { zeroDisplay: options.zeroDisplay } : {}),
        ...(options.cleanSymbol ? { symbolClean: options.cleanSymbol } : {})
    };
    const item: WidgetItem = {
        id: 'git-conflicts',
        type: 'git-conflicts',
        rawValue: options.rawValue,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined
    };

    return widget.render(item, context, DEFAULT_SETTINGS);
}

describe('GitConflictsWidget', () => {
    beforeEach(() => {
        clearGitCache();
    });

    it('renders preview content without a space between the glyph and count', () => {
        expect(render({ isPreview: true })).toBe('⚠2');
    });

    it('renders raw preview content as a count', () => {
        expect(render({ isPreview: true, rawValue: true })).toBe('2');
    });

    it('renders no git when outside a repository', () => {
        const gitCommandRunner = createGitCommandRunner();
        gitCommandRunner.mockReturnValue('false\n');

        expect(render({ gitCommandRunner })).toBe('(no git)');
    });

    it('hides no git through the shared hide state', () => {
        const gitCommandRunner = createGitCommandRunner();
        gitCommandRunner.mockReturnValue('false\n');

        expect(render({ hideNoGit: true, gitCommandRunner })).toBeNull();
    });

    it('declares no-git and zero as hideable states', () => {
        expect(new GitConflictsWidget().getHideableStates().map(state => state.key)).toEqual(['no-git', 'zero']);
    });

    it('renders zero conflicts instead of hiding the widget by default', () => {
        expect(render({ gitCommandRunner: mockConflictCount(0) })).toBe('⚠0');
    });

    it('renders raw zero conflicts as a numeric count', () => {
        expect(render({ rawValue: true, gitCommandRunner: mockConflictCount(0) })).toBe('0');
    });

    it('hides zero conflicts through the shared hide state', () => {
        expect(render({ hide: 'zero', gitCommandRunner: mockConflictCount(0) })).toBeNull();
    });

    it('hides zero conflicts in raw value mode through the shared hide state', () => {
        expect(render({ hide: 'zero', rawValue: true, gitCommandRunner: mockConflictCount(0) })).toBeNull();
    });

    it('gives the shared hide state precedence over the clean display', () => {
        expect(render({ hide: 'zero', zeroDisplay: 'clean', gitCommandRunner: mockConflictCount(0) })).toBeNull();
    });

    it('keeps non-zero conflicts visible with the zero hide state enabled', () => {
        expect(render({ hide: 'zero', gitCommandRunner: mockConflictCount(1) })).toBe('⚠1');
    });

    it('renders the conflict count without a space', () => {
        expect(render({ gitCommandRunner: mockConflictCount(2) })).toBe('⚠2');
    });

    it('renders raw conflicts as a numeric count', () => {
        expect(render({ rawValue: true, gitCommandRunner: mockConflictCount(1) })).toBe('1');
    });

    it('renders the clean glyph when zero conflicts are configured as clean', () => {
        expect(render({ zeroDisplay: 'clean', gitCommandRunner: mockConflictCount(0) })).toBe('✓');
    });

    it('renders a custom clean glyph', () => {
        expect(render({ zeroDisplay: 'clean', cleanSymbol: '★', gitCommandRunner: mockConflictCount(0) })).toBe('★');
    });

    it('keeps raw value numeric in clean mode', () => {
        expect(render({ zeroDisplay: 'clean', rawValue: true, gitCommandRunner: mockConflictCount(0) })).toBe('0');
    });

    it('renders the conflict glyph and count for non-zero conflicts in clean mode', () => {
        expect(render({ zeroDisplay: 'clean', gitCommandRunner: mockConflictCount(2) })).toBe('⚠2');
    });

    it('toggles the visible zero display back to the default', () => {
        const widget = new GitConflictsWidget();
        const item: WidgetItem = { id: 'git-conflicts', type: 'git-conflicts' };

        const clean = widget.handleEditorAction('cycle-zero-display', item);
        const back = widget.handleEditorAction('cycle-zero-display', clean ?? item);

        expect(clean?.metadata?.zeroDisplay).toBe('clean');
        expect(back?.metadata?.zeroDisplay).toBeUndefined();
    });

    it('keeps zero appearance on z and leaves h to the shared hide editor', () => {
        const keys = new GitConflictsWidget().getCustomKeybinds().map(keybind => keybind.key);

        expect(keys).toContain('z');
        expect(keys).not.toContain('h');
    });
});
