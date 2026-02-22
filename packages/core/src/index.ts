import { start } from './StateMachineEngine';
import { StateMachineConfig } from './types/StateMachineConfig';

export type * from './types/StateMachineConfig'

export {};

interface GameState {
    score: number;
    round: number;
}

const config: StateMachineConfig<GameState> = {
    id: 'root',
    initial: "one",
    states: {
        one: {
            onEnter: (state) => ({ ...state, round: 1 }),
            getNext: (state) => state.round > 0 ? "two" : null,
        },
        two: {
            onEnter: (state) => ({ ...state, score: state.score + 10 }),
            getNext: () => null,
        },
        machine: {
            id: 'first',
            initial: "y",
            states: {
                x: {},
                y: {}
            }
        },
    },
}

const engine = start(config, { score: 0, round: 0 });