"use strict";
/* aircraft.js — flight model. One job: own the aircraft state and
   step its physics. Design goals from the brief:
   - Throttle discipline pays: thrust vs drag vs gravity on the pitch
     means climbing flat-out still bleeds speed; dives gain it.
   - Banking turns: turn rate comes from bank angle and airspeed, so
     wide fast turns and tight slow turns feel different.
   - Controls stay authoritative at every speed (authority is floored),
     but a genuine stall below ~22 m/s drops the nose and sinks.
   Units: metres, m/s, radians. Heading 0 = north (+z), + = east. */
window.SkyAce = window.SkyAce || {};

SkyAce.Aircraft = (function () {
  var G = 9.81;
  var MIN_SPEED = 14, MAX_SPEED = 95, STALL_SPEED = 22;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function create() {
    return {
      x: 0, y: 130, z: 0,                 // altitude y is ASL; start airborne over the valley
      heading: 0,                          // radians
      pitch: 0,                            // radians, + = nose up
      bank: 0,                             // radians, + = right wing down
      speed: 52,                           // m/s airspeed
      verticalSpeed: 0,                    // m/s, + = climbing
      throttle: 0.55,                      // 0..1
      stalled: false,
      propPhase: 0
    };
  }

  function reset(a) {
    var fresh = create();
    for (var k in fresh) a[k] = fresh[k];
    return a;
  }

  /* control: {pitch:-1..1, roll:-1..1, throttleDelta:-1..1} */
  function step(a, control, dt) {
    a.throttle = clamp(a.throttle + control.throttleDelta * dt * 0.55, 0, 1);

    // Control authority: full at cruise, floored at 55% so the plane
    // always answers, reduced (not removed) in a stall.
    var authority = a.stalled ? 0.45 : clamp(0.55 + a.speed / 90, 0.55, 1);

    var targetBank = control.roll * 1.05;               // ~60 degrees max
    a.bank += (targetBank - a.bank) * Math.min(1, dt * 7 * authority + dt * 2);
    var targetPitch = control.pitch * 0.38 - (a.stalled ? 0.22 : 0);
    a.pitch += (targetPitch - a.pitch) * Math.min(1, dt * 6 * authority + dt * 2);

    // Coordinated turn from bank; slower flight turns tighter.
    var turnRate = Math.tan(a.bank) * G / Math.max(a.speed, 16);
    a.heading += turnRate * dt;

    // Airspeed: engine thrust, parasite drag, and gravity along pitch.
    var thrust = a.throttle * 11.5;
    var drag = 0.0038 * a.speed * a.speed + 0.6;
    var gravityAlong = -Math.sin(a.pitch) * G;
    a.speed = clamp(a.speed + (thrust - drag + gravityAlong) * dt, MIN_SPEED, MAX_SPEED);

    // Vertical speed from pitch, minus sink that grows when slow.
    var sink = a.speed < 34 ? (34 - a.speed) * 0.16 : 0;
    a.verticalSpeed = Math.sin(a.pitch) * a.speed - sink;
    a.stalled = a.speed < STALL_SPEED;
    if (a.stalled) a.verticalSpeed -= (STALL_SPEED - a.speed) * 0.35;

    var hSpeed = Math.cos(a.pitch) * a.speed;
    a.x += Math.sin(a.heading) * hSpeed * dt;
    a.z += Math.cos(a.heading) * hSpeed * dt;
    a.y += a.verticalSpeed * dt;
    a.propPhase += dt * (6 + a.throttle * 46);
    return a;
  }

  /* Derived instrument readings. */
  function readings(a) {
    return {
      knots: a.speed * 1.94384,
      altitudeFt: a.y * 3.28084,
      headingDeg: ((a.heading * 180 / Math.PI) % 360 + 360) % 360,
      verticalFpm: a.verticalSpeed * 196.85,
      throttlePct: Math.round(a.throttle * 100),
      groundHeight: SkyAce.Terrain.height(a.x, a.z),
      aglFt: (a.y - SkyAce.Terrain.height(a.x, a.z)) * 3.28084
    };
  }

  return { create: create, reset: reset, step: step, readings: readings,
           STALL_SPEED: STALL_SPEED };
})();
