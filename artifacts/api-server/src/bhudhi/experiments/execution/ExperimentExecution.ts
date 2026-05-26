import type { ExperimentStatus } from "../contracts/types.js";

export interface ExecutionState {
  status: ExperimentStatus;
  startedAt?: string;
  exposure: number;
  completion: number;
  dropoff: number;
  intervention?: string;
}

export class ExperimentExecution {
  launch(): ExecutionState {
    return {
      status: "RUNNING",
      startedAt: new Date().toISOString(),
      exposure: 0,
      completion: 0,
      dropoff: 0,
    };
  }

  recordExposure(state: ExecutionState, count = 1): ExecutionState {
    return { ...state, exposure: state.exposure + count };
  }

  recordCompletion(state: ExecutionState, count = 1): ExecutionState {
    const completion = state.completion + count;
    const dropoff =
      state.exposure > 0 ? 1 - completion / state.exposure : 0;
    return { ...state, completion, dropoff };
  }

  complete(state: ExecutionState): ExecutionState {
    return { ...state, status: "COMPLETE" };
  }

  terminate(state: ExecutionState, reason: string): ExecutionState {
    return { ...state, status: "TERMINATED", intervention: reason };
  }
}

export const experimentExecution = new ExperimentExecution();
