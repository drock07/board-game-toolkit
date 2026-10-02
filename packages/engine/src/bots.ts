import type { Random } from "./rng.js";
import type {
  AnyTypes,
  GameState,
  GameTypes,
  Input,
  PlayerId,
  Prompt,
} from "./types.js";

export interface BotContext {
  /** The player the bot is answering for. */
  player: PlayerId;
  /** The bot's legal inputs for this prompt. */
  legal: Input[];
  /**
   * The bot's own RNG, separate from the game's, so the game's determinism
   * depends only on the inputs bots produce.
   */
  random: Random;
}

/**
 * A bot answers one prompt. It sees the game state for now; once views land
 * (M6) it will see only its player's view.
 */
export type Bot<T extends GameTypes = AnyTypes> = (
  view: GameState<T>,
  prompt: Prompt,
  ctx: BotContext,
) => Input | Promise<Input>;

/** Picks uniformly among the legal inputs. */
export function randomBot<T extends GameTypes = AnyTypes>(): Bot<T> {
  return (_view, prompt, { legal, random }) => {
    if (!legal.length) {
      throw new Error(
        `randomBot: no legal inputs for prompt "${prompt.id}" (${prompt.node})`,
      );
    }
    return random.pick(legal);
  };
}
