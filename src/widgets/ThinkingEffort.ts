import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    DynamicColors,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { loadClaudeSettingsSync } from '../utils/claude-settings';
import { getTrafficLightColor, type TrafficLightColor } from '../utils/traffic-light';
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
    getDescription(): string { return 'Displays the current thinking effort level (low, medium, high, xhigh, max, auto).\nMay be incorrect when multiple Claude Code sessions are running due to current Claude Code limitations.'; }
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
        let effortLevel: ThinkingEffortLevel;

        if (context.data?.thinking_effort) {
            const normalized = normalizeThinkingEffort(context.data.thinking_effort as string);
            effortLevel = normalized ?? resolveThinkingEffort(context);
        } else {
            effortLevel = resolveThinkingEffort(context);
        }

        if (effortLevel === 'max') {
            return {
                backgroundColor: getTrafficLightColor('red', settings.colorLevel),
                color: 'white',
                bold: true,
            };
        }

        if (effortLevel === 'auto') {
            if (settings.powerline.enabled) {
                return {
                    backgroundColor: getTrafficLightColor('purple', settings.colorLevel),
                    color: 'black',
                };
            }
            return {
                color: getTrafficLightColor('purple', settings.colorLevel),
            };
        }

        const trafficMap: Record<'low' | 'medium' | 'high' | 'xhigh', TrafficLightColor> = {
            low: 'green',
            medium: 'yellow',
            high: 'orange',
            xhigh: 'red',
        };

        const color = getTrafficLightColor(trafficMap[effortLevel], settings.colorLevel);

        if (settings.powerline.enabled) {
            return {
                backgroundColor: color,
                color: 'black',
            };
        }

        return { color };
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
