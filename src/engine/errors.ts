/**
 * A request that refers to something that does not exist, such as an
 * unknown node or power. It signals a bug in the caller, not a game rule:
 * game limits never throw, they produce warnings (D-008).
 */
export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineError';
  }
}
