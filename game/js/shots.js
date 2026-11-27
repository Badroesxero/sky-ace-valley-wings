"use strict";
/* shots.js — deterministic screenshot scenes. One job: when the page
   URL carries ?shot=start|play|end&seed=N, stage a fixed scene with
   the game's own modules (no human input, no randomness beyond the
   seeded PRNG below), so the same seed always renders the same frame.
   Without a ?shot= query this module does nothing and the game plays
   normally.

   Scenes:
   - start: mission briefing state — aircraft over the valley, terrain,
     first ring ahead, goal banner and briefing panel on screen.
   - play:  the real flight model stepped forward at a fixed dt under
     a simple autopilot that steers for the next ring, frozen mid-flight
     with the chase view, ring ahead and live instruments.
   - end:   the landing mission judged by the real judgeTouchdown —
     a smooth touchdown on the runway, campaign-complete end state. */
window.SkyAce = window.SkyAce || {};

SkyAce.Shots = (function () {
  var FIXED_DT = 1 / 30;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  /* mulberry32: tiny seeded PRNG, stable across browsers/Node. */
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function parseQuery() {
    try {
      var q = new URLSearchParams(window.location.search);
      var name = q.get("shot");
      if (!name) return null;
      var seed = parseInt(q.get("seed") || "1", 10);
      if (!isFinite(seed)) seed = 1;
      return { name: name, seed: seed };
    } catch (e) { return null; }
  }

  /* Steer toward a target the way a careful player would: bank toward
     the desired heading, pitch gently toward its altitude, and hold
     cruise speed with the throttle. */
  function autopilot(a, target, rand) {
    if (!target) return { pitch: 0, roll: 0, throttleDelta: 0 };
    var desired = Math.atan2(target.x - a.x, target.z - a.z);
    var diff = wrapAngle(desired - a.heading);
    var roll = clamp(diff * 1.4, -0.85, 0.85) + (rand() - 0.5) * 0.02;
    var pitch = clamp((target.y - a.y) * 0.012, -0.35, 0.45);
    var throttleDelta = a.speed < 48 ? 0.6 : (a.speed > 58 ? -0.6 : 0);
    return { pitch: pitch, roll: roll, throttleDelta: throttleDelta };
  }

  function stageStart(api) {
    var A = api.aircraft, T = SkyAce.Terrain;
    api.startMission(0);
    // Park the aircraft mid-valley, aligned with the river, first ring
    // ahead — the briefing panel and goal banner draw over this view.
    A.z = 350;
    A.x = T.valleyCenterX(A.z);
    A.y = 135;
    var slope = 320 * 0.0011 * Math.cos(A.z * 0.0011) +
                150 * 0.0037 * Math.cos(A.z * 0.0037 + 1.3);
    A.heading = Math.atan2(slope, 1);
    A.bank = 0.08; A.pitch = 0.02; A.speed = 52; A.throttle = 0.55;
    SkyAce.Render.resetCamera(A.heading);
    api.setState("briefing");
  }

  function stagePlay(api, seed) {
    var A = api.aircraft;
    var rand = rng(seed);
    api.startMission(0);
    api.launch();
    // 12 fixed seconds of real flight under the autopilot.
    var steps = Math.round(12 / FIXED_DT);
    for (var i = 0; i < steps; i++) {
      var m = SkyAce.Missions.current(api.progress);
      var target = m && m.targets[api.progress.nextTarget];
      api.stepWith(autopilot(A, target, rand), FIXED_DT);
      if (api.getState() !== "flying") break;
    }
    SkyAce.Render.resetCamera(A.heading);
  }

  function stageEnd(api) {
    var A = api.aircraft, T = SkyAce.Terrain;
    api.startMission(2); // the landing mission
    // Place the aircraft just after a gentle touchdown on the strip and
    // let the game's own touchdown judge decide the end state.
    A.x = T.RUNWAY.x; A.z = 4450;
    A.y = T.height(A.x, A.z);
    A.heading = 0; A.bank = 0; A.pitch = 0.02;
    A.speed = 24; A.verticalSpeed = -1.0; A.throttle = 0.12;
    var verdict = SkyAce.Missions.judgeTouchdown(A);
    if (verdict.result === "landing") api.endFlight("campaign", { reason: verdict.reason });
    else api.endFlight("crashed", { reason: verdict.reason });
    SkyAce.Render.resetCamera(A.heading);
  }

  /* Returns true when a shot was staged (caller should draw once and
     not start the live frame loop, so the frame stays exactly as
     staged). Returns false in normal play. */
  function applyIfRequested(api) {
    var q = parseQuery();
    if (!q) return false;
    if (q.name === "play") stagePlay(api, q.seed);
    else if (q.name === "end") stageEnd(api);
    else stageStart(api);
    return true;
  }

  return { applyIfRequested: applyIfRequested, parseQuery: parseQuery };
})();
