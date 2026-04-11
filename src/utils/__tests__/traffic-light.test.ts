import { describe, it, expect } from 'vitest';
import { getTrafficLightColor, TRAFFIC_LIGHT_COLOURS } from '../traffic-light';

describe('traffic-light utility', () => {
  it('exports traffic light colours', () => {
    expect(TRAFFIC_LIGHT_COLOURS).toHaveProperty('green');
    expect(TRAFFIC_LIGHT_COLOURS).toHaveProperty('amber');
    expect(TRAFFIC_LIGHT_COLOURS).toHaveProperty('red');
  });

  it('resolves green at each colour level', () => {
    expect(getTrafficLightColor('green', 1)).toBe('green');
    expect(getTrafficLightColor('green', 2)).toBe('ansi256:34');
    expect(getTrafficLightColor('green', 3)).toBe('hex:00AF00');
  });

  it('resolves amber at each colour level', () => {
    expect(getTrafficLightColor('amber', 1)).toBe('yellow');
    expect(getTrafficLightColor('amber', 2)).toBe('ansi256:214');
    expect(getTrafficLightColor('amber', 3)).toBe('hex:FFAF00');
  });

  it('resolves red at each colour level', () => {
    expect(getTrafficLightColor('red', 1)).toBe('red');
    expect(getTrafficLightColor('red', 2)).toBe('ansi256:196');
    expect(getTrafficLightColor('red', 3)).toBe('hex:FF0000');
  });
});
