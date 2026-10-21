import { personOf, personOfId, type Character } from '../engine';

// The forms of one person (D-048, D-064): "Son Gohan SSJ" and "Son Gohan
// SSJ2" are two characters of the list, but the same person. In a game a
// person stands in one place only (spec 039).

export { personOf };

/** The persons of these characters of the list; a code not in the list is a person alone. */
export function personsOf(ids: Iterable<string>, catalog: readonly Character[]): Set<string> {
  return new Set([...ids].map((id) => personOfId(catalog, id)));
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
