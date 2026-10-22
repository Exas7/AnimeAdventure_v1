import { placedWhere } from './cells';
import { EngineError } from './errors';
import { findCharacter, findItem } from './lookup';
import { notify, type ActionOutput } from './output';
import { replaceInTeam } from './team';
import { testItems } from './testMap';
import type {
  Character,
  GameContext,
  GameState,
  ItemDefinition,
  PlayerId,
  TrainingChoice,
  TrainingRule,
  Warning,
} from './types';

// "Usa" on the training items (spec 041, D-067): the host chooses who goes up
// and by how many forms, the app follows "si trasforma in" (D-059).

/**
 * The rule of a training item; undefined for the other items. Games saved
 * before spec 041 keep their own copy of the items, without the rule: the
 * items of the game give it to them.
 */
export function trainingRule(item: ItemDefinition): TrainingRule | undefined {
  return item.training ?? testItems.find((known) => known.id === item.id)?.training;
}

/** The rule in words, as in spec 002: "1 personaggio sale di 2 forme, oppure 2 personaggi salgono di 1". */
export function trainingRuleText(rule: TrainingRule): string {
  const forms = (count: number) => `${count} ${count === 1 ? 'forma' : 'forme'}`;
  const each = Math.min(rule.formsEach, rule.formsTotal);
  if (rule.characters === 1) {
    return `1 personaggio sale di ${forms(each)}`;
  }
  if (rule.formsTotal >= rule.characters * rule.formsEach) {
    return `${rule.characters} personaggi salgono di ${forms(rule.formsEach)}`;
  }
  if (rule.formsTotal === rule.formsEach && rule.formsTotal === rule.characters) {
    return `1 personaggio sale di ${forms(each)}, oppure ${rule.characters} personaggi salgono di 1`;
  }
  return `fino a ${rule.characters} personaggi, ${forms(rule.formsTotal)} in tutto, al massimo ${each} ciascuno`;
}

/** The next forms along "si trasforma in", at most `max`: Son Goku (fine) → SSJ, SSJ2. */
export function nextForms(catalog: readonly Character[], characterId: string, max: number): string[] {
  const forms: string[] = [];
  let next = catalog.find((character) => character.id === characterId)?.fight?.transformsInto;
  while (next !== undefined && forms.length < max && next !== characterId && !forms.includes(next)) {
    forms.push(next);
    const id = next;
    next = catalog.find((character) => character.id === id)?.fight?.transformsInto;
  }
  return forms;
}

/** Old form → new form for each chosen character; a choice of 0 forms is no choice. */
export function trainingChanges(
  catalog: readonly Character[],
  choices: readonly TrainingChoice[],
): { from: string; to: string }[] {
  return choices
    .filter((choice) => choice.forms > 0)
    .map(({ characterId, forms }) => {
      const to = nextForms(catalog, characterId, forms)[forms - 1];
      if (to === undefined) {
        throw new EngineError(`Character "${characterId}" cannot go up ${forms} forms`);
      }
      return { from: characterId, to };
    });
}

/** "Son Goku (metà) → Son Goku (metà) SSJ, Krilin → ...", for the log and the notification. */
export function trainingChangesText(
  catalog: readonly Character[],
  changes: readonly { from: string; to: string }[],
): string {
  const name = (id: string) => catalog.find((character) => character.id === id)?.name ?? id;
  return changes.map(({ from, to }) => `${name(from)} → ${name(to)}`).join(', ');
}

/**
 * The guides of the window and of the action (D-008): past the rule of the
 * item, or a new form already in a cell, a shop or a team (spec 039, D-064).
 */
export function trainingWarnings(
  state: GameState,
  context: GameContext,
  itemId: string,
  choices: readonly TrainingChoice[],
): Warning[] {
  const item = findItem(context.items, itemId);
  const rule = trainingRule(item);
  const chosen = choices.filter((choice) => choice.forms > 0);
  const warnings: Warning[] = [];
  const total = chosen.reduce((sum, choice) => sum + choice.forms, 0);
  if (
    rule &&
    (chosen.length > rule.characters ||
      chosen.some((choice) => choice.forms > rule.formsEach) ||
      total > rule.formsTotal)
  ) {
    warnings.push({ kind: 'trainingRule', message: `${item.name}: ${trainingRuleText(rule)}` });
  }
  for (const { to } of trainingChanges(context.catalog, chosen)) {
    const found = placedWhere(state, context, (id) => id === to);
    if (found) {
      warnings.push({
        kind: 'characterAlreadyPlaced',
        message: `${findCharacter(context.catalog, to).name} è già ${found.where}`,
      });
    }
  }
  return warnings;
}

/**
 * "Conferma" in the window of a training item: each chosen character takes
 * its new form in the same place of the team, the starter follows it, the
 * item leaves the inventory. No actions spent, as when buying (spec 002, 4).
 */
export function useTraining(
  state: GameState,
  context: GameContext,
  playerId: PlayerId,
  itemId: string,
  choices: readonly TrainingChoice[],
  out: ActionOutput,
): void {
  const player = state.players[playerId];
  const item = findItem(context.items, itemId);
  if (!trainingRule(item)) {
    throw new EngineError(`Item "${itemId}" is not a training item`);
  }
  const index = player.inventory.indexOf(item.id);
  if (index === -1) {
    throw new EngineError(`Item "${itemId}" is not in the inventory`);
  }
  const changes = trainingChanges(context.catalog, choices);
  if (changes.length === 0) {
    throw new EngineError('No character chosen for the training');
  }
  out.warnings.push(...trainingWarnings(state, context, itemId, choices));
  for (const { from, to } of changes) {
    replaceInTeam(state, playerId, from, to);
  }
  player.inventory.splice(index, 1);
  // The log line "G1 usa ..." already lists the changes: one line only (spec 041, 7).
  notify(state, out, `${player.name} · ${item.name}: ${trainingChangesText(context.catalog, changes)}`, {
    inLog: false,
  });
}
