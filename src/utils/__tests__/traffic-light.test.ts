import { describe, it, expect } from 'vitest';
import { getTrafficLightColor, TRAFFIC_LIGHT_COLOURS } from '../traffic-light';

describe('traffic-light utility', () => {
    it('exports all five traffic-light stops', () => {
        expect(TRAFFIC_LIGHT_COLOURS).toHaveProperty('green');
        expect(TRAFFIC_LIGHT_COLOURS).toHaveProperty('yellow');
        expect(TRAFFIC_LIGHT_COLOURS).toHaveProperty('orange');
        expect(TRAFFIC_LIGHT_COLOURS).toHaveProperty('red');
        expect(TRAFFIC_LIGHT_COLOURS).toHaveProperty('purple');
    });

    it('resolves green', () => {
        expect(getTrafficLightColor('green', 2)).toBe('ansi256:34');
        expect(getTrafficLightColor('green', 3)).toBe('hex:00AF00');
    });

    it('resolves yellow', () => {
        expect(getTrafficLightColor('yellow', 2)).toBe('ansi256:220');
        expect(getTrafficLightColor('yellow', 3)).toBe('hex:FFD700');
    });

    it('resolves orange', () => {
        expect(getTrafficLightColor('orange', 2)).toBe('ansi256:214');
        expect(getTrafficLightColor('orange', 3)).toBe('hex:FFAF00');
    });

    it('resolves red', () => {
        expect(getTrafficLightColor('red', 2)).toBe('ansi256:196');
        expect(getTrafficLightColor('red', 3)).toBe('hex:FF0000');
    });

    it('resolves purple', () => {
        expect(getTrafficLightColor('purple', 2)).toBe('ansi256:93');
        expect(getTrafficLightColor('purple', 3)).toBe('hex:8700FF');
    });

    it('clamps colorLevel 1 to ansi256', () => {
        expect(getTrafficLightColor('green', 1)).toBe('ansi256:34');
        expect(getTrafficLightColor('orange', 1)).toBe('ansi256:214');
        expect(getTrafficLightColor('purple', 1)).toBe('ansi256:93');
    });
});
