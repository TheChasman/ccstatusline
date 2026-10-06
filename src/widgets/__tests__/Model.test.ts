import {
    describe,
    expect,
    it
} from 'vitest';

import type { RenderContext } from '../../types/RenderContext';
import { DEFAULT_SETTINGS } from '../../types/Settings';
import type { WidgetItem } from '../../types/Widget';
import { getTrafficLightColor } from '../../utils/traffic-light';
import { ModelWidget } from '../Model';

describe('ModelWidget', () => {
    const widget = new ModelWidget();

    describe('basic rendering', () => {
        it('should render preview', () => {
            const context: RenderContext = { isPreview: true, data: {} };
            const item: WidgetItem = { id: '1', type: 'model' };

            expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('Mdl: Claude');
        });

        it('should render preview with raw value', () => {
            const context: RenderContext = { isPreview: true, data: {} };
            const item: WidgetItem = { id: '1', type: 'model', rawValue: true };

            expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('Claude');
        });

        it('should render model name', () => {
            const context: RenderContext = {
                isPreview: false,
                data: { model: 'Claude 3.5 Sonnet' }
            };
            const item: WidgetItem = { id: '1', type: 'model' };

            expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('Mdl: Claude 3.5 Sonnet');
        });

        it('should render model with raw value', () => {
            const context: RenderContext = {
                isPreview: false,
                data: { model: 'Claude 3.5 Sonnet' }
            };
            const item: WidgetItem = { id: '1', type: 'model', rawValue: true };

            expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('Claude 3.5 Sonnet');
        });

        it('should return null when no model data', () => {
            const context: RenderContext = { isPreview: false, data: {} };
            const item: WidgetItem = { id: '1', type: 'model' };

            expect(widget.render(item, context, DEFAULT_SETTINGS)).toBeNull();
        });

        it('should handle model object with display_name', () => {
            const context: RenderContext = {
                isPreview: false,
                data: { model: { display_name: 'Claude 3.5 Sonnet' } }
            };
            const item: WidgetItem = { id: '1', type: 'model' };

            expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('Mdl: Claude 3.5 Sonnet');
        });

        it('should fallback to model id when display_name not available', () => {
            const context: RenderContext = {
                isPreview: false,
                data: { model: { id: 'claude-3-5-sonnet' } }
            };
            const item: WidgetItem = { id: '1', type: 'model' };

            expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('Mdl: claude-3-5-sonnet');
        });
    });

    describe('getDynamicColors', () => {
        it.each([
            ['gpt-6.1-sol', 'GPT-6.1 Sol', 'ansi256:34'],
            ['gpt-6-sol', 'GPT-6 Sol', 'ansi256:34'],
            ['gpt-5.6-terra', 'GPT-5.6 Terra', 'ansi256:34'],
            ['claude-sonnet-5', 'Sonnet 5', 'ansi256:34'],
            ['claude-opus-5-5', 'Opus 5.5', 'ansi256:214'],
            ['kimi-k3', 'Kimi K3 (Droid Core)', 'ansi256:214'],
            ['gpt-5.4', 'GPT-5.4', 'ansi256:214'],
            ['claude-opus-5', 'Opus 5', 'ansi256:196'],
            ['claude-opus-5-5-fast', 'Opus 5.5 Fast', 'ansi256:196'],
            ['gpt-6-astra', 'GPT-6 Astra', 'ansi256:196'],
            ['gemini-3.1-pro-preview', 'Gemini 3.1 Pro', 'ansi256:34'],
            ['grok-4.7', 'Grok 4.7', 'ansi256:34']
        ])('colours %s by multiplier rather than its display name', (id, displayName, color) => {
            const context: RenderContext = { data: { model: { id, display_name: displayName } } };
            const item: WidgetItem = { id: '1', type: 'model' };
            const settings = { ...DEFAULT_SETTINGS, colorLevel: 2 as const };

            expect(widget.getDynamicColors(item, context, settings)).toEqual({ color });
        });

        it('uses the multiplier when only the model id is available', () => {
            const context: RenderContext = { data: { model: { id: 'GPT-6.1-SOL[1m]' } } };
            const settings = { ...DEFAULT_SETTINGS, colorLevel: 3 as const };

            expect(widget.getDynamicColors({ id: '1', type: 'model' }, context, settings))
                .toEqual({ color: 'hex:00AF00' });
        });

        it('uses the multiplier for a model id supplied as a string', () => {
            const context: RenderContext = { data: { model: 'gpt-6.1-sol' } };
            const settings = { ...DEFAULT_SETTINGS, colorLevel: 2 as const };

            expect(widget.getDynamicColors({ id: '1', type: 'model' }, context, settings))
                .toEqual({ color: 'ansi256:34' });
        });

        it('uses multiplier colours as the Powerline background', () => {
            const context: RenderContext = { data: { model: { id: 'gpt-6.1-sol', display_name: 'GPT-6.1 Sol' } } };
            const settings = {
                ...DEFAULT_SETTINGS,
                colorLevel: 2 as const,
                powerline: { ...DEFAULT_SETTINGS.powerline, enabled: true }
            };

            expect(widget.getDynamicColors({ id: '1', type: 'model' }, context, settings))
                .toEqual({ backgroundColor: 'ansi256:34', color: 'black' });
        });

        it('keeps the name rule when an id has no published multiplier', () => {
            const context: RenderContext = { data: { model: { id: 'custom-sol', display_name: 'Custom Sol' } } };
            const settings = { ...DEFAULT_SETTINGS, colorLevel: 2 as const };

            expect(widget.getDynamicColors({ id: '1', type: 'model' }, context, settings))
                .toEqual({ color: 'ansi256:196' });
        });

        it('does not guess a multiplier for Auto Model', () => {
            const context: RenderContext = { data: { model: { id: 'auto', display_name: 'Auto Model' } } };

            expect(widget.getDynamicColors({ id: '1', type: 'model' }, context, DEFAULT_SETTINGS)).toBeNull();
        });

        it('returns green for haiku models', () => {
            const context: RenderContext = { data: { model: 'Claude 3.5 Haiku' } };
            const item: WidgetItem = { id: '1', type: 'model' };

            const result = widget.getDynamicColors(item, context, DEFAULT_SETTINGS);
            expect(result).toEqual({ color: getTrafficLightColor('green', DEFAULT_SETTINGS.colorLevel) });
        });

        it('returns orange for sonnet models', () => {
            const context: RenderContext = { data: { model: 'Claude 3.5 Sonnet' } };
            const item: WidgetItem = { id: '1', type: 'model' };

            const result = widget.getDynamicColors(item, context, DEFAULT_SETTINGS);
            expect(result).toEqual({ color: getTrafficLightColor('orange', DEFAULT_SETTINGS.colorLevel) });
        });

        it('returns red for opus models', () => {
            const context: RenderContext = { data: { model: 'Claude 3 Opus' } };
            const item: WidgetItem = { id: '1', type: 'model' };

            const result = widget.getDynamicColors(item, context, DEFAULT_SETTINGS);
            expect(result).toEqual({ color: getTrafficLightColor('red', DEFAULT_SETTINGS.colorLevel) });
        });

        it('returns green for luna models', () => {
            const context: RenderContext = { data: { model: 'Codex Luna' } };
            const item: WidgetItem = { id: '1', type: 'model' };

            const result = widget.getDynamicColors(item, context, DEFAULT_SETTINGS);
            expect(result).toEqual({ color: getTrafficLightColor('green', DEFAULT_SETTINGS.colorLevel) });
        });

        it('returns orange for terra models', () => {
            const context: RenderContext = { data: { model: 'Codex Terra' } };
            const item: WidgetItem = { id: '1', type: 'model' };

            const result = widget.getDynamicColors(item, context, DEFAULT_SETTINGS);
            expect(result).toEqual({ color: getTrafficLightColor('orange', DEFAULT_SETTINGS.colorLevel) });
        });

        it('returns red for sol models', () => {
            const context: RenderContext = { data: { model: 'Codex Sol' } };
            const item: WidgetItem = { id: '1', type: 'model' };

            const result = widget.getDynamicColors(item, context, DEFAULT_SETTINGS);
            expect(result).toEqual({ color: getTrafficLightColor('red', DEFAULT_SETTINGS.colorLevel) });
        });

        it('returns null for unknown models', () => {
            const context: RenderContext = { data: { model: 'CustomModel' } };
            const item: WidgetItem = { id: '1', type: 'model' };

            const result = widget.getDynamicColors(item, context, DEFAULT_SETTINGS);
            expect(result).toBeNull();
        });

        it('returns null when no model data', () => {
            const context: RenderContext = { data: {} };
            const item: WidgetItem = { id: '1', type: 'model' };

            const result = widget.getDynamicColors(item, context, DEFAULT_SETTINGS);
            expect(result).toBeNull();
        });

        it('matches model family case-insensitively', () => {
            const context: RenderContext = { data: { model: 'CLAUDE 3.5 SONNET' } };
            const item: WidgetItem = { id: '1', type: 'model' };

            const result = widget.getDynamicColors(item, context, DEFAULT_SETTINGS);
            expect(result).toEqual({ color: getTrafficLightColor('orange', DEFAULT_SETTINGS.colorLevel) });
        });

        it('returns backgroundColor and color for powerline mode', () => {
            const context: RenderContext = { data: { model: 'Claude 3.5 Sonnet' } };
            const item: WidgetItem = { id: '1', type: 'model' };
            const settings = { ...DEFAULT_SETTINGS, powerline: { ...DEFAULT_SETTINGS.powerline, enabled: true } };

            const result = widget.getDynamicColors(item, context, settings);
            expect(result).toEqual({
                backgroundColor: getTrafficLightColor('orange', settings.colorLevel),
                color: 'black'
            });
        });

        it('handles model object in getDynamicColors', () => {
            const context: RenderContext = { data: { model: { display_name: 'Claude 3.5 Sonnet' } } };
            const item: WidgetItem = { id: '1', type: 'model' };

            const result = widget.getDynamicColors(item, context, DEFAULT_SETTINGS);
            expect(result).toEqual({ color: getTrafficLightColor('orange', DEFAULT_SETTINGS.colorLevel) });
        });

        it('returns null for model object without identifiable data', () => {
            const context: RenderContext = { data: { model: {} } };
            const item: WidgetItem = { id: '1', type: 'model' };

            const result = widget.getDynamicColors(item, context, DEFAULT_SETTINGS);
            expect(result).toBeNull();
        });
    });
});
