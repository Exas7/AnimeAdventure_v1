import { describe, expect, it } from 'vitest';
import { layoutImage } from './layoutFiles';

describe('stream and director graphics of assets/layout (spec 024, criterion 1)', () => {
  it('finds the image by name, with any allowed extension and any case', () => {
    expect(layoutImage({ '../../assets/layout/pagina-iniziale.jpg': '/a.jpg' }, 'pagina-iniziale')).toBe(
      '/a.jpg',
    );
    expect(layoutImage({ '../../assets/layout/Pagina-Iniziale.WEBP': '/b.webp' }, 'pagina-iniziale')).toBe(
      '/b.webp',
    );
    expect(layoutImage({ '../../assets/layout/pagina-iniziale.png': '/c.png' }, 'pagina-iniziale')).toBe(
      '/c.png',
    );
  });

  it('finds nothing without that file, or with a file that is not an image', () => {
    expect(layoutImage({}, 'pagina-iniziale')).toBeUndefined();
    expect(
      layoutImage(
        {
          '../../assets/layout/LEGGIMI.md': '/d.md',
          '../../assets/layout/pagina-iniziale.gif': '/e.gif',
          '../../assets/layout/pagina-iniziale-vecchia.jpg': '/f.jpg',
        },
        'pagina-iniziale',
      ),
    ).toBeUndefined();
  });

  it('with two files of the same name, always picks the same one', () => {
    const files = {
      '../../assets/layout/pagina-iniziale.png': '/g.png',
      '../../assets/layout/pagina-iniziale.jpg': '/h.jpg',
    };
    expect(layoutImage(files, 'pagina-iniziale')).toBe('/h.jpg');
  });
});
