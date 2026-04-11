import type { ColorLevel } from '../types/ColorLevel';

export const TRAFFIC_LIGHT_COLOURS = {
  green: {
    ansi16: 'green',
    ansi256: 'ansi256:34',
    truecolor: 'hex:00AF00',
  },
  amber: {
    ansi16: 'yellow',
    ansi256: 'ansi256:214',
    truecolor: 'hex:FFAF00',
  },
  red: {
    ansi16: 'red',
    ansi256: 'ansi256:196',
    truecolor: 'hex:FF0000',
  },
} as const;

export type TrafficLightColor = keyof typeof TRAFFIC_LIGHT_COLOURS;

/**
 * Resolve a traffic-light colour to the appropriate ANSI code based on colour depth.
 * @param level - 'green', 'amber', or 'red'
 * @param colorLevel - Colour depth: 1=ansi16, 2=ansi256, 3=truecolor
 */
export function getTrafficLightColor(level: TrafficLightColor, colorLevel: ColorLevel): string {
  if (colorLevel === 1) {
    return TRAFFIC_LIGHT_COLOURS[level].ansi16;
  }
  if (colorLevel === 2) {
    return TRAFFIC_LIGHT_COLOURS[level].ansi256;
  }
  // colorLevel === 3 (truecolor)
  return TRAFFIC_LIGHT_COLOURS[level].truecolor;
}
