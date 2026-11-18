import { describe, expect, it } from 'vitest';
import { activityZoneAt, ActivityZoneAlertGate, buildActivityZones, containsPoint, type BeatFeature } from './historicalZones';

const square = (west: number, south: number, d = .01): BeatFeature['geometry'] => ({
  type: 'Polygon', coordinates: [[[west, south], [west + d, south], [west + d, south + d],
    [west, south + d], [west, south]]],
});
const beat = (id: string, count: number, i: number): BeatFeature => ({
  bbox: [i * .02, 0, i * .02 + .01, .01], geometry: square(i * .02, 0),
  properties: { id, label: id, place: 'Test city', b: [1960, count] }, // 2025, year base 1990
});

describe('historical stop activity zones', () => {
  it('ranks actual same-year stop densities within one city', () => {
    const zones = buildActivityZones([beat('a', 10, 0), beat('b', 20, 1), beat('c', 30, 2), beat('d', 40, 3)], 1990);
    expect(zones.map(z => z.level)).toEqual(['low', 'typical', 'high', 'very-high']);
    expect(zones[3]).toMatchObject({ count: 40, year: 2025, comparable: 4 });
    expect(activityZoneAt(zones, .005, .065)?.id).toBe('d');
    expect(activityZoneAt(zones, 8, 8)).toBeNull();
  });
  it('will not classify one citywide total or absent 2025 data as a hotspot', () => {
    expect(buildActivityZones([beat('citywide', 25000, 0)], 1990)[0].level).toBe('insufficient');
    const historical = beat('old', 400, 0);
    historical.properties.b = [1904, 400]; // another year
    expect(buildActivityZones([historical, beat('b', 1, 1), beat('c', 3, 2), beat('d', 5, 3)], 1990)[0].level).toBe('insufficient');
  });
  it('handles multipolygons and holes without classifying adjacent streets', () => {
    const geometry = { type: 'MultiPolygon', coordinates: [
      [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]], [[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]]],
      [[[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]]],
    ] };
    expect(containsPoint(geometry, .5, .5)).toBe(true);
    expect(containsPoint(geometry, 2, 2)).toBe(false);
    expect(containsPoint(geometry, 5.5, 5.5)).toBe(true);
    expect(containsPoint(geometry, 7, 7)).toBe(false);
  });
  it('suppresses repeated alerts, non-high levels and rapid transitions', () => {
    const zones = buildActivityZones([beat('a', 10, 0), beat('b', 20, 1), beat('c', 30, 2), beat('d', 40, 3)], 1990);
    const gate = new ActivityZoneAlertGate();
    expect(gate.enter(zones[2], true, false, 100000)).toBe(false); // high not opted in
    expect(gate.enter(zones[3], true, false, 110000)).toBe(true);
    expect(gate.enter(zones[3], true, false, 111000)).toBe(false);
    expect(gate.enter(null, true, false, 120000)).toBe(false);
    expect(gate.enter(zones[3], true, false, 210000)).toBe(false); // same area cooldown
    expect(gate.enter(null, true, false, 220000)).toBe(false);
    expect(gate.enter(zones[3], true, false, 1410000)).toBe(true);
  });
});
