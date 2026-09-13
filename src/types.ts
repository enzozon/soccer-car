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
export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
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
  orientation: Quaternion;
  angularVelocity: Vec3;
  surfaceNormal: Vec3;
  jumpTime: number;
  jumpHoldTime: number;
  dodgeTime: number;
  dodgeAxis: Vec3;
  contactLock: number;
  supersonic: boolean;
}
export interface Ball {
  position: Vec3;
  velocity: Vec3;
  angularVelocity: Vec3;
}
export interface InputFrame {
  throttle: number;
  steer: number;
  boost: boolean;
  jump: boolean;
  drift: boolean;
  pitch?: number;
  yaw?: number;
  roll?: number;
}
export interface BoostPad {
  x: number;
  z: number;
  cooldown: number;
  large: boolean;
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
  halfWidth: 40.96,
  halfLength: 51.2,
  wallHeight: 20.48,
  goalHalfWidth: 8.92755,
  goalHeight: 6.42775,
  goalDepth: 8.8,
  ballRadius: 0.9125,
  carRadius: 0.65,
  rampRadius: 2.56,
  cornerLimit: 80.64,
} as const;
export const NEUTRAL_INPUT: InputFrame = {
  throttle: 0,
  steer: 0,
  boost: false,
  jump: false,
  drift: false,
  pitch: 0,
  yaw: 0,
  roll: 0,
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
    label: "Compacto e esportivo",
    acceleration: 16,
    maxSpeed: 14.1,
    turnRate: 2.65,
  },
  rally: {
    name: "Rally",
    label: "Robusto e elevado",
    acceleration: 16,
    maxSpeed: 14.1,
    turnRate: 2.65,
  },
  vector: {
    name: "Vector",
    label: "Baixo e aerodinâmico",
    acceleration: 16,
    maxSpeed: 14.1,
    turnRate: 2.65,
  },
} as const;
