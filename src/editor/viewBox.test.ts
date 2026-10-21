import { describe, expect, it } from 'vitest';
import { panBy, zoomAt, type ViewBox } from './viewBox';

const size = { width: 1600, height: 900 };
const whole: ViewBox = { x: 0, y: 0, w: 1600, h: 900 };

describe('view of the map (spec 006, 2.5; spec 007, 2.2)', () => {
  it('zooming keeps the point under the mouse in the same place', () => {
    const anchor = { x: 400, y: 300 };
    const zoomed = zoomAt(whole, anchor, true, size);
    expect(zoomed.w).toBeLessThan(whole.w);
    // Same relative position inside the view before and after.
    expect((anchor.x - zoomed.x) / zoomed.w).toBeCloseTo((anchor.x - whole.x) / whole.w);
    expect((anchor.y - zoomed.y) / zoomed.h).toBeCloseTo((anchor.y - whole.y) / whole.h);
  });

  it('zoom stays between 1/20 and 3 times the board width, keeping proportions', () => {
    let view = whole;
    for (let i = 0; i < 100; i++) {
      view = zoomAt(view, { x: 800, y: 450 }, true, size);
    }
    expect(view.w).toBeCloseTo(80);
    expect(view.w / view.h).toBeCloseTo(1600 / 900);
    for (let i = 0; i < 200; i++) {
      view = zoomAt(view, { x: 800, y: 450 }, false, size);
    }
    expect(view.w).toBeCloseTo(4800);
  });

  it('dragging moves the view against the mouse, at the current zoom', () => {
    expect(panBy(whole, 100, -50, 800)).toEqual({ x: -200, y: 100, w: 1600, h: 900 });
  });
});
