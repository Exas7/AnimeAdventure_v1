import { imageNamed, imagesById } from '../catalog/imageFiles';

// The images of assets/items, read when the app is prepared (D-021), named
// like the item (spec 045). Git does not keep them (D-072): a copy of the
// game without them shows the items by name, as before.
const files = import.meta.glob<string>(
  '../../assets/items/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}',
  { eager: true, query: '?url', import: 'default' },
);

const IMAGES = imagesById(files);

/** The image of an item, by its name, or undefined: then the name is shown. */
export function itemImage(itemName: string | undefined): string | undefined {
  return itemName ? imageNamed(IMAGES, itemName) : undefined;
}
