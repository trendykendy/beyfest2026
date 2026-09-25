export * from "./types";
export { STRUCTURES, pickStructure } from "./structures";
export { pointsToWin, miniRRAdvancers } from "./rules";
export { computeStandings, roundRobinComplete } from "./standings";
export { createGroupStage, type PlayerInput, type GroupStage } from "./draw";
export { roundRobinRounds, scheduleGroupStage, type Pairing } from "./schedule";
export {
  generateKnockout,
  applyResult,
  resolve,
  champion,
  type State,
} from "./knockout";
export { makeRng, shuffle, defaultRng, type Rng } from "./util";
export { planCorrection, applyCorrection, type CorrectionPlan, type Repin } from "./correct";
