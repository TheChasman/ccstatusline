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
        it('returns green for haiku models', () => {
            const context: RenderContext = {
                data: { model: 'Claude 3.5 Haiku' }
            };
            const item: WidgetItem = { id: '1', type: 'model' };

            const result = widget.getDynamicColors?.(item, context, DEFAULT_SETTINGS);
            expect(result).toEqual({
                color: getTrafficLightColor('green', DEFAULT_SETTINGS.colorLevel)
            });
        });

        it('returns orange for sonnet models', () => {
            const context: RenderContext = {
                data: { model: 'Claude 3.5 Sonnet' }
            };
            const item: WidgetItem = { id: '1', type: 'model' };

            const result = widget.getDynamicColors?.(item, context, DEFAULT_SETTINGS);
            expect(result).toEqual({
                color: getTrafficLightColor('orange', DEFAULT_SETTINGS.colorLevel)
            });
        });

        it('returns red for opus models', () => {
            const context: RenderContext = {
                data: { model: 'Claude 3 Opus' }
            };
            const item: WidgetItem = { id: '1', type: 'model' };

            const result = widget.getDynamicColors?.(item, context, DEFAULT_SETTINGS);
            expect(result).toEqual({
                color: getTrafficLightColor('red', DEFAULT_SETTINGS.colorLevel)
            });
        });

        it('returns null for unknown models', () => {
            const context: RenderContext = {
                data: { model: 'CustomModel' }
            };
            const item: WidgetItem = { id: '1', type: 'model' };

            const result = widget.getDynamicColors?.(item, context, DEFAULT_SETTINGS);
            expect(result).toBeNull();
        });

        it('returns null when no model data', () => {
            const context: RenderContext = { data: {} };
            const item: WidgetItem = { id: '1', type: 'model' };

            const result = widget.getDynamicColors?.(item, context, DEFAULT_SETTINGS);
            expect(result).toBeNull();
        });

        it('matches model family case-insensitively', () => {
            const context: RenderContext = {
                data: { model: 'CLAUDE 3.5 SONNET' }
            };
            const item: WidgetItem = { id: '1', type: 'model' };

            const result = widget.getDynamicColors?.(item, context, DEFAULT_SETTINGS);
            expect(result).toEqual({
                color: getTrafficLightColor('orange', DEFAULT_SETTINGS.colorLevel)
            });
        });

        it('returns backgroundColor and color for powerline mode', () => {
            const context: RenderContext = {
                data: { model: 'Claude 3.5 Sonnet' }
            };
            const item: WidgetItem = { id: '1', type: 'model' };
            const settings = { ...DEFAULT_SETTINGS, powerline: { ...DEFAULT_SETTINGS.powerline, enabled: true } };

            const result = widget.getDynamicColors?.(item, context, settings);
            expect(result).toEqual({
                backgroundColor: getTrafficLightColor('orange', settings.colorLevel),
                color: 'black'
            });
        });

        it('handles model object in getDynamicColors', () => {
            const context: RenderContext = {
                data: { model: { display_name: 'Claude 3.5 Sonnet' } }
            };
            const item: WidgetItem = { id: '1', type: 'model' };

            const result = widget.getDynamicColors?.(item, context, DEFAULT_SETTINGS);
            expect(result).toEqual({
                color: getTrafficLightColor('orange', DEFAULT_SETTINGS.colorLevel)
            });
        });

        it('returns null for model object without identifiable data', () => {
            const context: RenderContext = {
                data: { model: {} }
            };
            const item: WidgetItem = { id: '1', type: 'model' };

            const result = widget.getDynamicColors?.(item, context, DEFAULT_SETTINGS);
            expect(result).toBeNull();
        });
    });
});
