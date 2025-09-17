export const TWO_PI = Math.PI * 2;

// Bounce/ritmo
export const BOUNCE_BPM = 140;
export const BOUNCE_FREQ = BOUNCE_BPM / 60;

// Profili verticali palla
export const BALL_MIN_Y = 0.3;
export const BALL_MAX_Y = 0.8;
export const BALL_MID_Y = (BALL_MIN_Y + BALL_MAX_Y) / 2;
export const BALL_AMP_Y = (BALL_MAX_Y - BALL_MIN_Y) / 2;

// Parametri di start/resume del ciclo bounce
export const BOUNCE_START_Y = 0.5;     // altezza iniziale quando parte il bounce
export const BOUNCE_RESUME_P = 0.5001; // ripartenza appena dopo il touch a terra

// Profondità nel mondo
export const BALL_Z = 0.3;

// Durate e velocità
export const SIDE_MOVE_DURATION_SEC = 0.38; // durata fissa per spostamento laterale di 1 tile
export const DEFAULT_STEP_DURATION = 0.14;  // durata per 1 tile verticale (velocità = tileSize / DEFAULT_STEP_DURATION)

// Wall bounce
export const WALL_BOUNCE_TOTAL_FACTOR = 1; // lunghezza totale del rimbalzo su muro = factor * tileSize

// Tolleranze numeriche
export const EPS_POS = 0.001;

// Audio muro
export const WALL_AUDIO_URL = "/sounds/wall.wav";
export const WALL_AUDIO_DISTANCE = 4;
export const WALL_AUDIO_RATE_MIN = 0.95;
export const WALL_AUDIO_RATE_MAX = 1.05;

// Visual offsets
export const BALL_NODE_OFFSET: Readonly<[number, number, number]> = [0, 0.5, -0.25];
export const SHADOW_OFFSET: Readonly<[number, number, number]> = [0, 0.09, -0.25];
export const SHADOW_RADIUS = 0.22;
export const SHADOW_SEGMENTS = 16;
export const SHADOW_OPACITY = 0.25;