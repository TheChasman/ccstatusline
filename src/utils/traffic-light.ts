import type { ColorLevel } from '../types/ColorLevel';

export const TRAFFIC_LIGHT_COLOURS = {
    green:  { ansi256: 'ansi256:34',  truecolor: 'hex:00AF00' },
    yellow: { ansi256: 'ansi256:220', truecolor: 'hex:FFD700' },
    orange: { ansi256: 'ansi256:214', truecolor: 'hex:FFAF00' },
    red:    { ansi256: 'ansi256:196', truecolor: 'hex:FF0000' },
    purple: { ansi256: 'ansi256:93',  truecolor: 'hex:8700FF' }
} as const;

export type TrafficLightColor = keyof typeof TRAFFIC_LIGHT_COLOURS;

/**
 * Resolve a traffic-light colour to the appropriate ANSI code based on colour depth.
 * Operates at ansi256 minimum — colorLevel 1 is treated as 2.
 */
export function getTrafficLightColor(level: TrafficLightColor, colorLevel: ColorLevel): string {
    const effectiveLevel = colorLevel < 2 ? 2 : colorLevel;
    if (effectiveLevel === 2) {
        return TRAFFIC_LIGHT_COLOURS[level].ansi256;
    }
    return TRAFFIC_LIGHT_COLOURS[level].truecolor;
}