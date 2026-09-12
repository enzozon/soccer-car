export type CarModel = "pulse" | "rally" | "vector";
export type Quality = "auto" | "low" | "high" | "2d";
export type CameraMode = "chase" | "ball" | "overview";
export type GameMode = "duel" | "training";
export type Difficulty = "easy" | "normal" | "hard";
export interface Settings {
  model: CarModel;
  color: string;
  quality: Quality;
  camera: CameraMode;
  volume: number;
  deadzone: number;
  sensitivity: number;
  difficulty: Difficulty;
  duration: number;
  reducedMotion: boolean;
}
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface Car {
  position: Vec3;
  velocity: Vec3;
  heading: number;
  boost: number;
  grounded: boolean;
  boosting: boolean;
  jumpCount: number;
  jumpHeld: boolean;
}
export interface Ball {
  position: Vec3;
  velocity: Vec3;
}
export interface InputFrame {
  throttle: number;
  steer: number;
  boost: boolean;
  jump: boolean;
  drift: boolean;
}
export interface BoostPad {
  x: number;
  z: number;
  cooldown: number;
}
export type GamePhase = "kickoff" | "playing" | "goal" | "finished";
export interface GameState {
  player: Car;
  opponent: Car;
  ball: Ball;
  pads: BoostPad[];
  mode: GameMode;
  phase: GamePhase;
  phaseTime: number;
  timeRemaining: number;
  score: [number, number];
  elapsed: number;
  overtime: boolean;
  lastGoal: 0 | 1 | null;
  hits: number;
}
export const FIELD = {
  halfWidth: 24,
  halfLength: 36,
  wallHeight: 12,
  goalHalfWidth: 7,
  goalHeight: 5,
  ballRadius: 1.25,
  carRadius: 1.35,
} as const;
export const NEUTRAL_INPUT: InputFrame = {
  throttle: 0,
  steer: 0,
  boost: false,
  jump: false,
  drift: false,
};
export const DEFAULT_SETTINGS: Settings = {
  model: "pulse",
  color: "#d7fb55",
  quality: "auto",
  camera: "chase",
  volume: 0.35,
  deadzone: 0.15,
  sensitivity: 1,
  difficulty: "normal",
  duration: 180,
  reducedMotion: false,
};
export const CAR_MODELS = {
  pulse: {
    name: "Pulse",
    label: "O equilíbrio perfeito",
    acceleration: 25,
    maxSpeed: 24,
    turnRate: 2.65,
  },
  rally: {
    name: "Rally",
    label: "Feito para as curvas",
    acceleration: 28,
    maxSpeed: 22,
    turnRate: 3.15,
  },
  vector: {
    name: "Vector",
    label: "Velocidade em linha reta",
    acceleration: 22,
    maxSpeed: 28,
    turnRate: 2.3,
  },
} as const;
