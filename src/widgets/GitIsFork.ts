import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    DynamicColors,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { getForkStatus } from '../utils/git-remote';
import { getTrafficLightColor } from '../utils/traffic-light';

import { makeModifierText } from './shared/editor-display';
import {
    isMetadataFlagEnabled,
    toggleMetadataFlag
} from './shared/metadata';

const HIDE_WHEN_NOT_FORK_KEY = 'hideWhenNotFork';
const TOGGLE_HIDE_ACTION = 'toggle-hide';

export class GitIsForkWidget implements Widget {
    getDefaultColor(): string { return 'yellow'; }
    getDescription(): string { return 'Shows fork indicator when repo is a fork of upstream'; }
    getDisplayName(): string { return 'Git Is Fork'; }
    getCategory(): string { return 'Git'; }

    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        const modifiers: string[] = [];

        if (isMetadataFlagEnabled(item, HIDE_WHEN_NOT_FORK_KEY)) {
            modifiers.push('hide when not fork');
        }

        return {
            displayText: this.getDisplayName(),
            modifierText: makeModifierText(modifiers)
        };
    }

    handleEditorAction(action: string, item: WidgetItem): WidgetItem | null {
        if (action === TOGGLE_HIDE_ACTION) {
            return toggleMetadataFlag(item, HIDE_WHEN_NOT_FORK_KEY);
        }

        return null;
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        const hideWhenNotFork = isMetadataFlagEnabled(item, HIDE_WHEN_NOT_FORK_KEY);

        if (context.isPreview) {
            return item.rawValue ? 'true' : 'isFork: true';
        }

        const forkStatus = getForkStatus(context);
        const isFork = forkStatus.isFork;

        if (!isFork && hideWhenNotFork) {
            return null;
        }

        const valueText = isFork ? 'true' : 'false';

        return item.rawValue ? valueText : `isFork: ${valueText}`;
    }

    getDynamicColors(
        item: WidgetItem,
        context: RenderContext,
        settings: Settings
    ): DynamicColors | null {
        let isFork: boolean;

        if (context.isPreview) {
            isFork = true;
        } else {
            const forkStatus = getForkStatus(context);
            isFork = forkStatus.isFork;
        }

        const trafficLevel = isFork ? 'red' : 'green';
        const color = getTrafficLightColor(trafficLevel, settings.colorLevel);

        if (settings.powerline.enabled) {
            return {
                backgroundColor: color,
                color: 'black',
            };
        }

        return { color };
    }

    getCustomKeybinds(): CustomKeybind[] {
        return [
            { key: 'h', label: '(h)ide when not fork', action: TOGGLE_HIDE_ACTION }
        ];
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(_item: WidgetItem): boolean { return true; }
}