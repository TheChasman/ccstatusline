import { getColorLevelString } from '../types/ColorLevel';
import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    DynamicColors,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import {
    makeBrailleContextBar,
    resolveBrailleBarWidth
} from '../utils/braille-context-bar';
import { getColorAnsiCode } from '../utils/colors';
import { getContextWindowMetrics } from '../utils/context-window';
import { formatTokens } from '../utils/format-tokens';
import {
    getContextConfig,
    getModelContextIdentifier
} from '../utils/model-context';
import {
    formatPercent,
    resolveNumberFormat
} from '../utils/number-format';
import { getTrafficLightColor } from '../utils/traffic-light';

import { makeSliderBar } from './shared/usage-display';

type DisplayMode = 'progress' | 'progress-short' | 'slider' | 'slider-only';

function getDisplayMode(item: WidgetItem): DisplayMode {
    const mode = item.metadata?.display;
    if (mode === 'progress' || mode === 'slider' || mode === 'slider-only') {
        return mode;
    }
    return 'progress-short';
}

function isBarSliderMode(mode: DisplayMode): boolean {
    return mode === 'slider' || mode === 'slider-only';
}

function useAsciiRail(): boolean {
    const locale = [process.env.LC_ALL, process.env.LC_CTYPE, process.env.LANG].find(value => value && value.length > 0);
    return Boolean(locale && !/utf-?8/i.test(locale));
}

function resolveThresholds(metadata?: Record<string, string>): { warning: number; critical: number } {
    const parse = (value: string | undefined, fallback: number): number => {
        if (value === undefined || !/^\s*\d+(?:\.\d+)?\s*$/.test(value))
            return fallback;
        const number = Number(value);
        return Number.isFinite(number) && number >= 0 && number <= 100 ? number : fallback;
    };
    const warning = parse(metadata?.brailleWarningAt, 50);
    const critical = parse(metadata?.brailleCriticalAt, 75);
    return warning < critical ? { warning, critical } : { warning: 50, critical: 75 };
}

function renderBrailleRail(
    used: number,
    total: number,
    width: number,
    item: WidgetItem,
    settings: Settings
): string {
    if (width === 0)
        return '';

    const ascii = useAsciiRail();
    const rawBar = makeBrailleContextBar(used, total, width, ascii);
    const cells = rawBar.slice(1, -1);
    const track = ascii ? '-' : '⣀';
    const firstTrack = cells.indexOf(track);
    const filledEnd = firstTrack === -1 ? cells.length : firstTrack;
    const fill = cells.slice(0, filledEnd);
    const empty = cells.slice(filledEnd);
    const { warning, critical } = resolveThresholds(item.metadata);
    const percentage = total > 0 ? (used / total) * 100 : 0;
    const level = percentage >= critical ? 'high' : percentage >= warning ? 'medium' : 'low';
    const defaultColor = level === 'high' ? 'red' : level === 'medium' ? 'orange' : 'green';
    const configuredColor = item.metadata?.[`braille${level[0]?.toUpperCase()}${level.slice(1)}Color`];
    const colorLevel = getColorLevelString(settings.colorLevel);
    const defaultCode = getColorAnsiCode(getTrafficLightColor(defaultColor, settings.colorLevel), colorLevel);
    const fillCode = getColorAnsiCode(configuredColor, colorLevel) || defaultCode;
    const delimiterCode = getColorAnsiCode('ansi256:244', colorLevel);
    const trackCode = getColorAnsiCode('ansi256:238', colorLevel);

    return `${delimiterCode}${rawBar[0]}${fill ? `${fillCode}${fill}` : ''}${empty ? `${trackCode}${empty}` : ''}${delimiterCode}${rawBar[rawBar.length - 1]}\x1b[0m`;
}

export class ContextBarWidget implements Widget {
    getDefaultColor(): string { return 'blue'; }
    getDescription(): string { return 'Shows context usage as a progress bar'; }
    getDisplayName(): string { return 'Context Bar'; }
    getCategory(): string { return 'Context'; }

    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        const mode = getDisplayMode(item);
        const modifiers: string[] = [];

        if (mode === 'progress-short') {
            modifiers.push('medium bar');
        } else if (mode === 'slider') {
            modifiers.push('short bar');
        } else if (mode === 'slider-only') {
            modifiers.push('short bar only');
        }

        return {
            displayText: this.getDisplayName(),
            modifierText: modifiers.length > 0 ? `(${modifiers.join(', ')})` : undefined
        };
    }

    handleEditorAction(action: string, item: WidgetItem): WidgetItem | null {
        if (action !== 'toggle-progress') {
            return null;
        }

        const currentMode = getDisplayMode(item);
        const nextMode: DisplayMode = currentMode === 'progress-short'
            ? 'progress'
            : currentMode === 'progress'
                ? 'slider'
                : currentMode === 'slider'
                    ? 'slider-only'
                    : 'progress-short';

        return {
            ...item,
            metadata: {
                ...(item.metadata ?? {}),
                display: nextMode
            }
        };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        const displayMode = getDisplayMode(item);
        const tokenFormat = resolveNumberFormat('token', item, settings);
        const percentFormat = resolveNumberFormat('percent', item, settings);

        if (context.isPreview) {
            const usedDisplay = formatTokens(50000, tokenFormat, 0);
            const totalDisplay = formatTokens(200000, tokenFormat, 0);
            const percentDisplay = formatPercent(25, percentFormat, 0);
            if (isBarSliderMode(displayMode)) {
                const slider = makeSliderBar(25);
                const sliderDisplay = displayMode === 'slider' ? `${slider} ${usedDisplay}/${totalDisplay} (${percentDisplay})` : slider;
                return item.rawValue ? sliderDisplay : `Context: ${sliderDisplay}`;
            }
            const barWidth = context.contextBarWidth ?? resolveBrailleBarWidth(item.metadata);
            const rail = renderBrailleRail(50000, 200000, barWidth, item, settings);
            const previewDisplay = `${rail ? `${rail} ` : ''}${usedDisplay}/${totalDisplay} (${percentDisplay})`;
            return item.rawValue ? previewDisplay : `Ctxt: ${previewDisplay}`;
        }

        const contextWindowMetrics = getContextWindowMetrics(context.data);

        let total = contextWindowMetrics.windowSize;
        let used = contextWindowMetrics.contextLengthTokens;

        if (used === null && context.tokenMetrics) {
            used = context.tokenMetrics.contextLength;
        }

        if (total === null && context.tokenMetrics) {
            const modelIdentifier = getModelContextIdentifier(context.data?.model);
            total = getContextConfig(modelIdentifier).maxTokens;
        }

        if (used === null || total === null || total <= 0) {
            if (isBarSliderMode(displayMode))
                return null;
            const barWidth = context.contextBarWidth ?? resolveBrailleBarWidth(item.metadata);
            const rail = renderBrailleRail(0, 0, barWidth, item, settings);
            return item.rawValue ? rail : `Ctxt: ${rail}`;
        }

        const percent = (used / total) * 100;
        const clampedPercent = Math.max(0, Math.min(100, percent));
        const usedDisplay = formatTokens(used, tokenFormat, 0);
        const totalDisplay = formatTokens(total, tokenFormat, 0);
        const percentDisplay = formatPercent(clampedPercent, percentFormat, 0);

        if (isBarSliderMode(displayMode)) {
            const slider = makeSliderBar(clampedPercent);
            const sliderDisplay = displayMode === 'slider' ? `${slider} ${usedDisplay}/${totalDisplay} (${percentDisplay})` : slider;
            return item.rawValue ? sliderDisplay : `Context: ${sliderDisplay}`;
        }

        const barWidth = context.contextBarWidth ?? resolveBrailleBarWidth(item.metadata);
        const rail = renderBrailleRail(used, total, barWidth, item, settings);
        const display = `${rail ? `${rail} ` : ''}${usedDisplay}/${totalDisplay} (${percentDisplay})`;

        return item.rawValue ? display : `Ctxt: ${display}`;
    }

    getCustomKeybinds(): CustomKeybind[] {
        return [
            { key: 'p', label: '(p)rogress toggle', action: 'toggle-progress' }
        ];
    }

    getDynamicColors(
        item: WidgetItem,
        context: RenderContext,
        settings: Settings
    ): DynamicColors | null {
        if (!isBarSliderMode(getDisplayMode(item))) {
            return null;
        }
        if (context.isPreview) {
            return null;
        }

        const contextWindowMetrics = getContextWindowMetrics(context.data);
        let total = contextWindowMetrics.windowSize;
        let used = contextWindowMetrics.contextLengthTokens;

        if (used === null && context.tokenMetrics) {
            used = context.tokenMetrics.contextLength;
        }

        if (total === null && context.tokenMetrics) {
            const modelIdentifier = getModelContextIdentifier(context.data?.model);
            total = getContextConfig(modelIdentifier).maxTokens;
        }

        if (used === null || total === null || total <= 0) {
            return null;
        }

        const percent = Math.max(0, Math.min(100, (used / total) * 100));

        if (percent >= 70) {
            const red = getTrafficLightColor('red', settings.colorLevel);
            return { backgroundColor: red, color: 'white' };
        }

        if (percent >= 60) {
            return { color: getTrafficLightColor('red', settings.colorLevel) };
        }

        if (percent >= 50) {
            return { color: getTrafficLightColor('orange', settings.colorLevel) };
        }

        return null;
    }

    supportsRawValue(): boolean { return true; }
    preservesRenderedColors(item: WidgetItem): boolean { return !isBarSliderMode(getDisplayMode(item)); }
    supportsColors(item: WidgetItem): boolean { return true; }
    supportsNumberFormat(): boolean { return true; }
}
