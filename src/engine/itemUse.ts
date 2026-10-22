import { testItems } from './testMap';
import type { ItemDefinition } from './types';

// "Usa" on the Senzu and on the travel items (spec 047, D-074). Games saved
// before keep their own copy of the items, without the travel rule: the
// items of the game give it to them, as for training (spec 041).

/** How far a travel item takes the pawn; undefined for the other items. */
export function travelRule(item: ItemDefinition): { steps: number | null } | undefined {
  return item.travel ?? testItems.find((known) => known.id === item.id)?.travel;
}

/** True for the Senzu: "Usa" recharges the starter as when it is bought. */
export function rechargesStarter(item: ItemDefinition): boolean {
  return item.onPurchase === 'rechargeStarter';
}
