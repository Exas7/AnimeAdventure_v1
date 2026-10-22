import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative paths: the game works on GitHub Pages, under /AnimeAdventure_v1/, and locally (D-077).
  base: './',
  plugins: [react()],
  // concept/ holds other branches checked out as worktrees (D-054): their tests are not ours.
  test: { exclude: [...configDefaults.exclude, 'concept/**'] },
});
