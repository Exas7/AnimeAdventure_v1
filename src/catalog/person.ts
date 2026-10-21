import type { Character } from '../engine';

// The forms of one person (D-048): "Son Gohan SSJ" and "Son Gohan SSJ2" are
// two characters of the list, but the same person.

/** The person of a character: the "persona" column, or the character alone. */
export function personOf(character: Character): string {
  return character.person?.trim() || `#${character.id}`;
}

export function samePerson(a: Character | undefined, b: Character | undefined): boolean {
  return a !== undefined && b !== undefined && personOf(a) === personOf(b);
}

/** The characters in order, without a second form of a person already met or in `taken`. */
export function onePerPerson(characters: Character[], taken: ReadonlySet<string> = new Set()): Character[] {
  const seen = new Set(taken);
  return characters.filter((character) => {
    const person = personOf(character);
    if (seen.has(person)) {
      return false;
    }
    seen.add(person);
    return true;
  });
}
