/**
 * How a cell is named on screen (spec 023): "#12" for the code "n12", and
 * "#s1" for codes of another kind. The code itself never changes, so saved
 * maps, episodes and games stay as they are.
 */
export function cellNumber(nodeId: string): string {
  const match = /^n(\d+)$/.exec(nodeId);
  return `#${match ? match[1] : nodeId}`;
}
