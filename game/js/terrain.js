"use strict";
/* terrain.js — the world. One job: define the recognisable landscape
   every other module queries — a winding river valley between ridges,
   and one flat runway strip — plus deterministic cloud positions.
   Pure functions of (x, z): no randomness at run time, so the valley
   looks the same on every flight. Units are metres. +z is north. */
window.SkyAce = window.SkyAce || {};

SkyAce.Terrain = (function () {
  var RUNWAY = { x: 0, halfWidth: 22, zStart: 4300, zEnd: 5100, elevation: 8 };
  var RIVER_HALF = 55;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function smoothstep(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  /* Centre line of the valley / river at a given z. */
  function valleyCenterX(z) {
    return 320 * Math.sin(z * 0.0011) + 150 * Math.sin(z * 0.0037 + 1.3);
  }

  function isOnRunway(x, z) {
    return Math.abs(x - RUNWAY.x) <= RUNWAY.halfWidth && z >= RUNWAY.zStart && z <= RUNWAY.zEnd;
  }
  function isInRunwayArea(x, z) { // includes a flattened apron around the strip
    return Math.abs(x - RUNWAY.x) <= 90 && z >= RUNWAY.zStart - 250 && z <= RUNWAY.zEnd + 250;
  }
  function isRiver(x, z) { return Math.abs(x - valleyCenterX(z)) <= RIVER_HALF; }

  /* Ground elevation in metres above sea level. */
  function height(x, z) {
    var dValley = Math.abs(x - valleyCenterX(z));
    // Rolling floor of the valley.
    var floor = 6 + 4 * Math.sin(z * 0.004) + 3 * Math.sin(x * 0.01 + z * 0.002);
    // Ridges climb steeply away from the valley, with craggy detail.
    var rise = Math.pow(smoothstep(90, 700, dValley), 1.6) * 300;
    var crag = (Math.sin(x * 0.008 + 2.0) * Math.cos(z * 0.006) +
                0.5 * Math.sin(x * 0.021 - z * 0.013)) * 26 * smoothstep(120, 500, dValley);
    var h = floor + rise + crag;
    // Gentle start basin so take-off is not a wall.
    h *= smoothstep(-50, 500, z) * 0.85 + 0.15;
    // Flatten toward the runway strip and its apron.
    if (isInRunwayArea(x, z)) {
      var blend = smoothstep(90, 30, Math.abs(x - RUNWAY.x)) *
                  smoothstep(RUNWAY.zStart - 250, RUNWAY.zStart - 40, z) *
                  smoothstep(RUNWAY.zEnd + 250, RUNWAY.zEnd + 40, z);
      h = h * (1 - blend) + RUNWAY.elevation * blend;
    }
    return h;
  }

  /* Surface kind at a point — drives terrain colouring in render.js. */
  function surfaceAt(x, z) {
    if (isOnRunway(x, z)) return "runway";
    if (isRiver(x, z) && height(x, z) < 26) return "water";
    var h = height(x, z);
    if (h < 22) return "meadow";
    if (h < 80) return "grass";
    if (h < 165) return "forest";
    if (h < 250) return "rock";
    return "snow";
  }

  /* Deterministic pseudo-random clouds, stable per index. */
  function cloudAt(i) {
    var s = Math.sin(i * 127.1) * 43758.5453;
    var fx = s - Math.floor(s);
    var s2 = Math.sin(i * 311.7) * 12543.123;
    var fz = s2 - Math.floor(s2);
    return { x: (fx - 0.5) * 2600, y: 260 + (i % 5) * 36, zOffset: fz * 4000, scale: 0.7 + (i % 4) * 0.25 };
  }

  return {
    RUNWAY: RUNWAY,
    height: height,
    valleyCenterX: valleyCenterX,
    isOnRunway: isOnRunway,
    isRiver: isRiver,
    surfaceAt: surfaceAt,
    cloudAt: cloudAt
  };
})();
