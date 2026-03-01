/**
 * Space Shuttle Physics Simulator - Heads-Up Display
 * Updates the HUD with real-time telemetry data from the shuttle state.
 */
(function (global) {
  'use strict';

  class HUD {
    constructor() {
      // Cache all DOM element references
      this.elements = {
        met: document.getElementById('met-value'),
        missionLabel: document.getElementById('mission-label'),
        warp: document.getElementById('warp-value'),
        altitude: document.getElementById('altitude-value'),
        velocity: document.getElementById('velocity-value'),
        apoapsis: document.getElementById('apoapsis-value'),
        periapsis: document.getElementById('periapsis-value'),
        inclination: document.getElementById('inclination-value'),
        eccentricity: document.getElementById('eccentricity-value'),
        mass: document.getElementById('mass-value'),
        fuel: document.getElementById('fuel-value'),
        fuelFill: document.getElementById('fuel-fill'),
        thrust: document.getElementById('thrust-value'),
        gforce: document.getElementById('gforce-value'),
        pitch: document.getElementById('pitch-value'),
        yaw: document.getElementById('yaw-value'),
        roll: document.getElementById('roll-value'),
        atmDensity: document.getElementById('atm-density-value'),
        temp: document.getElementById('temp-value'),
        drag: document.getElementById('drag-value'),
        heat: document.getElementById('heat-value'),
        throttleFill: document.getElementById('throttle-fill'),
        throttlePct: document.getElementById('throttle-pct'),
        attitudeCanvas: document.getElementById('attitude-indicator')
      };

      const canvas = this.elements.attitudeCanvas;
      this.attitudeCtx = canvas ? canvas.getContext('2d') : null;
    }

    update(state, timeWarp) {
      if (!state) return;

      // MET (Mission Elapsed Time) - format as HH:MM:SS
      const met = state.met ?? 0;
      if (this.elements.met) this.elements.met.textContent = this.formatTime(met);

      // Time warp display
      if (this.elements.warp) {
        this.elements.warp.textContent = (timeWarp || 1) + 'x';
      }

      // Altitude - format as km with 1 decimal
      const altitude = state.altitude ?? 0;
      if (this.elements.altitude) {
        this.elements.altitude.textContent = (altitude / 1000).toFixed(1) + ' km';
      }

      // Velocity - format as m/s with 0 decimals
      const speed = state.speed ?? 0;
      if (this.elements.velocity) {
        this.elements.velocity.textContent = Math.round(speed) + ' m/s';
      }

      // Orbital elements
      const orb = state.orbitalElements || {};
      const apoapsis = orb.apoapsisAltitude ?? orb.apoapsis ?? 0;
      const periapsis = orb.periapsisAltitude ?? orb.periapsis ?? 0;
      const inclination = orb.inclination ?? 0;
      const eccentricity = orb.eccentricity ?? 0;

      if (this.elements.apoapsis) {
        this.elements.apoapsis.textContent = (apoapsis / 1000).toFixed(1) + ' km';
      }
      if (this.elements.periapsis) {
        this.elements.periapsis.textContent = (periapsis / 1000).toFixed(1) + ' km';
      }
      if (this.elements.inclination) {
        this.elements.inclination.textContent = inclination.toFixed(1) + '°';
      }
      if (this.elements.eccentricity) {
        this.elements.eccentricity.textContent = eccentricity.toFixed(3);
      }

      // Mass - in kg with comma separator
      const totalMass = state.totalMass ?? 0;
      if (this.elements.mass) {
        this.elements.mass.textContent = this.formatNumber(Math.round(totalMass)) + ' kg';
      }

      // Fuel - as percentage, update fuel bar width and color
      const fuelFraction = state.fuelFraction ?? 1;
      const fuelPct = Math.round(fuelFraction * 100);
      if (this.elements.fuel) {
        this.elements.fuel.textContent = fuelPct + '%';
      }
      if (this.elements.fuelFill) {
        this.elements.fuelFill.style.width = fuelPct + '%';
        this.elements.fuelFill.style.backgroundColor =
          fuelPct > 25 ? '#0f0' : fuelPct > 10 ? '#ff0' : '#f00';
      }

      // Thrust - in kN
      let thrustMag = 0;
      if (state.thrustForce) {
        thrustMag = typeof state.thrustForce === 'number'
          ? state.thrustForce
          : Math.sqrt(
              (state.thrustForce.x || 0) ** 2 +
              (state.thrustForce.y || 0) ** 2 +
              (state.thrustForce.z || 0) ** 2
            );
      } else if (state.throttle !== undefined && state.maxThrust) {
        thrustMag = state.throttle * state.maxThrust;
      }
      if (this.elements.thrust) {
        this.elements.thrust.textContent = (thrustMag / 1000).toFixed(1) + ' kN';
      }

      // G-Force - 1 decimal
      const gForce = state.gForce ?? 0;
      if (this.elements.gforce) {
        this.elements.gforce.textContent = gForce.toFixed(1) + ' g';
      }

      // Attitude (pitch/yaw/roll) - in degrees
      const rotation = state.rotation || { pitch: 0, yaw: 0, roll: 0 };
      const pitchDeg = (rotation.pitch * 180) / Math.PI;
      const yawDeg = (rotation.yaw * 180) / Math.PI;
      const rollDeg = (rotation.roll * 180) / Math.PI;

      if (this.elements.pitch) this.elements.pitch.textContent = pitchDeg.toFixed(1) + '°';
      if (this.elements.yaw) this.elements.yaw.textContent = yawDeg.toFixed(1) + '°';
      if (this.elements.roll) this.elements.roll.textContent = rollDeg.toFixed(1) + '°';

      // Attitude indicator
      this.drawAttitudeIndicator(pitchDeg, rollDeg);

      // Atmosphere data
      let atmDensity = 0;
      let temp = 0;
      if (typeof SpacePhysics !== 'undefined' && SpacePhysics.Atmosphere && altitude < 200000) {
        atmDensity = SpacePhysics.Atmosphere.getDensity(altitude);
        temp = SpacePhysics.Atmosphere.getTemperature(altitude);
      }
      if (this.elements.atmDensity) {
        this.elements.atmDensity.textContent = atmDensity.toExponential(2) + ' kg/m³';
      }
      if (this.elements.temp) {
        this.elements.temp.textContent = Math.round(temp) + ' K';
      }

      // Drag force
      let dragMag = 0;
      if (state.dragForce) {
        const df = state.dragForce;
        dragMag = typeof df === 'number'
          ? df
          : Math.sqrt((df.x || 0) ** 2 + (df.y || 0) ** 2 + (df.z || 0) ** 2);
      }
      if (this.elements.drag) {
        this.elements.drag.textContent = this.formatNumber(Math.round(dragMag)) + ' N';
      }

      // Heat flux
      const heatingRate = state.heatingRate ?? 0;
      if (this.elements.heat) {
        this.elements.heat.textContent = this.formatNumber(Math.round(heatingRate)) + ' W/m²';
      }

      // Throttle bar
      const throttle = state.throttle ?? 0;
      const throttlePct = Math.round(throttle * 100);
      if (this.elements.throttleFill) {
        this.elements.throttleFill.style.width = throttlePct + '%';
      }
      if (this.elements.throttlePct) {
        this.elements.throttlePct.textContent = throttlePct + '%';
      }
    }

    drawAttitudeIndicator(pitch, roll) {
      if (!this.attitudeCtx || !this.elements.attitudeCanvas) return;

      const canvas = this.elements.attitudeCanvas;
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      // Clear
      this.attitudeCtx.clearRect(0, 0, w, h);

      // Save context for roll rotation
      this.attitudeCtx.save();

      // Apply roll rotation around center
      this.attitudeCtx.translate(cx, cy);
      this.attitudeCtx.rotate((roll * Math.PI) / 180);
      this.attitudeCtx.translate(-cx, -cy);

      // Pitch shift: positive pitch = nose up = horizon moves down
      const pitchPixelsPerDeg = 2;
      const horizonOffset = (pitch * pitchPixelsPerDeg);

      // Draw sky (blue) - top half, shifted by pitch
      const skyTop = 0;
      const skyBottom = cy + horizonOffset;
      this.attitudeCtx.fillStyle = '#1a4d8c';
      this.attitudeCtx.fillRect(0, skyTop, w, Math.max(0, skyBottom));

      // Draw ground (brown) - bottom half, shifted by pitch
      const groundTop = cy + horizonOffset;
      const groundBottom = h;
      this.attitudeCtx.fillStyle = '#5c4033';
      this.attitudeCtx.fillRect(0, Math.min(h, groundTop), w, Math.max(0, groundBottom - groundTop));

      // Pitch ladder lines (horizontal reference lines)
      this.attitudeCtx.strokeStyle = 'rgba(255,255,255,0.6)';
      this.attitudeCtx.lineWidth = 1;
      this.attitudeCtx.beginPath();

      const ladderSpacing = 20;
      for (let p = -90; p <= 90; p += 10) {
        if (p === 0) continue;
        const y = cy + horizonOffset - (p * pitchPixelsPerDeg);
        if (y >= 0 && y <= h) {
          const lineLen = p % 30 === 0 ? 40 : 20;
          this.attitudeCtx.moveTo(cx - lineLen, y);
          this.attitudeCtx.lineTo(cx + lineLen, y);
        }
      }
      this.attitudeCtx.stroke();

      // Horizon line
      const horizonY = cy + horizonOffset;
      this.attitudeCtx.strokeStyle = '#fff';
      this.attitudeCtx.lineWidth = 2;
      this.attitudeCtx.beginPath();
      this.attitudeCtx.moveTo(0, horizonY);
      this.attitudeCtx.lineTo(w, horizonY);
      this.attitudeCtx.stroke();

      this.attitudeCtx.restore();

      // Center crosshair (drawn after restore so it doesn't rotate)
      this.attitudeCtx.strokeStyle = '#0f0';
      this.attitudeCtx.lineWidth = 2;
      this.attitudeCtx.beginPath();
      this.attitudeCtx.moveTo(cx - 25, cy);
      this.attitudeCtx.lineTo(cx - 8, cy);
      this.attitudeCtx.moveTo(cx + 8, cy);
      this.attitudeCtx.lineTo(cx + 25, cy);
      this.attitudeCtx.moveTo(cx, cy - 25);
      this.attitudeCtx.lineTo(cx, cy - 8);
      this.attitudeCtx.moveTo(cx, cy + 8);
      this.attitudeCtx.lineTo(cx, cy + 25);
      this.attitudeCtx.stroke();

      // Aircraft symbol (small triangle at center)
      this.attitudeCtx.fillStyle = '#0f0';
      this.attitudeCtx.beginPath();
      this.attitudeCtx.moveTo(cx, cy - 6);
      this.attitudeCtx.lineTo(cx - 4, cy + 4);
      this.attitudeCtx.lineTo(cx, cy + 2);
      this.attitudeCtx.lineTo(cx + 4, cy + 4);
      this.attitudeCtx.closePath();
      this.attitudeCtx.fill();
    }

    formatTime(seconds) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      return (
        String(h).padStart(2, '0') + ':' +
        String(m).padStart(2, '0') + ':' +
        String(s).padStart(2, '0')
      );
    }

    formatNumber(num) {
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    setMissionName(name) {
      if (this.elements.missionLabel) {
        this.elements.missionLabel.textContent = name;
      }
    }
  }

  global.HUD = HUD;
})(typeof window !== 'undefined' ? window : globalThis);
