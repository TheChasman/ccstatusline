import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    DynamicColors,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { loadClaudeSettingsSync } from '../utils/claude-settings';
import {
    getTranscriptThinkingEffort,
    normalizeThinkingEffort,
    type ResolvedThinkingEffort,
    type TranscriptThinkingEffort
} from '../utils/jsonl';
import {
    getTrafficLightColor,
    type TrafficLightColor
} from '../utils/traffic-light';

export type ThinkingEffortLevel = TranscriptThinkingEffort;

function resolveThinkingEffortFromStatusJson(context: RenderContext): ResolvedThinkingEffort | null | undefined {
    const effort = context.data?.effort;
    if (!effort || !('level' in effort)) {
        return undefined;
    }

    return typeof effort.level === 'string' ? normalizeThinkingEffort(effort.level) : null;
}

function resolveThinkingEffortFromSettings(): ResolvedThinkingEffort | undefined {
    try {
        const settings = loadClaudeSettingsSync({ logErrors: false });
        return normalizeThinkingEffort(settings.effortLevel);
    } catch {
        // Settings unavailable, return undefined
    }

    return undefined;
}

function resolveThinkingEffort(context: RenderContext): ResolvedThinkingEffort | null {
    const statusEffort = resolveThinkingEffortFromStatusJson(context);
    if (statusEffort !== undefined) {
        return statusEffort;
    }

    return getTranscriptThinkingEffort(context.data?.transcript_path)
        ?? resolveThinkingEffortFromSettings()
        ?? null;
}

function formatEffort(resolved: ResolvedThinkingEffort | null): string {
    if (!resolved) {
        return 'default';
    }
    return resolved.known ? resolved.value : `${resolved.value}?`;
}

function isAutoModel(context: RenderContext): boolean {
    const model = context.data?.model;
    const modelDisplayName = typeof model === 'string'
        ? model
        : (model?.display_name ?? model?.id);

    return modelDisplayName?.trim().toLowerCase() === 'auto model';
}

export class ThinkingEffortWidget implements Widget {
    getDefaultColor(): string { return 'magenta'; }
    getDescription(): string { return 'Displays the current thinking effort level (low, medium, high, xhigh, max, auto).\nClaude Code reports Ultracode as xhigh in status line data; Ultracode is not exposed as a separate effort level.\nUnknown levels are shown with a trailing "?" (e.g. "super-max?").\nMay be incorrect when multiple Claude Code sessions are running due to current Claude Code limitations.'; }
    getDisplayName(): string { return 'Thinking Effort'; }
    getCategory(): string { return 'Core'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? 'high' : 'Eff: high';
        }

        if (isAutoModel(context)) {
            return item.rawValue ? '-' : 'Thinking: -';
        }

        const effort = formatEffort(resolveThinkingEffort(context));
        return item.rawValue ? effort : `Thinking: ${effort}`;
    }

    getDynamicColors(
        item: WidgetItem,
        context: RenderContext,
        settings: Settings
    ): DynamicColors | null {
        if (isAutoModel(context)) {
            return { color: 'brightBlack' };
        }

        let resolved: ResolvedThinkingEffort | null;

        if (context.data?.thinking_effort) {
            const normalized = normalizeThinkingEffort(context.data.thinking_effort as string);
            resolved = normalized ?? resolveThinkingEffort(context);
        } else {
            resolved = resolveThinkingEffort(context);
        }

        if (!resolved) {
            return null;
        }

        const effortLevel = resolved.value;

        if (effortLevel === 'max') {
            return {
                backgroundColor: getTrafficLightColor('red', settings.colorLevel),
                color: 'white',
                bold: true
            };
        }

        if (effortLevel === 'auto') {
            if (settings.powerline.enabled) {
                return {
                    backgroundColor: getTrafficLightColor('purple', settings.colorLevel),
                    color: 'black'
                };
            }
            return { color: getTrafficLightColor('purple', settings.colorLevel) };
        }

        const trafficMap: Readonly<Record<string, TrafficLightColor | undefined>> = {
            low: 'green',
            medium: 'yellow',
            high: 'orange',
            xhigh: 'red'
        };

        const mappedColor = trafficMap[effortLevel];
        if (!mappedColor) {
            return null;
        }

        const color = getTrafficLightColor(mappedColor, settings.colorLevel);

        if (settings.powerline.enabled) {
            return {
                backgroundColor: color,
                color: 'black'
            };
        }

        return { color };
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
