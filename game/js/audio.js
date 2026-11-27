"use strict";
/* audio.js — all sound is synthesised with WebAudio. No audio files.
   One job: engine hum tied to throttle, wind tied to airspeed, and
   short event cues (ring, checkpoint, success, crash, click). */
window.SkyAce = window.SkyAce || {};

SkyAce.Audio = (function () {
  var ctx = null, engineOsc = null, engineGain = null, windGain = null, muted = false;

  function ensure() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return true; }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = "sawtooth";
      var filter = ctx.createBiquadFilter();
      filter.type = "lowpass"; filter.frequency.value = 420;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engineOsc.connect(filter); filter.connect(engineGain); engineGain.connect(ctx.destination);
      engineOsc.start();
      // Wind: looped noise buffer through a bandpass.
      var len = ctx.sampleRate;
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      var noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
      var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 800;
      windGain = ctx.createGain(); windGain.gain.value = 0;
      noise.connect(bp); bp.connect(windGain); windGain.connect(ctx.destination);
      noise.start();
      return true;
    } catch (e) { return false; }
  }

  function update(throttle, speedKnots, running) {
    if (!ctx || muted) return;
    var t = ctx.currentTime;
    engineOsc.frequency.setTargetAtTime(55 + throttle * 95, t, 0.1);
    engineGain.gain.setTargetAtTime(running ? 0.015 + throttle * 0.05 : 0, t, 0.1);
    windGain.gain.setTargetAtTime(running ? Math.min(0.05, speedKnots / 4000) : 0, t, 0.2);
  }

  function beep(freq, dur, type, vol, when) {
    if (!ctx || muted) return;
    var t = ctx.currentTime + (when || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur);
  }

  return {
    ensure: ensure,
    update: update,
    ring: function () { beep(880, 0.15, "sine", 0.09); beep(1320, 0.2, "sine", 0.07, 0.08); },
    checkpoint: function () { beep(660, 0.12, "square", 0.05); beep(990, 0.18, "square", 0.05, 0.1); },
    success: function () { beep(523, 0.18, "triangle", 0.09); beep(659, 0.18, "triangle", 0.09, 0.15); beep(784, 0.3, "triangle", 0.09, 0.3); },
    crash: function () { beep(110, 0.5, "sawtooth", 0.12); beep(55, 0.7, "square", 0.1, 0.05); },
    toggleMute: function () {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      if (windGain) windGain.gain.value = 0;
      return muted;
    },
    isMuted: function () { return muted; }
  };
})();
