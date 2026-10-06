import {
    describe,
    expect,
    it
} from 'vitest';

import {
    getModelMultiplier,
    getMultiplierTrafficLight
} from '../model-multipliers';

describe('model multipliers', () => {
    const duringPromotions = new Date('2026-10-06T12:00:00Z');

    it.each([
        ['claude-fable-5.1', 4],
        ['claude-opus-5-5', 1.6],
        ['claude-opus-5-5-fast', 3.2],
        ['claude-opus-5', 2],
        ['claude-opus-4-5-20251101', 2],
        ['claude-sonnet-5', 0.8],
        ['claude-sonnet-4-6', 1.2],
        ['claude-haiku-4-5-20251001', 0.4],
        ['gpt-6.1-sol', 0.8],
        ['gpt-6-astra', 4],
        ['gpt-6-luna', 0.04],
        ['gpt-5.6-sol', 1.6],
        ['gpt-5.6-sol-fast', 3.2],
        ['gpt-5.5-pro', 12],
        ['gpt-5.4', 1],
        ['gpt-5.4-fast', 2],
        ['gpt-5.4-mini-fast', 0.6],
        ['gpt-5.3-codex-fast', 1.4],
        ['gemini-3.1-pro-preview', 0.8],
        ['gemini-3.8-flash', 0.3],
        ['gemini-3.7-flash', 0.3],
        ['grok-4.7', 0.8],
        ['inkling', 0.4],
        ['glm-5.2-fast', 0.84],
        ['kimi-k3', 1.2],
        ['qwen3.8-max', 0.8],
        ['nemotron-3-ultra', 0.24],
        ['deepseek-v4.1-flash', 0.12],
        ['deepseek-v4-flash-0731', 0.176],
        ['deepseek-v4-pro', 0.528],
        ['minimax-m3', 0.12],
        ['kimi-k2.5', 0.25]
    ])('looks up the published multiplier for %s', (id, multiplier) => {
        expect(getModelMultiplier(id, duringPromotions)).toBe(multiplier);
    });

    it('normalizes case and a trailing context suffix', () => {
        expect(getModelMultiplier(' CLAUDE-SONNET-5[1m] ', duringPromotions)).toBe(0.8);
    });

    it.each(['', 'auto', 'custom-sol', 'gpt-6.1-sol-fast', 'constructor', 'toString'])(
        'does not infer a price for unknown id "%s"',
        (id) => {
            expect(getModelMultiplier(id, duringPromotions)).toBeNull();
        }
    );

    it.each([
        ['gpt-5.6-sol', '2026-11-22T23:59:59.999Z', 1.6],
        ['gpt-5.6-sol', '2026-11-23T00:00:00Z', 2],
        ['gpt-5.6-sol-fast', '2026-11-22T23:59:59.999Z', 3.2],
        ['gpt-5.6-sol-fast', '2026-11-23T00:00:00Z', 4],
        ['gemini-3.8-flash', '2027-01-01T23:59:59.999Z', 0.3],
        ['gemini-3.8-flash', '2027-01-02T00:00:00Z', 0.6],
        ['gemini-3.7-flash', '2027-01-01T23:59:59.999Z', 0.3],
        ['gemini-3.7-flash', '2027-01-02T00:00:00Z', 0.6]
    ])('resolves %s on %s to %s', (id, timestamp, multiplier) => {
        expect(getModelMultiplier(id, new Date(timestamp))).toBe(multiplier);
    });

    it('switches Sol from amber to red when its promotional price ends', () => {
        const before = getModelMultiplier('gpt-5.6-sol', new Date('2026-11-22T23:59:59.999Z'));
        const after = getModelMultiplier('gpt-5.6-sol', new Date('2026-11-23T00:00:00Z'));

        expect(before === null ? null : getMultiplierTrafficLight(before)).toBe('orange');
        expect(after === null ? null : getMultiplierTrafficLight(after)).toBe('red');
    });
});

describe('multiplier traffic-light thresholds', () => {
    it.each([
        [0, 'green'],
        [0.99, 'green'],
        [1, 'orange'],
        [1.99, 'orange'],
        [2, 'red'],
        [12, 'red']
    ])('maps %s to %s', (multiplier, color) => {
        expect(getMultiplierTrafficLight(multiplier)).toBe(color);
    });
});
