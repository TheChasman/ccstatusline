import { execSync } from 'child_process';
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
import { GitDeletionsWidget } from '../GitDeletions';

vi.mock('child_process', () => ({ execSync: vi.fn() }));

const mockExecSync = execSync as unknown as {
    mock: { calls: unknown[][] };
    mockImplementation: (impl: () => never) => void;
    mockReturnValue: (value: string) => void;
    mockReturnValueOnce: (value: string) => void;
};

function render(options: {
    cwd?: string;
    hideNoGit?: boolean;
    isPreview?: boolean;
} = {}) {
    const widget = new GitDeletionsWidget();
    const context: RenderContext = {
        isPreview: options.isPreview,
        data: options.cwd ? { cwd: options.cwd } : undefined
    };
    const item: WidgetItem = {
        id: 'git-deletions',
        type: 'git-deletions',
        metadata: options.hideNoGit ? { hideNoGit: 'true' } : undefined
    };

    return widget.render(item, context, DEFAULT_SETTINGS);
}

describe('GitDeletionsWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearGitCache();
    });

    it('should render preview', () => {
        expect(render({ isPreview: true })).toBe('-10');
    });

    it('should render cumulative deletions for the current branch vs default', () => {
        mockExecSync.mockImplementation(((cmd: string) => {
            const sub = cmd.replace(/^git\s+/, '');
            const table: Record<string, string> = {
                'rev-parse --is-inside-work-tree': 'true\n',
                'symbolic-ref --short refs/remotes/origin/HEAD': 'origin/main',
                'rev-parse --abbrev-ref HEAD': 'feat/x',
                'merge-base HEAD main': 'abc123',
                'diff abc123 --shortstat': '4 files changed, 2 insertions(+), 5 deletions(-)'
            };
            if (sub in table)
                return table[sub];
            throw new Error(`unexpected git call: ${sub}`);
        }) as unknown as () => never);

        expect(render({ cwd: '/tmp/worktree' })).toBe('-5');
        expect(mockExecSync.mock.calls[0]?.[1]).toEqual({
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'],
            cwd: '/tmp/worktree'
        });
    });

    it('should render zero count when repo is clean', () => {
        mockExecSync.mockImplementation(((cmd: string) => {
            const sub = cmd.replace(/^git\s+/, '');
            const table: Record<string, string> = {
                'rev-parse --is-inside-work-tree': 'true\n',
                'symbolic-ref --short refs/remotes/origin/HEAD': 'origin/main',
                'rev-parse --abbrev-ref HEAD': 'main',
                'rev-parse --verify HEAD~1': 'deadbeef',
                'diff HEAD~1 --shortstat': ''
            };
            if (sub in table)
                return table[sub];
            throw new Error(`unexpected git call: ${sub}`);
        }) as unknown as () => never);

        expect(render()).toBe('-0');
    });

    it('should render no git when probe returns false', () => {
        mockExecSync.mockReturnValue('false\n');

        expect(render()).toBe('(no git)');
    });

    it('should hide no git when configured', () => {
        mockExecSync.mockReturnValue('false\n');

        expect(render({ hideNoGit: true })).toBeNull();
    });

    it('should render no git when command fails', () => {
        mockExecSync.mockImplementation(() => { throw new Error('No git'); });

        expect(render()).toBe('(no git)');
    });

    it('should disable raw value support', () => {
        const widget = new GitDeletionsWidget();

        expect(widget.supportsRawValue()).toBe(false);
    });
});