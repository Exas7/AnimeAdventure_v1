import { createContext, useContext, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import { useTheme } from './ThemeProvider';
import { ThemeSymbol } from './ThemeSymbol';
import type { FrameId, SymbolId } from './themes';
import styles from './Frame.module.css';

interface FrameProps extends HTMLAttributes<HTMLDivElement> {
  /** A confirmation for something that cannot be undone: the frame turns red (spec 050, 2.2). */
  danger?: boolean;
  /** A thin frame without symbols, for menus and small notes. */
  thin?: boolean;
  /** Another frame or symbol than the ones in use: the previews of «Temi» and «Aspetto». */
  frame?: FrameId;
  symbol?: SymbolId;
  /** Classes of the scrolling inside: padding, gaps, layout. */
  contentClassName?: string;
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}

const FrameContext = createContext<{ frame: FrameId; symbol: SymbolId | undefined; thin: boolean }>({
  frame: 'smussata',
  symbol: undefined,
  thin: true,
});

/**
 * The frame of every window (spec 050, 2.2): A «Smussata», B «Tuta e
 * cintura» with the symbol as a medal on top, C «Aura». The symbol is also
 * big and faded on the back of the window. The outer element takes the
 * window's size (className); the content scrolls inside.
 */
export function Frame({ danger, thin = false, frame, symbol, className, contentClassName, children, ...rest }: FrameProps) {
  const theme = useTheme();
  const shape = frame ?? theme.frame;
  const classes = [styles.frame, styles[shape], danger && styles.danger, thin && styles.thin, className];
  return (
    <FrameContext.Provider value={{ frame: shape, symbol, thin }}>
      <div className={classes.filter(Boolean).join(' ')} {...rest}>
        {!thin && shape === 'tuta' && <ThemeSymbol place="medal" symbol={symbol} className={styles.medal} />}
        <div className={styles.panel}>
          {!thin && <ThemeSymbol place="back" symbol={symbol} className={styles.back} />}
          <div className={[styles.content, contentClassName].filter(Boolean).join(' ')}>{children}</div>
        </div>
      </div>
    </FrameContext.Provider>
  );
}

interface FrameTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

/** A window's title with the symbol beside it, as on the chest of the gi; centred under the medal of frame B. */
export function FrameTitle({ className, children, ...rest }: FrameTitleProps) {
  const { frame, symbol, thin } = useContext(FrameContext);
  const classes = [styles.title, frame === 'tuta' && !thin && styles.centred, className];
  return (
    <h2 className={classes.filter(Boolean).join(' ')} {...rest}>
      {!thin && frame !== 'tuta' && <ThemeSymbol place="chest" symbol={symbol} />}
      <span>{children}</span>
    </h2>
  );
}
