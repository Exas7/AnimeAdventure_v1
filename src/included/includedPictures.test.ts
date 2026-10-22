import { describe, expect, it } from 'vitest';
import { imagesById } from '../catalog/imageFiles';
import { includedCatalog } from './includedLists';

// The pictures of the project, read as the app reads them (src/ui/characterImages.ts).
const figures = imagesById(
  import.meta.glob<string>('../../assets/characters/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
);
const faces = imagesById(
  import.meta.glob<string>('../../assets/characters/volti/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
);

describe('the pictures of the included characters (spec 051, criterion 2)', () => {
  it('every character of the list has its whole figure and its face', () => {
    const catalog = includedCatalog();
    expect(catalog.filter((character) => !figures[character.id]).map((character) => character.name)).toEqual([]);
    expect(catalog.filter((character) => !faces[character.id]).map((character) => character.name)).toEqual([]);
  });
});
