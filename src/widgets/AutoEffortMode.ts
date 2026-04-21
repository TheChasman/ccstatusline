import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    DynamicColors,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { loadClaudeSettingsSync } from '../utils/claude-settings';

function isAutoEffort(): boolean {
    try {
        const settings = loadClaudeSettingsSync({ logErrors: false });
        return settings.effortLevel?.toLowerCase() === 'auto';
    } catch {
        return false;
    }
}

export class AutoEffortModeWidget implements Widget {
    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return 'Shows Auto(ON) when effort mode is set to auto, Auto[OFF] otherwise.'; }
    getDisplayName(): string { return 'Auto Effort Mode'; }
    getCategory(): string { return 'Core'; }

    getEditorDisplay(_item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? 'on' : 'Auto(ON)';
        }

        const on = isAutoEffort();
        if (item.rawValue) {
            return on ? 'on' : 'off';
        }
        return on ? 'Auto(ON)' : 'Auto[OFF]';
    }

    getDynamicColors(
        _item: WidgetItem,
        context: RenderContext,
        _settings: Settings
    ): DynamicColors | null {
        const on = context.isPreview === true || isAutoEffort();
        if (!on)
            return null;
        return { bold: true };
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(_item: WidgetItem): boolean { return true; }
}