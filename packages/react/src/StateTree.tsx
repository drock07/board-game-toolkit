import { useStateMachineCurrentState } from "./StateMachineContext";
import {
  isStateMachineModule,
  StateLeafModule,
  StateMachineModule,
  StateModule,
} from "./types/StateModule";

export interface StateTreeProps<TState> {
  module: StateModule<TState>;
}

export function StateTree<TState>({ module }: StateTreeProps<TState>) {
  if (isStateMachineModule(module)) {
    return <StateMachine module={module} />;
  } else {
    return <StateLeaf module={module} />;
  }
}

function StateLeaf({ module }: { module: StateLeafModule }) {
  const Component = module.component;
  return <Component />;
}

function StateMachine<TState>({
  module,
}: {
  module: StateMachineModule<TState>;
}) {
  const currentState = useStateMachineCurrentState(
    module.stateMachineConfig.id,
  );

  if (!currentState) return null;

  const Layout = module.layout;
  const childModule = module.childModules?.[currentState];
  const content = childModule ? <StateTree module={childModule} /> : undefined;

  return Layout ? <Layout>{content}</Layout> : content;
}
