// Single source of truth for presets, defaults, control ranges and validation.
// Colours are hex strings so they export cleanly to JSON and bind to colour
// pickers. The scene converts them to RGB internally.

// ---------------------------------------------------------------------------
// Scene presets: one parameter set per environmental state.
// Every preset defines exactly the same keys. Geometry never lives here.
// ---------------------------------------------------------------------------
export const PRESETS = {
  sunny: {
    skyTop: '#7dbcd4', skyMid: '#a9d5e0', skyHorizon: '#e4efd6',
    sunColor: '#fff6c6', glowColor: '#fff0a6', sunAlpha: 1, sunX: 0.8, sunY: 0.23, sunSize: 44, glow: 0.6,
    cloudLight: '#fffaf0', cloudShade: '#c5d1d8', cloudOpacity: 0.96, cloudAmount: 7, cloudScale: 1, cloudSpeed: 1,
    mtnFar: '#9dbcc9', mtnMid: '#76a09f', mtnNear: '#5d8d70', facet: 0.3,
    tree: '#4c7848', palm: '#3d6a43',
    haze: '#e7f0da', hazeAmount: 0.45, mist: 0,
    fieldTop: '#c3cd6a', fieldBottom: '#5b8a2c',
    grassFar: '#b3c45e', grassMid: '#86a93c', grassDark: '#4e7c29', grassLight: '#d8dc70', seedColor: '#f5edd3',
    charTint: '#ffffff', charBrightness: 1,
    rain: 0, rainAngle: 0.18, rainSpeed: 1,
    wind: 0.22, leaves: 0, stars: 0,
    brightness: 1, warmth: 0.08,
  },
  twilight: {
    skyTop: '#5e5294', skyMid: '#cc6f8a', skyHorizon: '#f6a05a',
    sunColor: '#ffd56c', glowColor: '#ff9549', sunAlpha: 1, sunX: 0.79, sunY: 0.6, sunSize: 54, glow: 0.9,
    cloudLight: '#f6a27c', cloudShade: '#86588a', cloudOpacity: 0.92, cloudAmount: 9, cloudScale: 1, cloudSpeed: 0.8,
    mtnFar: '#9a6e9a', mtnMid: '#7a5b8c', mtnNear: '#594a78', facet: 0.3,
    tree: '#493c5e', palm: '#3c3352',
    haze: '#f2a27a', hazeAmount: 0.4, mist: 0.05,
    fieldTop: '#c8973f', fieldBottom: '#6a6628',
    grassFar: '#c29b48', grassMid: '#a18a3a', grassDark: '#5c5828', grassLight: '#e6b65a', seedColor: '#f7d7a8',
    charTint: '#efc0ae', charBrightness: 0.92,
    rain: 0, rainAngle: 0.18, rainSpeed: 1,
    wind: 0.15, leaves: 0, stars: 0.08,
    brightness: 1, warmth: 0.2,
  },
  night: {
    skyTop: '#0e1d48', skyMid: '#1d356f', skyHorizon: '#34508a',
    sunColor: '#f4f2e6', glowColor: '#9cb3e2', sunAlpha: 1, sunX: 0.62, sunY: 0.15, sunSize: 34, glow: 0.55,
    cloudLight: '#3d5791', cloudShade: '#1c2e5f', cloudOpacity: 0.85, cloudAmount: 6, cloudScale: 1, cloudSpeed: 0.6,
    mtnFar: '#2c457d', mtnMid: '#22396b', mtnNear: '#1a2d57', facet: 0.25,
    tree: '#142647', palm: '#101f3d',
    haze: '#2f4b82', hazeAmount: 0.25, mist: 0,
    fieldTop: '#2a5650', fieldBottom: '#0f2d2b',
    grassFar: '#2b5a52', grassMid: '#1d4840', grassDark: '#0e2b29', grassLight: '#4a7a70', seedColor: '#b9c9d9',
    charTint: '#7686b4', charBrightness: 0.9,
    rain: 0, rainAngle: 0.18, rainSpeed: 1,
    wind: 0.12, leaves: 0, stars: 0.85,
    brightness: 1, warmth: -0.15,
  },
  rain: {
    skyTop: '#5c6e85', skyMid: '#7c8c9f', skyHorizon: '#a2b0ba',
    sunColor: '#e8edf0', glowColor: '#c8d2da', sunAlpha: 0, sunX: 0.8, sunY: 0.23, sunSize: 44, glow: 0,
    cloudLight: '#8795a7', cloudShade: '#55647a', cloudOpacity: 0.95, cloudAmount: 14, cloudScale: 1.3, cloudSpeed: 1.3,
    mtnFar: '#8b9ba9', mtnMid: '#72869a', mtnNear: '#5a7081', facet: 0.2,
    tree: '#3a5a4e', palm: '#33514a',
    haze: '#a6b4be', hazeAmount: 0.6, mist: 0.25,
    fieldTop: '#6f8e4b', fieldBottom: '#2e5a2a',
    grassFar: '#6b8b47', grassMid: '#4e7838', grassDark: '#2c5428', grassLight: '#87a15b', seedColor: '#d7ddd0',
    charTint: '#aab2bc', charBrightness: 0.95,
    rain: 0.8, rainAngle: 0.2, rainSpeed: 1,
    wind: 0.45, leaves: 0, stars: 0,
    brightness: 0.96, warmth: -0.12,
  },
  wind: {
    skyTop: '#8ebad6', skyMid: '#bcd6e4', skyHorizon: '#e7eef0',
    sunColor: '#fffbe6', glowColor: '#fff6d6', sunAlpha: 0, sunX: 0.8, sunY: 0.2, sunSize: 40, glow: 0.2,
    cloudLight: '#ffffff', cloudShade: '#c3cfdb', cloudOpacity: 0.95, cloudAmount: 9, cloudScale: 1.1, cloudSpeed: 3.5,
    mtnFar: '#a9bdc9', mtnMid: '#8aa6b1', mtnNear: '#6a8e86', facet: 0.35,
    tree: '#4e7a52', palm: '#46704a',
    haze: '#e3ecea', hazeAmount: 0.5, mist: 0,
    fieldTop: '#a9c768', fieldBottom: '#4f8a30',
    grassFar: '#9cbd5c', grassMid: '#72a23c', grassDark: '#447a2a', grassLight: '#c4dc74', seedColor: '#f2efda',
    charTint: '#f6f8ff', charBrightness: 1,
    rain: 0, rainAngle: 0.18, rainSpeed: 1,
    wind: 0.9, leaves: 0.7, stars: 0,
    brightness: 1.02, warmth: -0.05,
  },
  dawn: {
    skyTop: '#e7d1a8', skyMid: '#f1dbae', skyHorizon: '#f8e7c2',
    sunColor: '#fff2c4', glowColor: '#ffd98c', sunAlpha: 1, sunX: 0.78, sunY: 0.32, sunSize: 48, glow: 0.85,
    cloudLight: '#fbe9c6', cloudShade: '#d8b98b', cloudOpacity: 0.9, cloudAmount: 6, cloudScale: 1, cloudSpeed: 0.7,
    mtnFar: '#ccb393', mtnMid: '#b39c80', mtnNear: '#9b8a6d', facet: 0.3,
    tree: '#7a7a52', palm: '#6a6a48',
    haze: '#f5e3bd', hazeAmount: 0.6, mist: 0.6,
    fieldTop: '#cbb55b', fieldBottom: '#778a30',
    grassFar: '#c2ab58', grassMid: '#a69b3f', grassDark: '#6c7a2c', grassLight: '#e3ca6c', seedColor: '#fcf0d3',
    charTint: '#f3dcc4', charBrightness: 0.98,
    rain: 0, rainAngle: 0.18, rainSpeed: 1,
    wind: 0.15, leaves: 0, stars: 0,
    brightness: 1, warmth: 0.18,
  },
};

export const PRESET_LABELS = {
  sunny: 'Sunny', twilight: 'Twilight', night: 'Night', rain: 'Rain', wind: 'Wind', dawn: 'Dawn',
};

// ---------------------------------------------------------------------------
// Defaults for everything that is not a preset value.
// ---------------------------------------------------------------------------
export function createDefaultConfig() {
  return {
    activePreset: 'sunny',
    playback: {
      playing: true,
      speed: 1,
      loop: true,
      transitionSeconds: 4,
      reducedMotion: false,
      debug: false,
      quality: 'high',
    },
    scene: clone(PRESETS.sunny),
    clouds: { parallax: 1 },
    grass: {
      density: 1, heightMul: 1, heightVar: 0.45, bladeWidth: 1,
      swayAmp: 1, swaySpeed: 1, windDir: 1, occlusion: 1, seedFreq: 0.05, seed: 7,
      clumping: 0.35, mass: 1,
    },
    character: {
      visible: true, x: 0.18, scale: 1, walkSpeed: 38, cadence: 0.62,
      stride: 1, bob: 1, armSwing: 1, fabric: 1, groundOffset: 0,
      munduLength: 'folded', clothStiffness: 1,
    },
    dog: {
      enabled: true,
      presets: { sunny: true, twilight: false, night: false, rain: false, wind: false, dawn: true },
      aloneCrossings: 2, togetherCrossings: 1, firstVisitDelay: 20,
      approachSpeed: 120, easeSeconds: 2.5, spacing: 108, scale: 1,
    },
    birds: {
      enabled: true,
      presets: { sunny: true, twilight: false, night: false, rain: false, wind: false, dawn: false },
      flockSize: 5, interval: 28, speed: 70, altitude: 0.7, wingSpeed: 1, scale: 1, chirps: true,
    },
    weather: { rainDensity: 0.7 },
    finish: { grain: 0.1 },
    audio: {
      enabled: false, muted: false, master: 0.5,
      windOn: true, wind: 0.5, rainOn: true, rain: 0.5, birdsOn: true, birds: 0.35,
    },
  };
}

// ---------------------------------------------------------------------------
// Control ranges. Used by the dev panel AND by import validation.
// ---------------------------------------------------------------------------
export const RANGES = {
  'playback.speed': [0, 3, 0.05],
  'playback.transitionSeconds': [0, 12, 0.1],
  'scene.sunAlpha': [0, 1, 0.01], 'scene.sunX': [0, 1, 0.005], 'scene.sunY': [0, 1, 0.005],
  'scene.sunSize': [10, 120, 1], 'scene.glow': [0, 1.5, 0.01],
  'scene.cloudOpacity': [0, 1, 0.01], 'scene.cloudAmount': [0, 16, 1], 'scene.cloudScale': [0.5, 2, 0.01],
  'scene.cloudSpeed': [0, 6, 0.05], 'scene.facet': [0, 1, 0.01],
  'scene.hazeAmount': [0, 1, 0.01], 'scene.mist': [0, 1, 0.01],
  'scene.charBrightness': [0.3, 1.5, 0.01],
  'scene.rain': [0, 1, 0.01], 'scene.rainAngle': [-0.6, 0.6, 0.01], 'scene.rainSpeed': [0.3, 2, 0.01],
  'scene.wind': [0, 1.2, 0.01], 'scene.leaves': [0, 1, 0.01], 'scene.stars': [0, 1, 0.01],
  'scene.brightness': [0.4, 1.6, 0.01], 'scene.warmth': [-1, 1, 0.01],
  'clouds.parallax': [0, 2, 0.01],
  'grass.density': [0.1, 2, 0.01], 'grass.heightMul': [0.5, 1.6, 0.01], 'grass.heightVar': [0, 1, 0.01],
  'grass.bladeWidth': [0.5, 2, 0.01], 'grass.swayAmp': [0, 2.5, 0.01], 'grass.swaySpeed': [0, 3, 0.01],
  'grass.occlusion': [0.4, 1.6, 0.01], 'grass.seedFreq': [0, 0.4, 0.005], 'grass.seed': [1, 9999, 1],
  'grass.clumping': [0, 1, 0.01], 'grass.mass': [0, 1.5, 0.01],
  'character.x': [0, 1, 0.01], 'character.scale': [0.5, 1.6, 0.01], 'character.walkSpeed': [0, 140, 1],
  'character.cadence': [0.1, 1.6, 0.01], 'character.stride': [0, 2, 0.01], 'character.bob': [0, 2.5, 0.01],
  'character.armSwing': [0, 2, 0.01], 'character.fabric': [0, 2.5, 0.01],
  'character.groundOffset': [-20, 20, 0.5], 'character.clothStiffness': [0.2, 2, 0.01],
  'dog.aloneCrossings': [0, 8, 1], 'dog.togetherCrossings': [1, 6, 1], 'dog.firstVisitDelay': [0, 180, 1],
  'dog.approachSpeed': [20, 220, 1], 'dog.easeSeconds': [0.3, 8, 0.1], 'dog.spacing': [40, 220, 1],
  'dog.scale': [0.6, 1.4, 0.01],
  'birds.flockSize': [1, 12, 1], 'birds.interval': [5, 180, 1], 'birds.speed': [20, 180, 1],
  'birds.altitude': [0, 1, 0.01], 'birds.wingSpeed': [0.3, 3, 0.01], 'birds.scale': [0.5, 2, 0.01],
  'weather.rainDensity': [0.1, 1, 0.01],
  'finish.grain': [0, 0.4, 0.005],
  'audio.master': [0, 1, 0.01], 'audio.wind': [0, 1, 0.01], 'audio.rain': [0, 1, 0.01], 'audio.birds': [0, 1, 0.01],
};

export const OPTIONS = {
  activePreset: Object.keys(PRESETS),
  'playback.quality': ['low', 'medium', 'high'],
  'grass.windDir': [1, -1],
  'character.munduLength': ['folded', 'full'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function clone(o) { return JSON.parse(JSON.stringify(o)); }

const HEX = /^#[0-9a-fA-F]{6}$/;

// Merge an untrusted object into a fresh default config, keeping only keys
// that exist in the defaults, with matching types and clamped ranges.
export function validateConfig(input) {
  const base = createDefaultConfig();
  const warnings = [];
  walk(base, input, '');
  return { config: base, warnings };

  function walk(target, src, prefix) {
    if (!src || typeof src !== 'object') return;
    for (const key of Object.keys(target)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (!(key in src)) continue;
      const d = target[key];
      const v = src[key];
      if (d && typeof d === 'object') { walk(d, v, path); continue; }
      if (OPTIONS[path]) {
        if (OPTIONS[path].includes(v)) target[key] = v; else warnings.push(path);
        continue;
      }
      if (typeof d === 'number') {
        if (typeof v !== 'number' || !Number.isFinite(v)) { warnings.push(path); continue; }
        const r = RANGES[path];
        target[key] = r ? Math.min(r[1], Math.max(r[0], v)) : v;
      } else if (typeof d === 'boolean') {
        if (typeof v === 'boolean') target[key] = v; else warnings.push(path);
      } else if (typeof d === 'string') {
        if (typeof v !== 'string') { warnings.push(path); continue; }
        if (HEX.test(d) && !HEX.test(v)) { warnings.push(path); continue; }
        target[key] = v;
      }
    }
  }
}

// Copy values from src into target without replacing objects, so that
// anything bound to the target (the dev panel) keeps working.
export function assignDeep(target, src) {
  for (const key of Object.keys(src)) {
    if (src[key] && typeof src[key] === 'object' && target[key] && typeof target[key] === 'object') {
      assignDeep(target[key], src[key]);
    } else {
      target[key] = src[key];
    }
  }
  return target;
}
