import { describe, expect, it } from 'vitest';
import { displayName, listBackgrounds } from './backgrounds';

describe('backgrounds of assets/maps (spec 011, criterion 1)', () => {
  it('shows the file name without extension, with spaces instead of underscores', () => {
    expect(displayName('../../assets/maps/Pianeta_Nameck.jpg')).toBe('Pianeta Nameck');
    expect(displayName('../../assets/maps/Torneo__Tenkaichi.PNG')).toBe('Torneo Tenkaichi');
    expect(displayName('Kame_House.webp')).toBe('Kame House');
  });

  it('lists images only, in alphabetical order', () => {
    const backgrounds = listBackgrounds({
      '../../assets/maps/Pianeta_Nameck.jpg': '/assets/nameck.jpg',
      '../../assets/maps/LEGGIMI.md': '/assets/leggimi.md',
      '../../assets/maps/Città_dell_Ovest.png': '/assets/ovest.png',
      '../../assets/maps/Kame_House.webp': '/assets/kame.webp',
    });
    expect(backgrounds).toEqual([
      { name: 'Città dell Ovest', url: '/assets/ovest.png' },
      { name: 'Kame House', url: '/assets/kame.webp' },
      { name: 'Pianeta Nameck', url: '/assets/nameck.jpg' },
    ]);
  });
});
