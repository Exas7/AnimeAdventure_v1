import { describe, expect, it } from 'vitest';
import {
  describePower,
  looksLikePowerForm,
  newPowerForm,
  powerDefinition,
  powerFields,
} from './powerForm';

describe('power form (spec 003, 2.2; moved here by spec 025)', () => {
  it('asks only for the values each power needs', () => {
    expect(powerFields(newPowerForm('skipOpponentTurn'))).toEqual(['uses']);
    expect(powerFields({ ...newPowerForm('reminder'), moment: 'manual' })).toEqual([
      'text',
      'moment',
      'uses',
    ]);
    expect(powerFields({ ...newPowerForm('reminder'), moment: 'everyNTurns' })).toEqual([
      'text',
      'moment',
      'n',
    ]);
  });

  it('maps reminder moments to triggers', () => {
    const reminder = { ...newPowerForm('reminder'), text: 'Ciao' };
    expect(powerDefinition({ ...reminder, moment: 'everyNTurns', n: 3 }).trigger).toEqual({
      type: 'everyNTurns',
      n: 3,
    });
    expect(powerDefinition({ ...reminder, moment: 'manual', uses: 2 }).trigger).toEqual({
      type: 'manual',
      uses: 2,
    });
    expect(powerDefinition({ ...reminder, moment: 'interaction' }).trigger).toEqual({
      type: 'interaction',
    });
  });
});

describe('a power in words, for the list of powers (spec 025, 2.1)', () => {
  it('names the kind and only the values that matter', () => {
    expect(describePower({ ...newPowerForm('coinsEveryNTurns'), amount: 200, n: 2 })).toBe(
      'Monete ogni 2 turni: +200',
    );
    expect(describePower({ ...newPowerForm('extraStartingCoins'), amount: 2500 })).toBe(
      'Monete iniziali extra: +2500',
    );
    expect(describePower({ ...newPowerForm('coinsAtTurnEnd'), amount: -50 })).toBe(
      'Monete a fine turno: -50',
    );
    expect(describePower({ ...newPowerForm('extraActionsOnDemand'), uses: 2, name: 'Doppio movimento' })).toBe(
      'Azioni extra a comando: +2, 2 usi · «Doppio movimento»',
    );
    expect(describePower(newPowerForm('skipOpponentTurn'))).toBe('Fai perdere un turno: 1 uso');
    expect(
      describePower({ ...newPowerForm('reminder'), text: 'Puoi ritentare', moment: 'turnStart' }),
    ).toBe("Promemoria (all'inizio di ogni turno): «Puoi ritentare»");
    expect(describePower({ ...newPowerForm('reminder'), text: 'Ritenta', moment: 'manual' })).toBe(
      'Promemoria (a mano, 1 uso): «Ritenta»',
    );
  });

  it('recognises a power read back from the browser, and rejects a damaged one', () => {
    expect(looksLikePowerForm(newPowerForm('reminder'))).toBe(true);
    expect(looksLikePowerForm({ ...newPowerForm('reminder'), kind: 'flyForFree' })).toBe(false);
    expect(looksLikePowerForm({ ...newPowerForm('coinsAtTurnEnd'), amount: '100' })).toBe(false);
    expect(looksLikePowerForm(null)).toBe(false);
  });
});
