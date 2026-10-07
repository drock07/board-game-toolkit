// What the engine throws. Every class here is a bug in a game's definition
// or rules code: an illegal input is never thrown, it comes back from `apply`
// as `{ ok: false, reason }`. A host's own mistakes (a wrong player count)
// throw standard errors.

/** A bug in a game's definition, found when it's defined or started. */
export class GameDefinitionError extends Error {
  override name = "GameDefinitionError";
}

/** Rules code used the engine wrongly while running: an unknown zone or entity, too few entities to move, an undeclared effect. */
export class RulesError extends GameDefinitionError {
  override name = "RulesError";
}

/** An outcome was raised that no enclosing `outcomes` node handles. */
export class UnhandledOutcomeError extends GameDefinitionError {
  override name = "UnhandledOutcomeError";
}

/** The flow ran out without a step calling `tx.end()`. */
export class FlowEndedWithoutEndError extends GameDefinitionError {
  override name = "FlowEndedWithoutEndError";
}

/** The flow ran too many steps without waiting for input: a loop that never waits. */
export class FlowStuckError extends GameDefinitionError {
  override name = "FlowStuckError";
  constructor(
    message: string,
    /** The node ids of the last frames run, oldest first. */
    readonly trace: readonly string[],
  ) {
    super(`${message}. Last nodes run: ${trace.join(" > ")}`);
  }
}

/** Abilities set each other off too many levels deep: an ability probably triggers itself. */
export class AbilityLoopError extends GameDefinitionError {
  override name = "AbilityLoopError";
  constructor(
    message: string,
    /** The interrupt frames (ability and effect node ids), outermost first. */
    readonly trace: readonly string[],
  ) {
    super(message);
  }
}
