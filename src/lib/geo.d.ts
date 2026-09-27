/**
 * Types for geo.js — the website's walk math, copied byte-for-byte (see
 * GEO_SOURCE.md). The .js file is never edited in this repo; update both
 * together when the website's copy changes.
 */
export type GeoPoint = { lat: number; lng: number; t?: string; acc?: number; gap?: boolean; fast?: boolean };

export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number;
export const MAX_ON_FOOT_MPH: number;
export const MIN_SPEED_SECONDS: number;
export const REVIEW_REJECT_RATIO: number;
export const REVIEW_REJECT_MILES: number;
export const METRES_PER_MILE: number;
export const MAX_FIX_ACCURACY_M: number;
export const ACCURACY_RELAX_AFTER_MS: number;
export const ACCURACY_RELAX_STEP_M: number;
export const MAX_FIX_ACCURACY_RELAXED_M: number;
export function relaxedAccuracyCeiling(msSinceAccepted: number): number;
export const WARMUP_ACCURACY_M: number;
export const WARMUP_MAX_WAIT_MS: number;
export function fixAcceptable(accuracy: number, warmUpStartedAt: number, now?: number, lastAcceptedAt?: number | null): boolean;
export function fixAccuracy(p: GeoPoint | null | undefined): number;
export function legIsNoise(dMiles: number, accA: number, accB: number): boolean;
export const REVIEW_GAP_RATIO: number;
export function gapExceedsThreshold(gapSecondsTotal: number, elapsedSeconds: number): boolean;
export function formatGapReason(gapSecondsTotal: number, gapCount: number): string;
export function gpsFixQuality(accuracy: number): string;
export function segmentMph(a: GeoPoint, b: GeoPoint): number | null;
export const MAX_HANDOVER_METRES: number;
export function gapIsCorroborated(prev: GeoPoint, cur: GeoPoint): boolean;
export function analyzeOnFoot(path?: GeoPoint[]): {
  miles: number;
  rejectedMiles: number;
  rejectedSegments: number;
  flagged: boolean;
  flagReason: string;
  points: GeoPoint[];
};
export function pathDistanceMiles(path?: GeoPoint[]): number;
export function pathToSegments(path?: GeoPoint[]): GeoPoint[][];
export const GPS_GAP_THRESHOLD_SECONDS: number;
export function formatElapsed(totalSeconds: number): string;
export function formatPace(miles: number, seconds: number): string | null;
