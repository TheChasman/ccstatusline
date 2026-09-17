import { execFileSync } from 'child_process';
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
import { clearGitCache } from '../../utils/git';
import { GitAheadBehindWidget } from '../GitAheadBehind';

vi.mock('child_process', () => ({
    execSync: vi.fn(),
    execFileSync: vi.fn(),
    spawnSync: vi.fn()
}));

const mockExecFileSync = execFileSync as unknown as {
    mockReturnValue: (value: string) => void;
    mockReturnValueOnce: (value: string) => void;
};

function render(options: {
    metadata?: Record<string, string>;
    rawValue?: boolean;
    isPreview?: boolean;
} = {}) {
    const widget = new GitAheadBehindWidget();
    const context: RenderContext = { isPreview: options.isPreview };
    const item: WidgetItem = {
        id: 'git-ahead-behind',
        type: 'git-ahead-behind',
        rawValue: options.rawValue,
        metadata: options.metadata
    };

    return widget.render(item, context, DEFAULT_SETTINGS);
}

describe('GitAheadBehindWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearGitCache();
    });

    it('declares no-git, no-upstream, and a default-enabled zero state', () => {
        const states = new GitAheadBehindWidget().getHideableStates();

        expect(states.map(state => state.key)).toEqual(['no-git', 'no-upstream', 'zero']);
        expect(states.find(state => state.key === 'zero')?.defaultEnabled).toBe(true);
    });

    it('renders preview', () => {
        expect(render({ isPreview: true })).toBe('↑2↓3');
        expect(render({ isPreview: true, rawValue: true })).toBe('2,3');
    });

    it('renders divergence counts', () => {
        mockExecFileSync.mockReturnValueOnce('true\n');
        mockExecFileSync.mockReturnValueOnce('2\t3\n');

        expect(render()).toBe('↑2↓3');
    });

    it('renders no git outside a work tree and hides via the unified state', () => {
        mockExecFileSync.mockReturnValue('false\n');
        expect(render()).toBe('(no git)');

        clearGitCache();
        mockExecFileSync.mockReturnValue('false\n');
        expect(render({ metadata: { hide: 'no-git' } })).toBeNull();
    });

    it('renders no upstream and hides via the unified state', () => {
        // No upstream, and the fallback walk finds neither a default branch
        // nor a current branch: every command in the sequence returns nothing.
        const stubNoUpstreamSequence = () => {
            mockExecFileSync.mockReturnValueOnce('true\n');                 // rev-parse --is-inside-work-tree
            mockExecFileSync.mockReturnValueOnce('');                       // rev-list ...@{upstream}
            mockExecFileSync.mockReturnValueOnce('');                       // symbolic-ref origin/HEAD
            mockExecFileSync.mockReturnValueOnce('');                       // rev-parse --verify main
            mockExecFileSync.mockReturnValueOnce('');                       // rev-parse --verify master
            mockExecFileSync.mockReturnValueOnce('');                       // rev-parse --abbrev-ref HEAD
        };

        stubNoUpstreamSequence();
        expect(render()).toBe('(no upstream)');

        clearGitCache();
        stubNoUpstreamSequence();
        expect(render({ metadata: { hide: 'no-upstream' } })).toBeNull();
    });

    it('falls back to the default branch when the current branch has no upstream', () => {
        // Real sequence for an upstream-less feature branch: the upstream
        // rev-list comes back empty, so divergence is resolved against the
        // repo default branch from origin/HEAD.
        mockExecFileSync.mockReturnValueOnce('true\n');                     // rev-parse --is-inside-work-tree
        mockExecFileSync.mockReturnValueOnce('');                           // rev-list ...@{upstream}
        mockExecFileSync.mockReturnValueOnce('origin/main\n');              // symbolic-ref origin/HEAD
        mockExecFileSync.mockReturnValueOnce('feature/demo\n');             // rev-parse --abbrev-ref HEAD
        mockExecFileSync.mockReturnValueOnce('1\t0\n');                     // rev-list HEAD...main

        expect(render()).toBe('↑1');
    });

    it('hides when not diverged by default', () => {
        mockExecFileSync.mockReturnValueOnce('true\n');
        mockExecFileSync.mockReturnValueOnce('0\t0\n');

        expect(render()).toBeNull();
    });

    it('shows zero divergence when the zero state is opted out', () => {
        mockExecFileSync.mockReturnValueOnce('true\n');
        mockExecFileSync.mockReturnValueOnce('0\t0\n');
        expect(render({ metadata: { hide: '' } })).toBe('↑0↓0');

        clearGitCache();
        mockExecFileSync.mockReturnValueOnce('true\n');
        mockExecFileSync.mockReturnValueOnce('0\t0\n');
        expect(render({ metadata: { hide: 'no-git' }, rawValue: true })).toBe('0,0');
    });
});
