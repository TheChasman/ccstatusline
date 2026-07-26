import type { RenderContext } from '../types/RenderContext';
import type {
    CustomKeybind,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import {
    getGitWorktreeName,
    isInsideGitWorkTree
} from '../utils/git';

import {
    getHideNoGitKeybinds,
    getHideNoGitModifierText,
    handleToggleNoGitAction,
    isHideNoGitEnabled
} from './shared/git-no-git';

export class GitWorktreeWidget implements Widget {
    getDefaultColor(): string { return 'blue'; }
    getDescription(): string { return 'Shows the current git worktree name'; }
    getDisplayName(): string { return 'Git Worktree'; }
    getCategory(): string { return 'Git'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return {
            displayText: this.getDisplayName(),
            modifierText: getHideNoGitModifierText(item)
        };
    }

    handleEditorAction(action: string, item: WidgetItem): WidgetItem | null {
        return handleToggleNoGitAction(action, item);
    }

    render(item: WidgetItem, context: RenderContext): string | null {
        const hideNoGit = isHideNoGitEnabled(item);

        if (context.isPreview)
            return item.rawValue ? 'main' : '𖠰 main';

        if (!isInsideGitWorkTree(context)) {
            return hideNoGit ? null : '𖠰 no git';
        }

        const worktree = this.getGitWorktree(context);
        if (worktree)
            return item.rawValue ? worktree : `𖠰 ${worktree}`;

        return hideNoGit ? null : '𖠰 no git';
    }

    private getGitWorktree(context: RenderContext): string | null {
        return getGitWorktreeName(context);
    }

    getCustomKeybinds(): CustomKeybind[] {
        return getHideNoGitKeybinds();
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}