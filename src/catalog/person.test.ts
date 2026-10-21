import { describe, expect, it } from 'vitest';
import type { Character } from '../engine';
import { onePerPerson, personOf, samePerson } from './person';

const gohan: Character = { id: 'son-gohan-ssj', name: 'Son Gohan SSJ', person: 'Son Gohan' };
const gohan2: Character = { id: 'son-gohan-ssj2', name: 'Son Gohan SSJ2', person: 'Son Gohan' };
const grandpa: Character = { id: 'son-gohan-nonno', name: 'Son Gohan (nonno)' };
const krilin: Character = { id: 'krilin', name: 'Krilin', person: ' ' };

describe('the forms of one person (D-048)', () => {
  it('the same "persona" is the same person; without one, each character is alone', () => {
    expect(samePerson(gohan, gohan2)).toBe(true);
    expect(samePerson(gohan, grandpa)).toBe(false);
    expect(samePerson(krilin, { id: 'yamcha', name: 'Yamcha' })).toBe(false);
    expect(samePerson(krilin, krilin)).toBe(true);
    expect(samePerson(gohan, undefined)).toBe(false);
    expect(personOf(krilin)).toBe('#krilin');
  });

  it('one form per person, in order, leaving out the persons already taken', () => {
    expect(onePerPerson([gohan, krilin, gohan2, grandpa]).map((character) => character.id)).toEqual([
      'son-gohan-ssj',
      'krilin',
      'son-gohan-nonno',
    ]);
    expect(onePerPerson([gohan2, grandpa], new Set(['Son Gohan'])).map((character) => character.id)).toEqual([
      'son-gohan-nonno',
    ]);
  });
});
