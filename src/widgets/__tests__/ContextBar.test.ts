import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi
} from 'vitest';

import type { RenderContext } from '../../types';
import { DEFAULT_SETTINGS } from '../../types/Settings';
import * as usage from '../../utils/usage';
import { ContextBarWidget } from '../ContextBar';

describe('ContextBarWidget', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(usage, 'makeUsageProgressBar').mockImplementation((percent: number, width = 15) => `[bar:${percent.toFixed(1)}:${width}]`);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders from context_window data when available', () => {
        const context: RenderContext = {
            data: {
                context_window: {
                    context_window_size: 200000,
                    current_usage: {
                        input_tokens: 20000,
                        output_tokens: 10000,
                        cache_creation_input_tokens: 5000,
                        cache_read_input_tokens: 5000
                    }
                }
            }
        };
        const widget = new ContextBarWidget();

        expect(widget.render({ id: 'ctx', type: 'context-bar' }, context, DEFAULT_SETTINGS)).toBe('Ctxt: [bar:15.0:16] 30k/200k (15%)');
    });

    it('falls back to token metrics and model context size', () => {
        const context: RenderContext = {
            data: { model: { id: 'claude-3-5-sonnet-20241022' } },
            tokenMetrics: {
                inputTokens: 0,
                outputTokens: 0,
                cachedTokens: 0,
                totalTokens: 0,
                contextLength: 50000
            }
        };
        const widget = new ContextBarWidget();

        expect(widget.render({ id: 'ctx', type: 'context-bar' }, context, DEFAULT_SETTINGS)).toBe('Ctxt: [bar:25.0:16] 50k/200k (25%)');
    });

    it('uses 1M context label model IDs in fallback mode', () => {
        const context: RenderContext = {
            data: { model: { id: 'Opus 4.6 (1M context)' } },
            tokenMetrics: {
                inputTokens: 0,
                outputTokens: 0,
                cachedTokens: 0,
                totalTokens: 0,
                contextLength: 50000
            }
        };
        const widget = new ContextBarWidget();

        expect(widget.render({ id: 'ctx', type: 'context-bar' }, context, DEFAULT_SETTINGS)).toBe('Ctxt: [bar:5.0:16] 50k/1000k (5%)');
    });

    it('uses 1M in parentheses model IDs in fallback mode', () => {
        const context: RenderContext = {
            data: { model: { id: 'Opus 4.6 (1M)' } },
            tokenMetrics: {
                inputTokens: 0,
                outputTokens: 0,
                cachedTokens: 0,
                totalTokens: 0,
                contextLength: 50000
            }
        };
        const widget = new ContextBarWidget();

        expect(widget.render({ id: 'ctx', type: 'context-bar' }, context, DEFAULT_SETTINGS)).toBe('Ctxt: [bar:5.0:16] 50k/1000k (5%)');
    });

    it('clamps usage percentage to 100 when context length exceeds total', () => {
        const context: RenderContext = {
            data: {
                context_window: {
                    context_window_size: 200000,
                    current_usage: {
                        input_tokens: 250000,
                        output_tokens: 50000,
                        cache_creation_input_tokens: 0,
                        cache_read_input_tokens: 0
                    }
                }
            }
        };
        const widget = new ContextBarWidget();

        expect(widget.render({ id: 'ctx', type: 'context-bar' }, context, DEFAULT_SETTINGS)).toBe('Ctxt: [bar:100.0:16] 250k/200k (100%)');
    });

    it('supports raw mode without context label', () => {
        const context: RenderContext = {
            data: {
                context_window: {
                    context_window_size: 200000,
                    current_usage: {
                        input_tokens: 5000,
                        output_tokens: 5000,
                        cache_creation_input_tokens: 0,
                        cache_read_input_tokens: 0
                    }
                }
            }
        };
        const widget = new ContextBarWidget();

        expect(widget.render({ id: 'ctx', type: 'context-bar', rawValue: true }, context, DEFAULT_SETTINGS)).toBe('[bar:2.5:16] 5k/200k (3%)');
    });

    it('renders long progress bar mode when configured', () => {
        const context: RenderContext = {
            data: {
                context_window: {
                    context_window_size: 200000,
                    current_usage: {
                        input_tokens: 20000,
                        output_tokens: 10000,
                        cache_creation_input_tokens: 5000,
                        cache_read_input_tokens: 5000
                    }
                }
            }
        };
        const widget = new ContextBarWidget();

        expect(widget.render({
            id: 'ctx',
            type: 'context-bar',
            metadata: { display: 'progress' }
        }, context, DEFAULT_SETTINGS)).toBe('Ctxt: [bar:15.0:32] 30k/200k (15%)');
    });

    it('toggles progress mode between short and long', () => {
        const widget = new ContextBarWidget();
        const toLong = widget.handleEditorAction('toggle-progress', { id: 'ctx', type: 'context-bar' });
        const toShort = widget.handleEditorAction('toggle-progress', {
            id: 'ctx',
            type: 'context-bar',
            metadata: { display: 'progress' }
        });

        expect(toLong?.metadata?.display).toBe('progress');
        expect(toShort?.metadata?.display).toBe('progress-short');
    });

    describe('getDynamicColors', () => {
        function makeContext(used: number, total: number): RenderContext {
            return {
                data: {
                    context_window: {
                        context_window_size: total,
                        current_usage: {
                            input_tokens: used,
                            output_tokens: 0,
                            cache_creation_input_tokens: 0,
                            cache_read_input_tokens: 0
                        }
                    }
                }
            };
        }

        it('returns null below 50%', () => {
            const widget = new ContextBarWidget();
            expect(widget.getDynamicColors({ id: 'ctx', type: 'context-bar' }, makeContext(49000, 100000), DEFAULT_SETTINGS)).toBeNull();
        });

        it('returns orange at 50%', () => {
            const widget = new ContextBarWidget();
            const result = widget.getDynamicColors({ id: 'ctx', type: 'context-bar' }, makeContext(50000, 100000), DEFAULT_SETTINGS);
            expect(result).not.toBeNull();
            expect(result?.color).toContain('214');
            expect(result?.backgroundColor).toBeUndefined();
        });

        it('returns red fg only between 60–69%', () => {
            const widget = new ContextBarWidget();
            const result = widget.getDynamicColors({ id: 'ctx', type: 'context-bar' }, makeContext(65000, 100000), DEFAULT_SETTINGS);
            expect(result).not.toBeNull();
            expect(result?.color).toContain('196');
            expect(result?.backgroundColor).toBeUndefined();
        });

        it('returns red bg with white text at 70%+', () => {
            const widget = new ContextBarWidget();
            const result = widget.getDynamicColors({ id: 'ctx', type: 'context-bar' }, makeContext(70000, 100000), DEFAULT_SETTINGS);
            expect(result).not.toBeNull();
            expect(result?.backgroundColor).toContain('196');
            expect(result?.color).toBe('white');
        });

        it('returns null in preview mode', () => {
            const widget = new ContextBarWidget();
            const result = widget.getDynamicColors(
                { id: 'ctx', type: 'context-bar' },
                { ...makeContext(80000, 100000), isPreview: true },
                DEFAULT_SETTINGS
            );
            expect(result).toBeNull();
        });
    });
});