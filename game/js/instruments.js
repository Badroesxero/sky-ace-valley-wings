"use strict";
/* instruments.js — cockpit instruments. One job: draw working gauges
   from live aircraft readings — airspeed, altimeter, heading,
   throttle, vertical speed and an artificial horizon — plus the
   on-screen statement of the current mission goal. */
window.SkyAce = window.SkyAce || {};

SkyAce.Instruments = (function () {
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function dial(ctx, x, y, r, label, valueText, needleAngle, redFrom) {
    ctx.save();
    ctx.fillStyle = "rgba(10,16,34,.88)";
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#5f7bb0"; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = "#dbe9ff"; ctx.lineWidth = 2;
    for (var i = 0; i <= 10; i++) {
      var a = -Math.PI * 0.75 + i * Math.PI * 1.5 / 10;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * (r - 7), y + Math.sin(a) * (r - 7));
      ctx.lineTo(x + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2));
      ctx.stroke();
    }
    if (redFrom !== null && redFrom !== undefined) {
      ctx.strokeStyle = "#ff5a4d"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, r - 4, -Math.PI * 0.75 + redFrom * Math.PI * 1.5, -Math.PI * 0.75 + Math.PI * 1.5); ctx.stroke();
    }
    ctx.strokeStyle = "#ffd94d"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(needleAngle) * (r - 10), y + Math.sin(needleAngle) * (r - 10)); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "bold 13px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(valueText, x, y + r * 0.45);
    ctx.fillStyle = "#9fd0f5"; ctx.font = "10px Arial";
    ctx.fillText(label, x, y + r * 0.68);
    ctx.restore();
  }

  function angleFor(v, max) { return -Math.PI * 0.75 + clamp(v / max, 0, 1) * Math.PI * 1.5; }

  function draw(ctx, W, H, a, reading, mission, progress, muted) {
    // Bottom instrument panel.
    ctx.fillStyle = "rgba(7,12,28,.82)";
    ctx.fillRect(0, H - 104, W, 104);
    ctx.strokeStyle = "#26355f"; ctx.beginPath(); ctx.moveTo(0, H - 104); ctx.lineTo(W, H - 104); ctx.stroke();

    dial(ctx, 62, H - 52, 42, "AIRSPEED kt", String(Math.round(reading.knots)),
         angleFor(reading.knots, 180), 150 / 180);
    dial(ctx, 172, H - 52, 42, "ALTIMETER ft", String(Math.round(reading.altitudeFt)),
         angleFor(reading.altitudeFt, 1500), null);
    dial(ctx, 282, H - 52, 42, "HEADING", String(Math.round(reading.headingDeg)) + "°",
         -Math.PI / 2 + a.heading, null);

    // Artificial horizon.
    var hx = 392, hy = H - 52, hr = 42;
    ctx.save();
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.clip();
    ctx.translate(hx, hy); ctx.rotate(-a.bank);
    var pitchPx = clamp(a.pitch * 90, -30, 30);
    ctx.fillStyle = "#5ea9e6"; ctx.fillRect(-hr, -hr + pitchPx, hr * 2, hr * 2);
    ctx.fillStyle = "#8a6b42"; ctx.fillRect(-hr, pitchPx, hr * 2, hr * 2);
    ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.moveTo(-hr, pitchPx); ctx.lineTo(hr, pitchPx); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = "#ffd94d"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(hx - 16, hy); ctx.lineTo(hx - 5, hy); ctx.lineTo(hx, hy + 5); ctx.lineTo(hx + 5, hy); ctx.lineTo(hx + 16, hy); ctx.stroke();
    ctx.strokeStyle = "#5f7bb0"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#9fd0f5"; ctx.font = "10px Arial"; ctx.textAlign = "center";
    ctx.fillText("HORIZON", hx, hy + hr * 0.72);

    // Throttle gauge (vertical bar).
    var tx = 478, ty = H - 94;
    ctx.fillStyle = "#33415e"; ctx.fillRect(tx, ty, 22, 84);
    ctx.fillStyle = a.throttle > 0.85 ? "#ff9d4d" : "#57d977";
    var th = 84 * a.throttle;
    ctx.fillRect(tx + 2, ty + 84 - th + 2 - 2, 18, th - 2);
    ctx.fillStyle = "#fff"; ctx.font = "bold 12px Arial"; ctx.textAlign = "left";
    ctx.fillText("THR " + reading.throttlePct + "%", tx - 4, ty - 8 + 104 - 96);
    ctx.fillText("THROTTLE", tx - 10, H - 4);

    // Text readouts: VSI, AGL, stall warning.
    ctx.font = "bold 15px Arial"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText("VSI " + (reading.verticalFpm >= 0 ? "+" : "") + Math.round(reading.verticalFpm) + " fpm", 530, H - 78);
    ctx.fillText("AGL " + Math.max(0, Math.round(reading.aglFt)) + " ft", 530, H - 52);
    ctx.fillText("POS " + Math.round(a.z) + " m N / " + Math.round(a.x) + " m E", 530, H - 26);
    if (a.stalled) {
      ctx.fillStyle = (Math.floor(performance.now() / 300) % 2 === 0) ? "#ff5a4d" : "#ffd94d";
      ctx.font = "bold 20px Arial";
      ctx.fillText("⚠ STALL", 760, H - 78);
    }
    if (muted) { ctx.fillStyle = "#9fd0f5"; ctx.font = "13px Arial"; ctx.fillText("SOUND OFF (M)", 760, H - 26); }

    // Goal banner — the current goal is always stated on screen.
    if (mission) {
      ctx.fillStyle = "rgba(7,12,28,.72)";
      ctx.fillRect(0, 0, W, 54);
      ctx.fillStyle = "#ffd94d"; ctx.font = "bold 16px Arial"; ctx.textAlign = "left";
      ctx.fillText(mission.name, 14, 18);
      ctx.fillStyle = "#fff"; ctx.font = "14px Arial";
      var status = mission.goal;
      if (mission.type === "rings") status += "  •  Rings: " + progress.nextTarget + " / " + mission.targets.length;
      if (mission.type === "checkpoint") status += "  •  Time left: " + Math.max(0, Math.ceil(mission.timeLimit - progress.elapsed)) + " s";
      if (mission.type === "landing") status += "  •  Touchdown needs: on strip, < 32 m/s, sink > -3.5 m/s";
      ctx.fillText(status, 14, 40);
    }
  }

  return { draw: draw };
})();
