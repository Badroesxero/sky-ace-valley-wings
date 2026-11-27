"use strict";
/* input.js — keyboard state only. One job: turn key events into a
   normalised control object the aircraft physics can read.
   Pitch/roll are smoothed here just enough to feel analogue while
   staying responsive (fast attack, slightly slower release). */
window.SkyAce = window.SkyAce || {};

SkyAce.Input = (function () {
  var keys = {};
  var pitch = 0;   // -1 (descend) .. +1 (climb)
  var roll = 0;    // -1 (bank left) .. +1 (bank right)
  var throttleDelta = 0;

  function onKeyDown(ev) {
    var k = (ev.key || "").toLowerCase();
    keys[k] = true;
    if (k === " " || k.indexOf("arrow") === 0) ev.preventDefault();
  }
  function onKeyUp(ev) { keys[(ev.key || "").toLowerCase()] = false; }
  function clear() { keys = {}; pitch = 0; roll = 0; throttleDelta = 0; }

  function attach(handlers) {
    document.addEventListener("keydown", function (ev) {
      onKeyDown(ev);
      var k = (ev.key || "").toLowerCase();
      if (handlers) {
        if (k === "enter" && handlers.onStart) handlers.onStart();
        if ((k === "p" || k === "escape") && handlers.onPause) handlers.onPause();
        if (k === "r" && handlers.onRestart) handlers.onRestart();
        if (k === "m" && handlers.onMute) handlers.onMute();
      }
    });
    document.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clear);
  }

  function approach(cur, target, rate, dt) {
    var step = rate * dt;
    if (cur < target) return Math.min(target, cur + step);
    if (cur > target) return Math.max(target, cur - step);
    return cur;
  }

  /* Call once per frame. Returns {pitch, roll, throttleDelta}. */
  function sample(dt) {
    var pTarget = 0, rTarget = 0;
    if (keys["arrowup"]) pTarget += 1;
    if (keys["arrowdown"]) pTarget -= 1;
    if (keys["arrowleft"] || keys["a"]) rTarget -= 1;
    if (keys["arrowright"] || keys["d"]) rTarget += 1;
    // Fast attack (10/s) keeps controls responsive at every speed.
    pitch = approach(pitch, Math.max(-1, Math.min(1, pTarget)), 10, dt);
    roll = approach(roll, Math.max(-1, Math.min(1, rTarget)), 10, dt);
    throttleDelta = 0;
    if (keys["w"] || keys["e"]) throttleDelta += 1;
    if (keys["s"] || keys["q"]) throttleDelta -= 1;
    return { pitch: pitch, roll: roll, throttleDelta: throttleDelta };
  }

  return { attach: attach, sample: sample, clear: clear, keys: keys };
})();
