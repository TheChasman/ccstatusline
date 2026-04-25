import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import {
    getDirtyWorktreeCount,
    getTotalAheadBehind,
    isInsideGitWorkTree
} from '../utils/git';

export class GitDirtyWidget implements Widget {
    getDefaultColor(): string {
        return 'red';
    }

    getDescription(): string {
        return 'Shows outstanding changes: ↑ unpushed and ↓ unpulled across all branches, ● dirty worktree count — absent when clean';
    }

    getDisplayName(): string {
        return 'Git Dirty';
    }

    getCategory(): string {
        return 'Git';
    }

    getEditorDisplay(_item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(_item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        if (context.isPreview)
            return '↑2↓3●1';

        if (!isInsideGitWorkTree(context))
            return null;

        const { ahead, behind } = getTotalAheadBehind(context);
        const dirty = getDirtyWorktreeCount(context);

        if (ahead === 0 && behind === 0 && dirty === 0)
            return null;

        const parts: string[] = [];
        if (ahead > 0)
            parts.push(`↑${ahead}`);

        if (behind > 0)
            parts.push(`↓${behind}`);

        if (dirty > 0)
            parts.push(`●${dirty}`);

        return parts.join('');
    }

    supportsRawValue(): boolean {
        return false;
    }

    supportsColors(_item: WidgetItem): boolean {
        return true;
    }
}