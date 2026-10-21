import { layoutImage } from './layoutFiles';

// The images of assets/layout, read when the app is prepared (D-021): an
// image added later appears at the next start with the launcher.
const files = import.meta.glob<string>(
  '../../assets/layout/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}',
  { eager: true, query: '?url', import: 'default' },
);

/** Background of the director's start page (spec 024), if the channel provided one. */
export const START_PAGE_BACKGROUND = layoutImage(files, 'pagina-iniziale');

/** Background of the starter choice scene (spec 025, 2.4), if the channel provided one. */
export const STARTER_CHOICE_BACKGROUND = layoutImage(files, 'scelta-starter');
