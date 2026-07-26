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
import { GitHybridBranchWidget } from '../GitHybridBranch';

vi.mock('child_process', () => ({ execSync: vi.fn() }));

const mockExecSync = execSync as unknown as {
    mockImplementation: (impl: () => never) => void;
    mockReturnValue: (value: string) => void;
    mockReturnValueOnce: (value: string) => void;
};

function render(options: {
    hideNoGit?: boolean;
    isPreview?: boolean;
    rawValue?: boolean;
} = {}) {
    const widget = new GitHybridBranchWidget();
    const context: RenderContext = { isPreview: options.isPreview };
    const item: WidgetItem = {
        id: 'git-hybrid-branch',
        type: 'git-hybrid-branch',
        rawValue: options.rawValue,
        metadata: options.hideNoGit ? { hideNoGit: 'true' } : undefined
    };

    return widget.render(item, context, DEFAULT_SETTINGS);
}

describe('GitHybridBranchWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearGitCache();
    });

    it('should render preview', () => {
        expect(render({ isPreview: true })).toBe('𖠰⎇ main');
    });

    it('should render preview with raw value', () => {
        expect(render({ isPreview: true, rawValue: true })).toBe('main');
    });

    it('should collapse matching branch and worktree values', () => {
        mockExecSync.mockReturnValueOnce('true\n');
        mockExecSync.mockReturnValueOnce('feature/demo');
        mockExecSync.mockReturnValueOnce('/repo/.git/worktrees/feature/demo');

        expect(render()).toBe('𖠰⎇ feature/demo');
    });

    it('should collapse matching branch and worktree values with raw value', () => {
        mockExecSync.mockReturnValueOnce('true\n');
        mockExecSync.mockReturnValueOnce('feature/demo');
        mockExecSync.mockReturnValueOnce('/repo/.git/worktrees/feature/demo');

        expect(render({ rawValue: true })).toBe('feature/demo');
    });

    it('should render different branch and worktree values in parens', () => {
        mockExecSync.mockReturnValueOnce('true\n');
        mockExecSync.mockReturnValueOnce('feature/demo');
        mockExecSync.mockReturnValueOnce('/repo/.git/worktrees/demo-worktree');

        expect(render()).toBe('𖠰demo-worktree (⎇feature/demo)');
    });

    it('should render different branch and worktree values in parens with raw value', () => {
        mockExecSync.mockReturnValueOnce('true\n');
        mockExecSync.mockReturnValueOnce('feature/demo');
        mockExecSync.mockReturnValueOnce('/repo/.git/worktrees/demo-worktree');

        expect(render({ rawValue: true })).toBe('demo-worktree (feature/demo)');
    });

    it('should render the branch once when worktree lookup is empty', () => {
        mockExecSync.mockReturnValueOnce('true\n');
        mockExecSync.mockReturnValueOnce('feature/demo');
        mockExecSync.mockReturnValueOnce('');

        expect(render()).toBe('𖠰⎇ feature/demo');
    });

    it('should render the worktree once when branch lookup is empty', () => {
        mockExecSync.mockReturnValueOnce('true\n');
        mockExecSync.mockReturnValueOnce('');
        mockExecSync.mockReturnValueOnce('/repo/.git/worktrees/demo-worktree');

        expect(render()).toBe('𖠰⎇ demo-worktree');
    });

    it('should render no git when probe returns false', () => {
        mockExecSync.mockReturnValue('false\n');

        expect(render()).toBe('𖠰⎇ no git');
    });

    it('should hide no git when configured', () => {
        mockExecSync.mockReturnValue('false\n');

        expect(render({ hideNoGit: true })).toBeNull();
    });

    it('should render no git when both lookups are empty', () => {
        mockExecSync.mockReturnValueOnce('true\n');
        mockExecSync.mockReturnValueOnce('');
        mockExecSync.mockReturnValueOnce('');

        expect(render()).toBe('𖠰⎇ no git');
    });

    it('should render no git when git commands fail', () => {
        mockExecSync.mockImplementation(() => { throw new Error('No git'); });

        expect(render()).toBe('𖠰⎇ no git');
    });
});