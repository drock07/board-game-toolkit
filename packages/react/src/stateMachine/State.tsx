import { ReactNode } from "react";
import { useStateMachineCurrentState } from "./StateMachineContext";

interface BaseStateProps {
  children?: ReactNode;
}

export interface MatchLevelStateProps extends BaseStateProps {
  state: string | string[];
}

export interface AnyLevelStateProps extends BaseStateProps {
  includes: string;
}

export type StateProps = MatchLevelStateProps | AnyLevelStateProps;

export function State(props: StateProps) {
  const currentState = useStateMachineCurrentState();

  const { children } = props;
  let isMatching: boolean = false;

  if ("includes" in props) {
    const { includes } = props;
    isMatching = currentState.includes(includes);
  } else {
    const { state } = props;
    const matchingState = Array.isArray(state) ? state : [state];
    isMatching = matchingState.every(
      (s, i) => s === "*" || s === currentState[i],
    );
  }
  return isMatching ? children : null;
}
