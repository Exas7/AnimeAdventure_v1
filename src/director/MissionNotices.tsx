import styles from './MissionNotices.module.css';

/** A mission whose condition is met: the director proposes its reward (D-040). */
export interface MissionNotice {
  id: number;
  text: string;
}

interface MissionNoticesProps {
  notices: MissionNotice[];
  /** "Dai il premio": the reward goes to the player, as one action undo takes back. */
  onReward(id: number): void;
  /** "Non ancora": the notice comes back next turn if the condition still holds. */
  onNotYet(id: number): void;
}

/** Director only (spec 026, 2.4): completed missions waiting for the host's click. */
export function MissionNotices({ notices, onReward, onNotYet }: MissionNoticesProps) {
  if (notices.length === 0) {
    return null;
  }
  return (
    <section className={styles.notices} aria-label="Missioni completate">
      {notices.map((notice) => (
        <div key={notice.id} className={styles.notice}>
          <span>{notice.text}</span>
          <span className={styles.buttons}>
            <button className={styles.primary} onClick={() => onReward(notice.id)}>
              Dai il premio
            </button>
            <button onClick={() => onNotYet(notice.id)}>Non ancora</button>
          </span>
        </div>
      ))}
    </section>
  );
}
