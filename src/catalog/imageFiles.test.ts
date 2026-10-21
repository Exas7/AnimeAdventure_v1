import { describe, expect, it } from 'vitest';
import { characterIdOf } from './importCatalog';
import { imagesById } from './imageFiles';

describe('character images (spec 013, criterion 1)', () => {
  it('finds the character from the file name, whatever the case, accents, spaces or underscores', () => {
    const images = imagesById({
      '../../assets/characters/Son_Goku_(inizio).png': '/a.png',
      '../../assets/characters/son goku (meta).JPG': '/b.jpg',
      '../../assets/characters/FREEZA_(forma_finale).webp': '/c.webp',
      '../../assets/characters/LEGGIMI.md': '/d.md',
    });
    expect(images[characterIdOf('Son Goku (inizio)')]).toBe('/a.png');
    expect(images[characterIdOf('Son Goku (metà)')]).toBe('/b.jpg');
    expect(images[characterIdOf('Freeza (forma finale)')]).toBe('/c.webp');
    expect(Object.keys(images)).toHaveLength(3);
  });
});
