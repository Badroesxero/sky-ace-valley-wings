"use strict";
/* missions.js — goals and judging. One job: define the mission chain,
   track progress against the current goal, and judge endings —
   in particular telling a LANDING apart from a CRASH by touchdown
   speed, sink rate, alignment and position on the runway. */
window.SkyAce = window.SkyAce || {};

SkyAce.Missions = (function () {
  var T = SkyAce.Terrain;

  function ring(x, z, y, r) { return { x: x, z: z, y: y, r: r || 26, passed: false }; }

  var MISSIONS = [
    {
      id: "rings",
      name: "Mission 1 — Valley Rings",
      goal: "Fly through all 6 golden rings over the river valley.",
      brief: "Follow the valley north. Rings are generous — but only count in order.",
      type: "rings",
      targets: [600, 1050, 1500, 1950, 2400, 2850].map(function (z, i) {
        return ring(T.valleyCenterX(z), z, 105 + (i % 3) * 22);
      })
    },
    {
      id: "dash",
      name: "Mission 2 — Checkpoint Dash",
      goal: "Reach the far checkpoint beacon before the clock runs out.",
      brief: "Full throttle helps, but a straight line over the ridge does not. Stay in the valley, manage your speed in the turns.",
      type: "checkpoint",
      timeLimit: 95,
      targets: [ring(T.valleyCenterX(3600), 3600, 120, 42)]
    },
    {
      id: "landing",
      name: "Mission 3 — Land at Valley Field",
      goal: "Land gently on the runway at Valley Field, straight ahead to the north.",
      brief: "Runway threshold at 4,300 m north, strip runs to 5,100 m. Touch down ON the strip, aligned with it, below 32 m/s and sinking slower than 3.5 m/s — or it counts as a crash.",
      type: "landing",
      targets: []
    }
  ];

  function createProgress() {
    return { index: 0, nextTarget: 0, elapsed: 0, finished: false, message: "" };
  }

  function current(p) { return MISSIONS[p.index] || null; }

  function startMission(p, index) {
    p.index = index; p.nextTarget = 0; p.elapsed = 0; p.finished = false; p.message = "";
    var m = current(p);
    if (m) for (var i = 0; i < m.targets.length; i++) m.targets[i].passed = false;
    return m;
  }

  /* Ring/checkpoint crossing: was the aircraft inside the disc when it
     crossed the target's z-plane this step? */
  function crossed(a, prevZ, target) {
    var crossedPlane = (prevZ - target.z) * (a.z - target.z) <= 0 && prevZ !== a.z;
    if (!crossedPlane && Math.abs(a.z - target.z) > 4) return false;
    var dx = a.x - target.x, dy = a.y - target.y;
    return dx * dx + dy * dy <= target.r * target.r;
  }

  /* Returns an event string or null: "target", "complete", "timeout". */
  function update(p, a, prevZ, dt) {
    var m = current(p);
    if (!m || p.finished) return null;
    p.elapsed += dt;
    if (m.type === "checkpoint" && p.elapsed > m.timeLimit) { p.finished = true; return "timeout"; }
    var t = m.targets[p.nextTarget];
    if (t && crossed(a, prevZ, t)) {
      t.passed = true; p.nextTarget += 1;
      if (p.nextTarget >= m.targets.length) { p.finished = true; return "complete"; }
      return "target";
    }
    return null;
  }

  /* Judge a ground contact. a = aircraft at contact.
     Returns {result:"landing"|"crash", reason:string}. */
  function judgeTouchdown(a) {
    var onStrip = T.isOnRunway(a.x, a.z);
    var alongStrip = Math.abs(Math.sin(a.heading)) < 0.38; // mostly along the strip direction
    if (!onStrip) return { result: "crash", reason: "You came down off the runway." };
    if (a.speed > 32) return { result: "crash", reason: "Too fast on touchdown — " + Math.round(a.speed) + " m/s. Bleed speed before the strip." };
    if (a.verticalSpeed < -3.5) return { result: "crash", reason: "Too hard a touchdown — sink rate " + a.verticalSpeed.toFixed(1) + " m/s." };
    if (!alongStrip) return { result: "crash", reason: "Not aligned with the runway heading." };
    return { result: "landing", reason: "Smooth touchdown at " + Math.round(a.speed) + " m/s, sink " + a.verticalSpeed.toFixed(1) + " m/s." };
  }

  return { MISSIONS: MISSIONS, createProgress: createProgress, current: current,
           startMission: startMission, update: update, judgeTouchdown: judgeTouchdown };
})();
