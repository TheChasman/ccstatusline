import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    DynamicColors,
    HideableState,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { getForkStatus } from '../utils/git-remote';
import { getTrafficLightColor } from '../utils/traffic-light';

import { isHidden } from './shared/hideable';

const NOT_FORK_HIDEABLE_STATE: HideableState = { key: 'not-fork', label: 'when repo is not a fork' };

export class GitIsForkWidget implements Widget {
    getDefaultColor(): string { return 'yellow'; }
    getDescription(): string { return 'Shows fork indicator when repo is a fork of upstream'; }
    getDisplayName(): string { return 'Git Is Fork'; }
    getCategory(): string { return 'Git'; }

    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    getHideableStates(): HideableState[] {
        return [NOT_FORK_HIDEABLE_STATE];
    }

    render(item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? 'true' : 'Frk: true';
        }

        const forkStatus = getForkStatus(context);
        const isFork = forkStatus.isFork;

        if (!isFork && isHidden(item, NOT_FORK_HIDEABLE_STATE.key)) {
            return null;
        }

        const valueText = isFork ? 'true' : 'false';

        return item.rawValue ? valueText : `Frk: ${valueText}`;
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
                color: 'black'
            };
        }

        return { color };
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(_item: WidgetItem): boolean { return true; }
}
