import { characterFace, characterImage } from './characterImages';
import styles from './Placeholder.module.css';

interface PlaceholderProps {
  name: string;
  /** With an image in assets/characters, the image takes the place of the name (D-024). */
  characterId?: string | null;
  /** The picture of a special shopkeeper (D-035): it comes before assets/characters. */
  imageData?: string;
  /** 'fill' takes the size of the surrounding box and shows the whole image. */
  size?: 'small' | 'fill';
  /** Tall frames show the whole figure; the others the face, when there is one (spec 051, D-081). */
  figure?: boolean;
}

/**
 * A character: its image when there is one, otherwise the stand-in with a
 * white background and the name in black (spec 002, spec 013).
 */
export function Placeholder({ name, characterId, imageData, size = 'small', figure = false }: PlaceholderProps) {
  const image = imageData ?? (figure ? characterImage(characterId) : characterFace(characterId));
  if (image) {
    return (
      <div className={`${styles.picture} ${styles[size] ?? ''}`} title={name}>
        <img src={image} alt={name} />
      </div>
    );
  }
  return (
    <div className={`${styles.placeholder} ${styles[size] ?? ''}`} title={name}>
      <span>{name}</span>
    </div>
  );
}
