import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    DynamicColors,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { loadClaudeSettingsSync } from '../utils/claude-settings';
import { getTrafficLightColor } from '../utils/traffic-light';
import { getTranscriptThinkingEffort } from '../utils/jsonl';

export type ThinkingEffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'auto';

/**
 * Resolve thinking effort from transcript and settings.
 */
function normalizeThinkingEffort(value: string | undefined): ThinkingEffortLevel | undefined {
    if (!value) {
        return undefined;
    }

    const normalized = value.toLowerCase();
    if (
        normalized === 'low' || normalized === 'medium' || normalized === 'high' ||
        normalized === 'xhigh' || normalized === 'max' || normalized === 'auto'
    ) {
        return normalized;
    }

    return undefined;
}

function resolveThinkingEffortFromSettings(): ThinkingEffortLevel | undefined {
    try {
        const settings = loadClaudeSettingsSync({ logErrors: false });
        return normalizeThinkingEffort(settings.effortLevel);
    } catch {
        // Settings unavailable, return undefined
    }

    return undefined;
}

function resolveThinkingEffort(context: RenderContext): ThinkingEffortLevel {
    return getTranscriptThinkingEffort(context.data?.transcript_path)
        ?? resolveThinkingEffortFromSettings()
        ?? 'medium';
}

export class ThinkingEffortWidget implements Widget {
    getDefaultColor(): string { return 'magenta'; }
    getDescription(): string { return 'Displays the current thinking effort level (low, medium, high, max).\nMay be incorrect when multiple Claude Code sessions are running due to current Claude Code limitations.'; }
    getDisplayName(): string { return 'Thinking Effort'; }
    getCategory(): string { return 'Core'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? 'high' : 'Eff: high';
        }

        const effort = resolveThinkingEffort(context);
        return item.rawValue ? effort : `Eff: ${effort}`;
    }

    getDynamicColors(
        item: WidgetItem,
        context: RenderContext,
        settings: Settings
    ): DynamicColors | null {
        // Resolve effort level: check direct context.data first, then fall back to transcript/settings
        let effortLevel: ThinkingEffortLevel;

        if (context.data?.thinking_effort) {
            const normalized = normalizeThinkingEffort(context.data.thinking_effort as string);
            effortLevel = normalized ?? resolveThinkingEffort(context);
        } else {
            effortLevel = resolveThinkingEffort(context);
        }

        // Max gets special treatment: red background + bold white, both modes
        if (effortLevel === 'max') {
            return {
                backgroundColor: getTrafficLightColor('red', settings.colorLevel),
                color: 'white',
                bold: true,
            };
        }

        // Map low/medium/high to traffic-light colours
        let trafficLightLevel: 'green' | 'amber' | 'red';

        if (effortLevel === 'low') {
            trafficLightLevel = 'green';
        } else if (effortLevel === 'high') {
            trafficLightLevel = 'red';
        } else {
            // medium (or any other unknown value defaults to medium)
            trafficLightLevel = 'amber';
        }

        const color = getTrafficLightColor(trafficLightLevel, settings.colorLevel);

        if (settings.powerline.enabled) {
            return {
                backgroundColor: color,
                color: 'black',
            };
        }

        return {
            color,
        };
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}