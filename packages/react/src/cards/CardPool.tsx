import {
  CardOf,
  GenericCardGameState,
  PoolIdOf,
} from "@drock07/board-game-toolkit-core";
import { ReactNode } from "react";
import { useStateMachineState } from "../stateMachine";

export interface CardPoolProps<TState extends GenericCardGameState> {
  poolId: PoolIdOf<TState>;
  children: (cards: CardOf<TState>[]) => ReactNode;
}

export function CardPool<TState extends GenericCardGameState>({
  poolId,
  children,
}: CardPoolProps<TState>) {
  const state = useStateMachineState<TState>();
  const cards = state.pools[poolId] as CardOf<TState>[];
  return <>{children(cards)}</>;
}
