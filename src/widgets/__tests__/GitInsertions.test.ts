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
import { expectGitExecOptions } from '../../utils/__tests__/git-test-helpers';
import { clearGitCache } from '../../utils/git';
import { GitInsertionsWidget } from '../GitInsertions';

vi.mock('child_process', () => ({
    execSync: vi.fn(),
    execFileSync: vi.fn(),
    spawnSync: vi.fn()
}));

const mockExecFileSync = execFileSync as unknown as {
    mock: { calls: unknown[][] };
    mockImplementation: (impl: () => never) => void;
    mockReturnValue: (value: string) => void;
    mockReturnValueOnce: (value: string) => void;
};

/**
 * Responses are keyed by git sub-command because the branch-aware change
 * counter issues a variable number of commands depending on the branch state.
 */
function setupGitResponses(responses: Record<string, string>) {
    mockExecFileSync.mockImplementation(((_file: string, args: string[]) => {
        const sub = args.join(' ');
        if (Object.prototype.hasOwnProperty.call(responses, sub))
            return responses[sub];
        throw new Error(`unexpected git call: ${sub}`);
    }) as unknown as () => never);
}

function render(options: {
    cwd?: string;
    hideNoGit?: boolean;
    isPreview?: boolean;
} = {}) {
    const widget = new GitInsertionsWidget();
    const context: RenderContext = {
        isPreview: options.isPreview,
        data: options.cwd ? { cwd: options.cwd } : undefined
    };
    const item: WidgetItem = {
        id: 'git-insertions',
        type: 'git-insertions',
        metadata: options.hideNoGit ? { hideNoGit: 'true' } : undefined
    };

    return widget.render(item, context, DEFAULT_SETTINGS);
}

describe('GitInsertionsWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearGitCache();
    });

    it('should render preview', () => {
        expect(render({ isPreview: true })).toBe('+42');
    });

    it('should render cumulative insertions for the current branch vs default', () => {
        setupGitResponses({
            'rev-parse --is-inside-work-tree': 'true\n',
            'symbolic-ref --short refs/remotes/origin/HEAD': 'origin/main',
            'rev-parse --abbrev-ref HEAD': 'feat/x',
            'merge-base HEAD main': 'abc123',
            'diff abc123 --shortstat': '4 files changed, 5 insertions(+), 2 deletions(-)'
        });

        expect(render({ cwd: '/tmp/worktree' })).toBe('+5');
        expectGitExecOptions(mockExecFileSync.mock.calls[0]?.[2], '/tmp/worktree');
        expectGitExecOptions(mockExecFileSync.mock.calls[1]?.[2], '/tmp/worktree');
    });

    it('should render combined staged and unstaged insertions on the default branch', () => {
        setupGitResponses({
            'rev-parse --is-inside-work-tree': 'true\n',
            'symbolic-ref --short refs/remotes/origin/HEAD': 'origin/main',
            'rev-parse --abbrev-ref HEAD': 'main',
            'diff --shortstat': '1 file changed, 2 insertions(+), 1 deletion(-)',
            'diff --cached --shortstat': '1 file changed, 3 insertions(+), 4 deletions(-)'
        });

        expect(render({ cwd: '/tmp/worktree' })).toBe('+5');
    });

    it('should render zero count when repo is clean', () => {
        setupGitResponses({
            'rev-parse --is-inside-work-tree': 'true\n',
            'symbolic-ref --short refs/remotes/origin/HEAD': 'origin/main',
            'rev-parse --abbrev-ref HEAD': 'main',
            'diff --shortstat': '',
            'diff --cached --shortstat': ''
        });

        expect(render()).toBe('+0');
    });

    it('should render no git when probe returns false', () => {
        mockExecFileSync.mockReturnValue('false\n');

        expect(render()).toBe('(no git)');
    });

    it('should hide no git when configured', () => {
        mockExecFileSync.mockReturnValue('false\n');

        expect(render({ hideNoGit: true })).toBeNull();
    });

    it('should render no git when command fails', () => {
        mockExecFileSync.mockImplementation(() => { throw new Error('No git'); });

        expect(render()).toBe('(no git)');
    });

    it('should disable raw value support', () => {
        const widget = new GitInsertionsWidget();

        expect(widget.supportsRawValue()).toBe(false);
    });
});
