import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import {
    getGitWorktreeName,
    isInsideGitWorkTree,
    runGit
} from '../utils/git';

import {
    getHideNoGitKeybinds,
    getHideNoGitModifierText,
    handleToggleNoGitAction,
    isHideNoGitEnabled
} from './shared/git-no-git';

const HYBRID_SYMBOL = '𖠰⎇';

export class GitHybridBranchWidget implements Widget {
    getDefaultColor(): string { return 'magenta'; }
    getDescription(): string { return 'Shows git worktree and branch names without repeated matching values'; }
    getDisplayName(): string { return 'Git Hybrid Branch'; }
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

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        void settings;
        const hideNoGit = isHideNoGitEnabled(item);

        if (context.isPreview)
            return item.rawValue ? 'main' : `${HYBRID_SYMBOL} main`;

        if (!isInsideGitWorkTree(context)) {
            return hideNoGit ? null : `${HYBRID_SYMBOL} no git`;
        }

        const branch = this.getGitBranch(context);
        const worktree = getGitWorktreeName(context);
        const text = this.formatValue(worktree, branch, Boolean(item.rawValue));

        if (text)
            return text;

        return hideNoGit ? null : `${HYBRID_SYMBOL} no git`;
    }

    private formatValue(worktree: string | null, branch: string | null, rawValue: boolean): string | null {
        if (worktree && branch && worktree !== branch) {
            return rawValue
                ? `${worktree} (${branch})`
                : `𖠰${worktree} (⎇${branch})`;
        }

        const value = worktree ?? branch;
        if (!value)
            return null;

        return rawValue ? value : `${HYBRID_SYMBOL} ${value}`;
    }

    private getGitBranch(context: RenderContext): string | null {
        return runGit('branch --show-current', context);
    }

    getCustomKeybinds(): CustomKeybind[] {
        return getHideNoGitKeybinds();
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}