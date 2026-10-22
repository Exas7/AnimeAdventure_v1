import { describe, expect, it } from 'vitest';
import { characterIdOf } from './importCatalog';
import { faceOrFigure, imageNamed, imagesById } from './imageFiles';

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

describe('character faces (spec 051, criterion 1)', () => {
  const figures = imagesById({
    '../../assets/characters/Son_Goku_(fine).webp': '/figure-goku.webp',
    '../../assets/characters/Freeza_(forma_finale).webp': '/figure-freeza.webp',
  });
  const faces = imagesById({
    '../../assets/characters/volti/son goku (fine).WEBP': '/face-goku.webp',
    '../../assets/characters/volti/Cell_(prima_forma).png': '/face-cell.png',
  });

  it('finds the face from the file name, like the figure', () => {
    expect(faceOrFigure(faces, figures, characterIdOf('Son Goku (fine)'))).toBe('/face-goku.webp');
    expect(faceOrFigure(faces, figures, characterIdOf('Cell (prima forma)'))).toBe('/face-cell.png');
  });

  it('uses the whole figure when the character has no face', () => {
    expect(faceOrFigure(faces, figures, characterIdOf('Freeza (forma finale)'))).toBe('/figure-freeza.webp');
  });

  it('gives nothing when the character has no picture at all', () => {
    expect(faceOrFigure(faces, figures, characterIdOf('Mr. Satan'))).toBeUndefined();
  });
});

describe('item images (spec 045, criterion 1)', () => {
  it('finds the item from the file name, whatever the case, accents, spaces, dots or underscores', () => {
    const images = imagesById({
      '../../assets/items/Camera_Gravitazionale_del_Dr._Brief.png': '/a.png',
      '../../assets/items/nuvola speedy.WEBP': '/b.webp',
      '../../assets/items/LEGGIMI.md': '/c.md',
    });
    expect(imageNamed(images, 'Camera Gravitazionale del Dr. Brief')).toBe('/a.png');
    expect(imageNamed(images, 'Nuvola Speedy')).toBe('/b.webp');
    expect(imageNamed(images, 'Senzu')).toBeUndefined();
  });
});
