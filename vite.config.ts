import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // concept/ holds other branches checked out as worktrees (D-054): their tests are not ours.
  test: { exclude: [...configDefaults.exclude, 'concept/**'] },
});
