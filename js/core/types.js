// Registry that merges the built-in planet types with ones the user made.

import { PLANET_TYPES } from '../data/planetTypes.js';
import { BIOME_INDEX } from '../data/biomes.js';

let customTypes = [];

export function setCustomTypes(list) {
  customTypes = Array.isArray(list) ? list : [];
}

export function getCustomTypes() {
  return customTypes;
}

export function allTypes() {
  return [...PLANET_TYPES, ...customTypes];
}

export function getType(id) {
  return allTypes().find((t) => t.id === id) || PLANET_TYPES[0];
}

export function isBuiltInType(id) {
  return PLANET_TYPES.some((t) => t.id === id);
}

const RANGE_KEYS = ['h', 't', 'm', 'n', 'lat'];
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

// Returns a list of human-readable problems. An empty list means the type is usable.
export function validateType(type, takenIds = []) {
  const errors = [];
  if (!type || typeof type !== 'object') return ['Each type must be an object { ... }.'];
  const label = type.name || type.id || 'type';
  if (typeof type.id !== 'string' || !/^[a-z0-9_-]+$/.test(type.id)) errors.push(`${label}: "id" must use only lowercase letters, numbers, - or _.`);
  else if (takenIds.includes(type.id)) errors.push(`${label}: the id "${type.id}" is already used.`);
  if (typeof type.name !== 'string' || !type.name.trim()) errors.push(`${label}: needs a "name".`);
  if (!Array.isArray(type.rules) || type.rules.length === 0) {
    errors.push(`${label}: needs a non-empty "rules" list.`);
  } else {
    type.rules.forEach((rule, i) => {
      if (!BIOME_INDEX.has(rule.biome)) errors.push(`${label}: rule ${i + 1} uses unknown biome "${rule.biome}".`);
      for (const key of RANGE_KEYS) {
        if (rule[key] === undefined) continue;
        const r = rule[key];
        if (!Array.isArray(r) || r.length !== 2 || !r.every(Number.isFinite)) errors.push(`${label}: rule ${i + 1} "${key}" must be [min, max].`);
      }
      if (rule.water !== undefined && typeof rule.water !== 'boolean') errors.push(`${label}: rule ${i + 1} "water" must be true or false.`);
    });
  }
  if (type.gen !== undefined && (typeof type.gen !== 'object' || type.gen === null)) errors.push(`${label}: "gen" must be an object.`);
  if (type.gen) {
    for (const [k, v] of Object.entries(type.gen)) {
      if (k === 'style') {
        if (v !== 'terrain' && v !== 'bands') errors.push(`${label}: gen.style must be "terrain" or "bands".`);
      } else if (k === 'atmosphere' || k === 'cloudColor') {
        if (v !== null && !HEX.test(String(v))) errors.push(`${label}: gen.${k} must be a color like "#88ccff" or null.`);
      } else if (!Number.isFinite(v)) errors.push(`${label}: gen.${k} must be a number.`);
    }
  }
  if (type.palette) {
    for (const [k, v] of Object.entries(type.palette)) {
      if (!BIOME_INDEX.has(k)) errors.push(`${label}: palette uses unknown biome "${k}".`);
      if (!HEX.test(String(v))) errors.push(`${label}: palette color for "${k}" must look like "#aabbcc".`);
    }
  }
  return errors;
}
