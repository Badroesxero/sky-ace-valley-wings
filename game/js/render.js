"use strict";
/* render.js — the chase view. One job: project the 3D world onto the
   canvas from a camera behind and above the aircraft, and draw sky,
   terrain, river, runway, targets and the aircraft itself.
   The camera heading trails the aircraft heading (lag + smoothing),
   so the camera never fights the pilot in a turn. */
window.SkyAce = window.SkyAce || {};

SkyAce.Render = (function () {
  var T = SkyAce.Terrain;
  var COLORS = {
    water: "#2e7cc4", meadow: "#69b464", grass: "#4c914f",
    forest: "#2f6b3a", rock: "#8d8578", snow: "#eef4f8", runway: "#3c4148"
  };
  var camHeading = 0;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerpAngle(a, b, t) {
    var d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return a + d * t;
  }
  function resetCamera(heading) { camHeading = heading; }

  /* Camera state for this frame: behind (-26 m) and above (+9 m). */
  function cameraFor(a, dt) {
    camHeading = lerpAngle(camHeading, a.heading, Math.min(1, dt * 3.2));
    var fx = Math.sin(camHeading), fz = Math.cos(camHeading);
    return {
      x: a.x - fx * 26, y: a.y + 9, z: a.z - fz * 26,
      fx: fx, fz: fz, heading: camHeading
    };
  }

  function makeProjector(cam, W, H) {
    var focal = H * 1.15;
    var horizon = H * 0.46;
    var cosH = Math.cos(cam.heading), sinH = Math.sin(cam.heading);
    return function (wx, wy, wz) {
      var dx = wx - cam.x, dy = wy - cam.y, dz = wz - cam.z;
      var rx = dx * cosH - dz * sinH;
      var rz = dx * sinH + dz * cosH;
      if (rz < 2) return null;
      var s = focal / rz;
      return { x: W / 2 + rx * s, y: horizon - dy * s, s: s, rz: rz };
    };
  }

  function drawSky(ctx, W, H, time) {
    var g = ctx.createLinearGradient(0, 0, 0, H * 0.7);
    g.addColorStop(0, "#3f8fd2"); g.addColorStop(0.7, "#9fd0f5"); g.addColorStop(1, "#dff1ff");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff3a6";
    ctx.beginPath(); ctx.arc(W - 120, 74, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,243,166,.3)";
    ctx.beginPath(); ctx.arc(W - 120, 74, 48, 0, Math.PI * 2); ctx.fill();
  }

  function drawClouds(ctx, project, a) {
    ctx.fillStyle = "rgba(255,255,255,.9)";
    for (var i = 0; i < 22; i++) {
      var c = T.cloudAt(i);
      var cz = a.z - ((a.z - c.zOffset) % 4000 + 4000) % 4000 + 300 + (i % 7) * 260;
      var p = project(c.x, c.y, cz);
      if (!p) continue;
      var r = 26 * c.scale * p.s / 10;
      if (r < 2 || r > 260) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.arc(p.x + r * 0.9, p.y + r * 0.1, r * 0.75, 0, Math.PI * 2);
      ctx.arc(p.x - r * 0.9, p.y + r * 0.12, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* Terrain as projected quad strips, far to near (painter's order). */
  function drawTerrain(ctx, project, cam) {
    var slices = [];
    var d = 24;
    while (d < 1500) { slices.push(d); d *= 1.22; }
    slices.push(1500);
    var SEG = 14;
    for (var si = slices.length - 2; si >= 0; si--) {
      var d0 = slices[si], d1 = slices[si + 1];
      var w0 = d0 * 1.25 + 120, w1 = d1 * 1.25 + 120;
      for (var k = 0; k < SEG; k++) {
        var f0 = k / SEG, f1 = (k + 1) / SEG;
        var pts = [];
        var corners = [
          [cam.x + cam.fx * d0 + (-cam.fz) * (-w0 + 2 * w0 * f0), cam.z + cam.fz * d0 + cam.fx * (-w0 + 2 * w0 * f0)],
          [cam.x + cam.fx * d0 + (-cam.fz) * (-w0 + 2 * w0 * f1), cam.z + cam.fz * d0 + cam.fx * (-w0 + 2 * w0 * f1)],
          [cam.x + cam.fx * d1 + (-cam.fz) * (-w1 + 2 * w1 * f1), cam.z + cam.fz * d1 + cam.fx * (-w1 + 2 * w1 * f1)],
          [cam.x + cam.fx * d1 + (-cam.fz) * (-w1 + 2 * w1 * f0), cam.z + cam.fz * d1 + cam.fx * (-w1 + 2 * w1 * f0)]
        ];
        var ok = true;
        for (var ci = 0; ci < 4; ci++) {
          var wx = corners[ci][0], wz = corners[ci][1];
          var p = project(wx, T.height(wx, wz), wz);
          if (!p) { ok = false; break; }
          pts.push(p);
        }
        if (!ok) continue;
        var cxm = (corners[0][0] + corners[2][0]) / 2, czm = (corners[0][1] + corners[2][1]) / 2;
        var surf = T.surfaceAt(cxm, czm);
        ctx.fillStyle = COLORS[surf];
        // Cheap distance shading / haze.
        ctx.globalAlpha = clamp(1.15 - d0 / 1600, 0.45, 1);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y);
        ctx.lineTo(pts[2].x, pts[2].y); ctx.lineTo(pts[3].x, pts[3].y);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
        if (surf === "runway" && Math.round(czm) % 60 < 30) {
          // Dashed centreline hint on the strip.
          ctx.fillStyle = "rgba(255,255,255,.65)";
          var pc = project(T.RUNWAY.x, T.RUNWAY.elevation + 0.4, czm);
          if (pc) ctx.fillRect(pc.x - 1.5, pc.y - 1, 3, 2);
        }
      }
    }
  }

  function drawTarget(ctx, project, target, isNext, time) {
    var pts = [];
    for (var i = 0; i < 24; i++) {
      var ang = i / 24 * Math.PI * 2;
      var p = project(target.x + Math.cos(ang) * target.r, target.y + Math.sin(ang) * target.r, target.z);
      if (!p) return;
      pts.push(p);
    }
    ctx.strokeStyle = target.passed ? "rgba(120,220,140,.5)" :
      (isNext ? "#ffd94d" : "rgba(255,217,77,.45)");
    ctx.lineWidth = isNext ? 5 : 3;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
    ctx.closePath(); ctx.stroke();
    if (isNext) {
      var pc = project(target.x, target.y, target.z);
      if (pc) {
        ctx.fillStyle = "#ffd94d"; ctx.font = "bold 14px Arial"; ctx.textAlign = "center";
        ctx.fillText("▼ NEXT", pc.x, pc.y - target.r * pc.s - 8);
      }
    }
  }

  /* The aircraft, drawn from behind: built, not a box — tapered
     fuselage, swept wings, tailplane, fin, canopy, spinning prop
     disc, nav lights and gear that drops at low speed. */
  function drawAircraft(ctx, W, H, a, time) {
    var cx = W / 2, cy = H * 0.62;
    var s = 1.5;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a.bank * 0.85);
    ctx.translate(0, clamp(-a.pitch * 60, -22, 22));
    ctx.scale(s, s);
    // Prop disc (behind, at the nose — drawn as a faint ellipse arc above fuselage top is wrong
    // for a rear view, so the prop is shown as a blurred disc facing us).
    ctx.fillStyle = "rgba(230,238,248,.20)";
    ctx.beginPath(); ctx.ellipse(0, -2, 30, 30, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(30,30,40,.5)"; ctx.lineWidth = 2;
    var pa = a.propPhase % (Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(Math.cos(pa) * -28, -2 + Math.sin(pa) * -28);
    ctx.lineTo(Math.cos(pa) * 28, -2 + Math.sin(pa) * 28);
    ctx.stroke();
    // Main wings.
    ctx.fillStyle = "#c93325";
    ctx.beginPath();
    ctx.moveTo(-64, 10); ctx.lineTo(-14, 2); ctx.lineTo(14, 2); ctx.lineTo(64, 10);
    ctx.lineTo(58, 18); ctx.lineTo(-58, 18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#a5271c";
    ctx.fillRect(-64, 10, 10, 8); ctx.fillRect(54, 10, 10, 8);
    // Nav lights.
    ctx.fillStyle = "#ff4040"; ctx.beginPath(); ctx.arc(-63, 13, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#40ff70"; ctx.beginPath(); ctx.arc(63, 13, 3, 0, Math.PI * 2); ctx.fill();
    // Tailplane.
    ctx.fillStyle = "#c93325";
    ctx.beginPath();
    ctx.moveTo(-26, -16); ctx.lineTo(0, -20); ctx.lineTo(26, -16); ctx.lineTo(22, -10); ctx.lineTo(-22, -10); ctx.closePath(); ctx.fill();
    // Fuselage (tapered, seen from behind).
    var grad = ctx.createLinearGradient(-14, 0, 14, 0);
    grad.addColorStop(0, "#d63b2f"); grad.addColorStop(0.5, "#f4684f"); grad.addColorStop(1, "#d63b2f");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.ellipse(0, 0, 14, 20, 0, 0, Math.PI * 2); ctx.fill();
    // Fin.
    ctx.fillStyle = "#ffd94d";
    ctx.beginPath(); ctx.moveTo(-3, -18); ctx.lineTo(0, -34); ctx.lineTo(4, -18); ctx.closePath(); ctx.fill();
    // Canopy.
    ctx.fillStyle = "#bfe8ff";
    ctx.beginPath(); ctx.ellipse(0, -8, 7, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.65)";
    ctx.beginPath(); ctx.ellipse(-2, -11, 2.5, 4, 0, 0, Math.PI * 2); ctx.fill();
    // Exhausts + gear at low speed.
    ctx.fillStyle = "#333";
    ctx.fillRect(-9, 16, 3, 4); ctx.fillRect(6, 16, 3, 4);
    if (a.speed < 40) {
      ctx.strokeStyle = "#222"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-8, 18); ctx.lineTo(-10, 27); ctx.moveTo(8, 18); ctx.lineTo(10, 27); ctx.stroke();
      ctx.fillStyle = "#111";
      ctx.beginPath(); ctx.arc(-10, 28, 4, 0, Math.PI * 2); ctx.arc(10, 28, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function draw(ctx, W, H, a, mission, progress, dt, time) {
    var cam = cameraFor(a, dt);
    var project = makeProjector(cam, W, H);
    drawSky(ctx, W, H, time);
    drawClouds(ctx, project, a);
    drawTerrain(ctx, project, cam);
    if (mission) {
      for (var i = 0; i < mission.targets.length; i++) {
        drawTarget(ctx, project, mission.targets[i], i === progress.nextTarget, time);
      }
    }
    drawAircraft(ctx, W, H, a, time);
  }

  return { draw: draw, resetCamera: resetCamera };
})();
