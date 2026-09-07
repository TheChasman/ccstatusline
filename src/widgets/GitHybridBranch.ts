import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    HideableState,
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
    NO_GIT_HIDEABLE_STATE,
    isHidden
} from './shared/hideable';

const HYBRID_SYMBOL = '𖠰⎇';

export class GitHybridBranchWidget implements Widget {
    getDefaultColor(): string { return 'magenta'; }
    getDescription(): string { return 'Shows git worktree and branch names without repeated matching values'; }
    getDisplayName(): string { return 'Git Hybrid Branch'; }
    getCategory(): string { return 'Git'; }
    getEditorDisplay(_item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    getHideableStates(): HideableState[] {
        return [NO_GIT_HIDEABLE_STATE];
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        void settings;
        const hideNoGit = isHidden(item, NO_GIT_HIDEABLE_STATE.key);

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

    supportsRawValue(): boolean { return true; }
    supportsColors(_item: WidgetItem): boolean { return true; }
}
