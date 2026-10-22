import type { ReactNode } from 'react';
import { PLAYER_IDS, type PlayerId } from '../engine';
import { formatCoins, type ChoiceTeam, type StarterChoiceView } from '../starters/starterChoice';
import { STARTER_CHOICE_BACKGROUND } from './layoutImages';
import { Placeholder } from './Placeholder';
import styles from './StarterChoiceScreen.module.css';

interface StarterChoiceScreenProps {
  view: StarterChoiceView;
  /** Director only: a click on a card chooses it for the player shown. */
  onChoose?: (index: number) => void;
}

/**
 * The starter choice (spec 025, 2.4), as in the channel's graphic: three
 * cards with the power on top and the character on a glowing base, the two
 * teams and their coins below. The same on director and stream, except that
 * on the director the cards can be clicked.
 */
export function StarterChoiceScreen({ view, onChoose }: StarterChoiceScreenProps) {
  const chooser = view.teams[view.showing].name;
  const anyChosen = view.cards.some((card) => card.chosen);

  return (
    <div className={styles.scene}>
      {STARTER_CHOICE_BACKGROUND && (
        <img className={styles.background} src={STARTER_CHOICE_BACKGROUND} alt="" />
      )}
      <p className={styles.who}>
        Sceglie <strong>{chooser}</strong>
      </p>

      <div className={styles.cards}>
        {view.cards.map((card, index) => {
          const classes = [
            styles.card,
            card.chosen ? styles.chosen : '',
            anyChosen && !card.chosen ? styles.dimmed : '',
          ].join(' ');
          const content: ReactNode = (
            <>
              <div className={styles.perk}>
                {card.texts.length > 0 ? (
                  card.texts.map((text, i) => <span key={i}>{text}</span>)
                ) : (
                  <span className={styles.noPower}>Nessun potere</span>
                )}
              </div>
              <div className={styles.figure}>
                <div className={styles.base} />
                <div className={styles.body}>
                  {card.character ? (
                    <Placeholder
                      name={card.character.name}
                      characterId={card.character.id}
                      imageData={card.character.imageData}
                      size="fill"
                      figure
                    />
                  ) : (
                    <div className={styles.missing}>?</div>
                  )}
                </div>
                {card.chosen && <span className={styles.badge}>Scelto da {chooser}</span>}
              </div>
            </>
          );
          return onChoose && card.character ? (
            <button
              key={index}
              className={`${classes} ${styles.clickable}`}
              onClick={() => onChoose(index)}
              aria-pressed={card.chosen}
              title={`${card.character.name}: starter di ${chooser}`}
            >
              {content}
            </button>
          ) : (
            <div key={index} className={classes}>
              {content}
            </div>
          );
        })}
      </div>

      <div className={styles.teams}>
        <Team team={view.teams.p1} player="p1" />
        {PLAYER_IDS.map((player) => {
          const coins = view.teams[player].coins;
          return (
            <span key={player} className={styles.coins}>
              {coins === null ? '' : formatCoins(coins)}
            </span>
          );
        })}
        <Team team={view.teams.p2} player="p2" />
      </div>
    </div>
  );
}

function Team({ team, player }: { team: ChoiceTeam; player: PlayerId }) {
  return (
    <div className={`${styles.team} ${styles[player] ?? ''}`}>
      <span className={styles.teamName}>squadra di {team.name}</span>
      <div className={styles.teamBox}>
        {team.starter ? (
          <>
            <span className={styles.teamPicture}>
              <Placeholder
                name={team.starter.name}
                characterId={team.starter.id}
                imageData={team.starter.imageData}
              />
            </span>
            <span>{team.starter.name}</span>
          </>
        ) : (
          <span className={styles.nobody}>-</span>
        )}
      </div>
    </div>
  );
}
