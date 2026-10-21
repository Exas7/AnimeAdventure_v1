import { cellNumber } from '../engine';
import { NO_EXTRAS, type RandomReport } from '../episode/randomReport';
import { MissionTable } from '../missions/MissionTable';
import { Tile } from '../ui/Tile';
import styles from './Screens.module.css';

/**
 * What "Randomizza tutto" did, in three tendine that start closed (spec 033,
 * 2.3); the rare warnings about the starters below them.
 */
export function RandomReportTiles({ report }: { report: RandomReport }) {
  const extras = report.extras.reduce((total, group) => total + group.lines.length, 0);
  return (
    <div className={styles.tiles}>
      <Tile title="Missioni personaggi" count={report.missions.length}>
        {report.cellShortage && <p className={styles.note}>{report.cellShortage}</p>}
        <MissionTable rows={report.missions} />
      </Tile>
      <Tile title="Negozi" count={report.shops.length}>
        {report.shopShortages.map((line) => (
          <p key={line} className={styles.note}>
            {line}
          </p>
        ))}
        <ul className={styles.list}>
          {report.shops.map((row) => (
            <li key={row.nodeId}>
              <strong>
                {cellNumber(row.nodeId)} · {row.keeper}
              </strong>
              : {row.forSale.join(', ') || 'niente in vendita'}
            </li>
          ))}
        </ul>
      </Tile>
      <Tile title="Sfide extra" count={extras}>
        {report.extras.length === 0 ? (
          <p className={styles.note}>{NO_EXTRAS}</p>
        ) : (
          report.extras.map((group) => (
            <div key={group.title} className={styles.extraGroup}>
              <h4>{group.title}</h4>
              <ul className={styles.list}>
                {group.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ))
        )}
      </Tile>
      {report.starterNotes.length > 0 && (
        <div className={styles.guides}>
          {report.starterNotes.map((line) => (
            <p key={line}>⚠ {line}</p>
          ))}
        </div>
      )}
    </div>
  );
}
