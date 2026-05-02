import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import {
    getDirtyWorktreeCount,
    getGitAheadBehind,
    isInsideGitWorkTree
} from '../utils/git';

export class GitDirtyWidget implements Widget {
    getDefaultColor(): string {
        return 'red';
    }

    getDescription(): string {
        return 'Shows outstanding changes: ↑ unpushed and ↓ unpulled on current branch, ● dirty worktree count — absent when clean';
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

        const ab = getGitAheadBehind(context);
        const ahead = ab?.ahead ?? 0;
        const behind = ab?.behind ?? 0;
        const dirty = getDirtyWorktreeCount(context);

        return `↑${ahead}↓${behind}●${dirty}`;
    }

    supportsRawValue(): boolean {
        return false;
    }

    supportsColors(_item: WidgetItem): boolean {
        return true;
    }
}