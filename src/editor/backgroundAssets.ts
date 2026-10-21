import { listBackgrounds } from './backgrounds';

// The images of assets/maps, read when the app is prepared (D-021): an image
// added later appears at the next start with the double-click launcher.
const files = import.meta.glob<string>(
  '../../assets/maps/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}',
  { eager: true, query: '?url', import: 'default' },
);

export const BACKGROUNDS = listBackgrounds(files);
