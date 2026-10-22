import type { ReactNode } from 'react';
import { shopListing, type GameContext, type GameState } from '../engine';
import { NumberField } from './NumberField';
import { ownImage } from './characterImages';
import { itemImage } from './itemImages';
import { Placeholder } from './Placeholder';
import styles from './ShopScreen.module.css';

/** Director-only commands; on the stream the shop is read-only. */
export interface ShopActions {
  buyCharacter?: (characterId: string) => void;
  buyItem?: (itemId: string) => void;
  setCharacterPrice?: (characterId: string, price: number) => void;
  setItemPrice?: (itemId: string, price: number) => void;
}

interface ShopScreenProps {
  context: GameContext;
  state: GameState;
  shopNodeId: string;
  actions?: ShopActions;
  /** Small, single-column version for the director's side panels. */
  compact?: boolean;
  /** Extra buttons at the bottom, such as "Chiudi". */
  children?: ReactNode;
}

/**
 * The shop as seen by the current player (D-006): sold, sold out and
 * already bought entries are grey, but stay buyable (D-015).
 */
export function ShopScreen(props: ShopScreenProps) {
  const { context, state, shopNodeId, actions, compact, children } = props;
  const viewer = state.currentPlayer;
  const listing = shopListing(state, context, shopNodeId, viewer);
  const nameOf = (characterId: string) =>
    context.catalog.find((character) => character.id === characterId)?.name ?? characterId;
  const keeper = listing.shopkeeperId ? nameOf(listing.shopkeeperId) : null;

  return (
    <div className={`${styles.shop} ${compact ? styles.compact : ''}`}>
      <header className={styles.header}>
        {keeper && (
          <div className={styles.keeper}>
            <Placeholder
              name={keeper}
              characterId={listing.shopkeeperId}
              imageData={ownImage(context.catalog, listing.shopkeeperId)}
              size="fill"
            />
          </div>
        )}
        <div>
          <h2 className={styles.title}>Negozio</h2>
          {keeper && <p className={styles.subtitle}>{keeper}</p>}
        </div>
      </header>

      <div className={styles.columns}>
        <section>
          <h3>Personaggi</h3>
          {listing.characters.length === 0 && <p className={styles.empty}>Nessuno in vendita.</p>}
          <ul className={styles.list}>
            {listing.characters.map((entry) => (
              <li key={entry.characterId} className={entry.soldTo ? styles.grey : undefined}>
                <div className={styles.thumb}>
                  <Placeholder name={entry.name} characterId={entry.characterId} size="fill" />
                </div>
                <span className={styles.name}>{entry.name}</span>
                <Price
                  value={entry.price}
                  label={`Prezzo di ${entry.name}`}
                  onChange={
                    actions?.setCharacterPrice &&
                    ((price) => actions.setCharacterPrice?.(entry.characterId, price))
                  }
                />
                {entry.soldTo && (
                  <span className={styles.status}>
                    Venduto a {state.players[entry.soldTo].name}
                  </span>
                )}
                {actions?.buyCharacter && (
                  <button onClick={() => actions.buyCharacter?.(entry.characterId)}>Acquista</button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3>Oggetti</h3>
          <ul className={styles.list}>
            {listing.items.map((entry) => (
              <li
                key={entry.itemId}
                className={entry.soldOut || entry.alreadyBought ? styles.grey : undefined}
              >
                <ItemThumb name={entry.name} />
                <span className={styles.name}>{entry.name}</span>
                <Price
                  value={entry.price}
                  label={`Prezzo di ${entry.name}`}
                  onChange={
                    actions?.setItemPrice && ((price) => actions.setItemPrice?.(entry.itemId, price))
                  }
                />
                {entry.soldOut && <span className={styles.status}>Esaurito</span>}
                {entry.alreadyBought && <span className={styles.status}>Già comprato</span>}
                {actions?.buyItem && (
                  <button onClick={() => actions.buyItem?.(entry.itemId)}>Acquista</button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {children && <div className={styles.actions}>{children}</div>}
    </div>
  );
}

interface PriceProps {
  value: number;
  label: string;
  onChange?: (price: number) => void;
}

function Price({ value, label, onChange }: PriceProps) {
  return (
    <span className={styles.price}>
      {onChange ? <NumberField value={value} label={label} onCommit={onChange} /> : value} monete
    </span>
  );
}

/** The item's picture next to its name, if the host has one (spec 045). */
function ItemThumb({ name }: { name: string }) {
  const image = itemImage(name);
  return image ? (
    <div className={styles.thumb}>
      <img className={styles.itemThumb} src={image} alt="" />
    </div>
  ) : null;
}
