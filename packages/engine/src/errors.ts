/** Base class for bugs in a game definition. These throw; bad inputs don't. */
export class GameDefinitionError extends Error {
  override name = "GameDefinitionError";
}

/** A rules-code op was used incorrectly (e.g. an unknown zone or entity). */
export class OpError extends GameDefinitionError {
  override name = "OpError";
}

export class UnhandledOutcomeError extends GameDefinitionError {
  override name = "UnhandledOutcomeError";
}

export class FlowStuckError extends GameDefinitionError {
  override name = "FlowStuckError";
  constructor(
    message: string,
    readonly trace: string[],
  ) {
    super(message);
  }
}

export class FlowEndedWithoutEndError extends GameDefinitionError {
  override name = "FlowEndedWithoutEndError";
}
