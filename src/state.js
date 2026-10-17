import { studyDefaults } from './study.js';
import { defaultBoundaries } from './process.js';

// Browser storage is optional. Reject malformed records rather than processing
// arbitrary dimensions, radii, modes, or crossed crop and group boundaries.
export function sanitizeState(state) {
  if (!state || !state.settings || typeof state.settings !== 'object') return null;
  const settings = structuredClone(studyDefaults);
  const limits = { brightness: [-100, 100], contrast: [-100, 100], median: [0, 12], chroma: [-100, 100], rotation: [0, 3], cropLeft: [0, 99], cropRight: [1, 100], cropTop: [0, 99], cropBottom: [1, 100] };
  for (const [key, [min, max]] of Object.entries(limits)) {
    const value = state.settings[key];
    if (value !== undefined && (!Number.isInteger(value) || value < min || value > max)) return null;
    if (value !== undefined) settings[key] = value;
  }
  if (settings.cropLeft >= settings.cropRight || settings.cropTop >= settings.cropBottom) return null;
  for (const [key, valid] of Object.entries({ mode: ['value', 'color', 'chroma'], levels: [0, 2, 3, 4, 5, 7], palette: [0, 3, 5, 8, 12, 16], smoothing: ['source', 'channels'] })) {
    if (state.settings[key] !== undefined && !valid.includes(state.settings[key])) return null;
    if (state.settings[key] !== undefined) settings[key] = state.settings[key];
  }
  settings.flip = state.settings.flip === true;
  const boundaries = [];
  for (const level of [2, 3, 4, 5, 7]) {
    const cutoffs = Array.isArray(state.boundaries) ? state.boundaries.find(entry => Array.isArray(entry) && entry[0] === level)?.[1] ?? defaultBoundaries(level) : defaultBoundaries(level);
    if (!Array.isArray(cutoffs) || cutoffs.length !== level - 1 || cutoffs.some((v, i) => !Number.isInteger(v) || v < 1 || v > 255 || (i && v <= cutoffs[i - 1]))) return null;
    boundaries.push([level, [...cutoffs]]);
    const grays = state.settings.groupGrays?.[level];
    if (grays !== undefined) {
      if (!Array.isArray(grays) || grays.length !== level || grays.some(v => !Number.isInteger(v) || v < 0 || v > 255)) return null;
      settings.groupGrays[level] = [...grays];
    }
  }
  return { settings, boundaries };
}
