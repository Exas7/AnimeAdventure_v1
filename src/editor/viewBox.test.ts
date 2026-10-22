import { describe, expect, it } from 'vitest';
import { panBy, pinchView, zoomAt, zoomCentered, type ViewBox } from './viewBox';

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

describe('two fingers and the zoom buttons (spec 054, criteria 1-2)', () => {
  it('fingers spreading to twice their distance halve the width around the point between them', () => {
    const view = pinchView(
      whole,
      [{ x: 700, y: 450 }, { x: 900, y: 450 }],
      [{ x: 600, y: 450 }, { x: 1000, y: 450 }],
      size,
    );
    expect(view.w).toBeCloseTo(800);
    expect(view.h).toBeCloseTo(450);
    // The point between the fingers (800, 450) stays in the middle.
    expect(view.x + view.w / 2).toBeCloseTo(800);
    expect(view.y + view.h / 2).toBeCloseTo(450);
  });

  it('fingers moving together move the view by the same distance', () => {
    const view = pinchView(
      whole,
      [{ x: 700, y: 450 }, { x: 900, y: 450 }],
      [{ x: 800, y: 500 }, { x: 1000, y: 500 }],
      size,
    );
    expect(view).toEqual({ x: -100, y: -50, w: 1600, h: 900 });
  });

  it('the zoom of the fingers and of the buttons stays within the limits of the wheel', () => {
    const tiny = pinchView(whole, [{ x: 0, y: 0 }, { x: 1600, y: 0 }], [{ x: 0, y: 0 }, { x: 1, y: 0 }], size);
    expect(tiny.w).toBe(1600 * 3);
    let view = whole;
    for (let i = 0; i < 100; i++) {
      view = zoomCentered(view, true, size);
    }
    expect(view.w).toBeCloseTo(1600 / 20);
    expect(view.x + view.w / 2).toBeCloseTo(800);
  });
});
