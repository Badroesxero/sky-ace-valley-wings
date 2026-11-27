"use strict";
/* main.js — game state and loop. One job: wire the modules together —
   states (briefing, flying, paused, crashed, landed, complete),
   ground contact, mission events, and the frame loop. */
(function () {
  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var W = canvas.width, H = canvas.height;

  var A = SkyAce.Aircraft.create();
  var progress = SkyAce.Missions.createProgress();
  var state = "briefing"; // briefing | flying | paused | crashed | landed | complete | campaign
  var endInfo = null;
  var lastTime = 0, time = 0;
  var camSnap = true;

  function startMission(index) {
    SkyAce.Aircraft.reset(A);
    SkyAce.Missions.startMission(progress, index);
    SkyAce.Render.resetCamera(A.heading);
    endInfo = null;
    state = "briefing";
    SkyAce.Audio.ensure();
  }

  function launch() { if (state === "briefing") state = "flying"; }

  function togglePause() {
    if (state === "flying") state = "paused";
    else if (state === "paused") state = "flying";
  }

  function endFlight(kind, info) {
    state = kind; endInfo = info || {};
    if (kind === "crashed") SkyAce.Audio.crash();
    if (kind === "landed" || kind === "complete" || kind === "campaign") SkyAce.Audio.success();
  }

  function checkGround() {
    var ground = SkyAce.Terrain.height(A.x, A.z);
    if (A.y > ground + 1.2) return;
    A.y = ground;
    var m = SkyAce.Missions.current(progress);
    if (m && m.type === "landing") {
      var verdict = SkyAce.Missions.judgeTouchdown(A);
      if (verdict.result === "landing") endFlight("campaign", { reason: verdict.reason });
      else endFlight("crashed", { reason: verdict.reason });
    } else if (SkyAce.Terrain.isOnRunway(A.x, A.z) && A.verticalSpeed > -3.5 && A.speed <= 32) {
      endFlight("landed", { reason: "Off-mission landing on the strip. Nice touch." });
    } else {
      endFlight("crashed", { reason: "You hit the terrain at " + Math.round(A.speed) + " m/s." });
    }
  }

  /* One fixed step with an explicit control object — used by the live
     loop (keyboard control) and by shots.js (autopilot control). */
  function stepWith(control, dt) {
    time += dt;
    var prevZ = A.z;
    SkyAce.Aircraft.step(A, control, dt);
    var ev = SkyAce.Missions.update(progress, A, prevZ, dt);
    if (ev === "target") SkyAce.Audio.ring();
    if (ev === "complete") {
      var m = SkyAce.Missions.current(progress);
      if (m.type === "checkpoint") SkyAce.Audio.checkpoint();
      if (progress.index + 1 < SkyAce.Missions.MISSIONS.length) endFlight("complete", {});
      else endFlight("campaign", {});
    }
    if (ev === "timeout") endFlight("crashed", { reason: "Time ran out before the checkpoint." });
    if (state === "flying") checkGround();
    var r = SkyAce.Aircraft.readings(A);
    SkyAce.Audio.update(A.throttle, r.knots, state === "flying");
  }

  function update(dt) { stepWith(SkyAce.Input.sample(dt), dt); }

  function centerText(text, y, font, color) {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, W / 2, y);
  }
  function panel(alpha) { ctx.fillStyle = "rgba(7,13,32," + alpha + ")"; ctx.fillRect(0, 0, W, H); }

  function draw() {
    var dtFrame = 0.016;
    SkyAce.Render.draw(ctx, W, H, A, SkyAce.Missions.current(progress), progress,
                       state === "flying" ? dtFrame : 0, time);
    var r = SkyAce.Aircraft.readings(A);
    SkyAce.Instruments.draw(ctx, W, H, A, r, SkyAce.Missions.current(progress), progress,
                            SkyAce.Audio.isMuted());
    var m = SkyAce.Missions.current(progress);
    if (state === "briefing" && m) {
      panel(0.55);
      centerText("SKY ACE — VALLEY WINGS", 150, "bold 40px Arial", "#ffd94d");
      centerText(m.name, 205, "bold 24px Arial", "#ffffff");
      centerText(m.goal, 245, "17px Arial", "#dbe9ff");
      centerText(m.brief, 278, "15px Arial", "#bcd0f5");
      centerText("↑ climb   ↓ descend   ← → bank & turn   W/S throttle", 330, "17px Arial", "#ffffff");
      centerText("Discipline matters: climbing costs speed, speed buys turn rate,", 362, "15px Arial", "#dbe9ff");
      centerText("and a landing only counts slow, gentle and aligned.", 386, "15px Arial", "#dbe9ff");
      centerText("Press ENTER or click Start to fly", 440, "bold 21px Arial", "#ffd94d");
    } else if (state === "paused") {
      panel(0.5);
      centerText("PAUSED", 250, "bold 48px Arial", "#ffffff");
      centerText("Press P to resume", 305, "20px Arial", "#dbe9ff");
    } else if (state === "crashed") {
      panel(0.6);
      centerText("CRASHED", 210, "bold 52px Arial", "#ff6b6b");
      centerText(endInfo && endInfo.reason ? endInfo.reason : "", 275, "19px Arial", "#ffffff");
      centerText("Press R to retry " + (m ? m.name : ""), 330, "bold 20px Arial", "#ffd94d");
    } else if (state === "landed" || state === "complete" || state === "campaign") {
      panel(0.55);
      centerText(state === "campaign" ? "CAMPAIGN COMPLETE!" : "MISSION COMPLETE!", 200, "bold 44px Arial", "#7CFC98");
      if (endInfo && endInfo.reason) centerText(endInfo.reason, 252, "18px Arial", "#ffffff");
      if (state === "complete") centerText("Press ENTER for the next mission", 310, "bold 21px Arial", "#ffd94d");
      if (state === "campaign") centerText("You flew the rings, beat the clock and landed. Press R to fly Mission 1 again.", 310, "17px Arial", "#dbe9ff");
      if (state === "landed") centerText("Press R to retry this mission", 310, "bold 20px Arial", "#ffd94d");
    }
  }

  function frame(ts) {
    var dt = Math.min(0.033, (ts - lastTime) / 1000 || 0);
    lastTime = ts;
    if (state === "flying") update(dt); else time += dt;
    draw();
    requestAnimationFrame(frame);
  }

  SkyAce.Input.attach({
    onStart: function () {
      SkyAce.Audio.ensure();
      if (state === "briefing") launch();
      else if (state === "complete") startMission(progress.index + 1), launch();
      else if (state === "crashed" || state === "landed" || state === "campaign") startMission(state === "campaign" ? 0 : progress.index);
    },
    onPause: togglePause,
    onRestart: function () { startMission(progress.index); launch(); },
    onMute: function () { SkyAce.Audio.ensure(); SkyAce.Audio.toggleMute(); }
  });
  canvas.addEventListener("click", function () {
    SkyAce.Audio.ensure();
    if (state === "briefing") launch();
    else if (state === "paused") state = "flying";
  });
  document.getElementById("startBtn").addEventListener("click", function () {
    SkyAce.Audio.ensure();
    if (state === "complete") { startMission(progress.index + 1); launch(); }
    else if (state === "briefing") launch();
    else startMission(progress.index);
  });
  document.getElementById("pauseBtn").addEventListener("click", togglePause);
  window.addEventListener("blur", function () { if (state === "flying") state = "paused"; });

  startMission(0);
  state = "briefing";
  /* Screenshot mode (?shot=start|play|end&seed=N): stage the fixed
     scene and draw it once — no live loop, so the frame is exactly
     the staged one. Normal play is untouched. */
  var shotStaged = SkyAce.Shots && SkyAce.Shots.applyIfRequested({
    aircraft: A, progress: progress,
    startMission: startMission, launch: launch,
    stepWith: stepWith, endFlight: endFlight,
    setState: function (s) { state = s; },
    getState: function () { return state; }
  });
  if (shotStaged) draw();
  else requestAnimationFrame(frame);
})();
