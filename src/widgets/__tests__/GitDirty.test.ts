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
import {
    getDirtyWorktreeCount,
    getGitAheadBehind,
    isInsideGitWorkTree
} from '../../utils/git';
import { GitDirtyWidget } from '../GitDirty';

vi.mock('../../utils/git', () => ({
    getDirtyWorktreeCount: vi.fn(),
    getGitAheadBehind: vi.fn(),
    isInsideGitWorkTree: vi.fn()
}));

const mockIsInside = isInsideGitWorkTree as Mock;
const mockAheadBehind = getGitAheadBehind as Mock;
const mockDirty = getDirtyWorktreeCount as Mock;

const widget = new GitDirtyWidget();
const item: WidgetItem = { id: 'git-dirty', type: 'git-dirty' };
const context: RenderContext = { data: { cwd: '/repo' } };

describe('GitDirtyWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns preview string', () => {
        const previewContext: RenderContext = { isPreview: true };
        expect(widget.render(item, previewContext, DEFAULT_SETTINGS)).toBe('↑2↓3●1');
    });

    it('returns null when not inside a git repo', () => {
        mockIsInside.mockReturnValue(false);
        expect(widget.render(item, context, DEFAULT_SETTINGS)).toBeNull();
    });

    it('shows zeros when repo is fully clean', () => {
        mockIsInside.mockReturnValue(true);
        mockAheadBehind.mockReturnValue({ ahead: 0, behind: 0 });
        mockDirty.mockReturnValue(0);
        expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('↑0↓0●0');
    });

    it('shows all parts when only ahead', () => {
        mockIsInside.mockReturnValue(true);
        mockAheadBehind.mockReturnValue({ ahead: 3, behind: 0 });
        mockDirty.mockReturnValue(0);
        expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('↑3↓0●0');
    });

    it('shows all parts when only behind', () => {
        mockIsInside.mockReturnValue(true);
        mockAheadBehind.mockReturnValue({ ahead: 0, behind: 2 });
        mockDirty.mockReturnValue(0);
        expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('↑0↓2●0');
    });

    it('shows all parts when only worktrees are dirty', () => {
        mockIsInside.mockReturnValue(true);
        mockAheadBehind.mockReturnValue({ ahead: 0, behind: 0 });
        mockDirty.mockReturnValue(1);
        expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('↑0↓0●1');
    });

    it('shows all three parts when all are non-zero', () => {
        mockIsInside.mockReturnValue(true);
        mockAheadBehind.mockReturnValue({ ahead: 2, behind: 3 });
        mockDirty.mockReturnValue(1);
        expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('↑2↓3●1');
    });

    it('has correct metadata', () => {
        expect(widget.getDefaultColor()).toBe('red');
        expect(widget.getDisplayName()).toBe('Git Dirty');
        expect(widget.getCategory()).toBe('Git');
        expect(widget.supportsRawValue()).toBe(false);
        expect(widget.supportsColors(item)).toBe(true);
    });
});