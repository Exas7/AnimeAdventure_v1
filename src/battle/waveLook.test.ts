import { describe, expect, it } from 'vitest';
import { tierRank } from '../episode/fill';
import { auraOf, waveLook, waveShape } from './waveLook';

describe('the colour of the wave is the aura of who throws it (spec 062, criterion 1)', () => {
  it('follows the outline rules of spec 051', () => {
    const cases: [string, string][] = [
      ['Son Goku (inizio)', 'white'],
      ['Son Gohan (ragazzo) SSJ2', 'gold'],
      ['Super Vegeta', 'gold'],
      ['Majin Vegeta', 'gold'],
      ['Gogeta SSJ4', 'gold'],
      ['Super Gogeta', 'gold'],
      ['Super Baby 2', 'gold'],
      ['Freeza (forma finale)', 'purple'],
      ['Metal Cooler', 'purple'],
      ['Re Cold', 'purple'],
      ['Cell (forma perfetta)', 'green'],
      ['Cell Jr.', 'green'],
      ['Broli Super Saiyan Leggendario', 'green'],
      ['Bojack (massima potenza)', 'green'],
      ['Bojack', 'white'],
      ['Broli SSJ', 'aqua'],
      ['Broli', 'white'],
      ['Majin Buu (puro)', 'pink'],
      ['Super Buu (Son Gohan assorbito)', 'pink'],
      ['Super Uub', 'pink'],
      ['Son Goku SSJ4', 'red'],
      ['Vegeta SSJ4', 'red'],
      ['Super C-13', 'red'],
      ['C-13', 'white'],
      ['Dabura', 'dabura'],
      ['Super Janemba', 'white'],
    ];
    expect(cases.map(([name]) => [name, auraOf(name)])).toEqual(cases);
  });
});

describe('the shape of the wave comes from the name of the move (spec 062, criterion 2)', () => {
  it('energy balls, thin rays from a finger, and rays for the others', () => {
    for (const ball of [
      'Spirit Bomb',
      'Supernova',
      'Death Ball',
      'Big Bang Attack',
      'Planet Burst',
      'S.S. Deadly Bomber',
      'Minus Energy Power Ball',
      'Omega Blaster',
      'Giga Meteor Storm',
    ]) {
      expect([ball, waveShape(ball)]).toEqual([ball, 'ball']);
    }
    for (const thin of ['Death Beam', 'Full Power Death Beam', 'Special Beam Cannon', 'Dodon Ray', 'Finger Beam']) {
      expect([thin, waveShape(thin)]).toEqual([thin, 'thin']);
    }
    for (const beam of ['Kamehameha', 'Final Flash', 'Galick Gun', 'Big Bang Kamehameha', 'Energy Ballet']) {
      expect([beam, waveShape(beam)]).toEqual([beam, 'beam']);
    }
  });
});

describe('size and lightning follow the strength (spec 062, criterion 3)', () => {
  const rank = (tier: string) => tierRank(tier) as number;

  it('a higher tier throws a bigger wave; the 100x Big Bang Kamehameha is the biggest', () => {
    const weak = waveLook({ name: 'Yamcha', rank: rank('C') }, 'Kamehameha');
    const strong = waveLook({ name: 'Son Goku (fine) SSJ3', rank: rank('S+') }, 'Kamehameha');
    const gogeta = waveLook({ name: 'Gogeta SSJ4', rank: rank('SS+') }, '100x Big Bang Kamehameha');
    expect(weak.size).toBeLessThan(strong.size);
    expect(strong.size).toBeLessThan(gogeta.size);
    expect(gogeta.size).toBe(2.2);
  });

  it('lightning from tier A+ up', () => {
    expect(waveLook({ name: 'Super Vegeta', rank: rank('A+') }, 'Final Flash').lightning).toBe(true);
    expect(waveLook({ name: 'Vegeta SSJ', rank: rank('A') }, 'Big Bang Attack').lightning).toBe(false);
  });
});
