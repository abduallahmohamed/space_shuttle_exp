/**
 * Space Shuttle Physics Simulator - User Input & Controls
 * Handles keyboard, mouse, and UI panel interactions.
 */
(function (global) {
  'use strict';

  class Controls {
    constructor(shuttle, onScenarioChange, onReset, onViewChange) {
      this.shuttle = shuttle;
      this.onScenarioChange = onScenarioChange || (() => {});
      this.onReset = onReset || (() => {});
      this.onViewChange = onViewChange || (() => {});

      this.keys = {};
      this.isPaused = false;
      this.timeWarp = 1;
      this.timeWarpLevels = [0.1, 1, 10, 100, 1000, 10000];
      this.timeWarpIndex = 1;
      this.cameraModes = ['chase', 'close', 'cockpit', 'flyby', 'orbit'];
      this.cameraModeIndex = 0;

      this.setupKeyboard();
      this.setupUI();
      this.setupSliders();
    }

    setupKeyboard() {
      const handleKeyDown = (e) => {
        const key = e.key === ' ' ? 'Space' : e.key;
        this.keys[key] = true;
        this.keys[key.toLowerCase()] = true;

        if (this.isPaused && key.toLowerCase() !== 'p') return;

        // X: kill throttle
        if (key === 'x' || key === 'X') {
          this.shuttle.throttle = 0;
          e.preventDefault();
        }
        // Z: full throttle
        if (key === 'z' || key === 'Z') {
          this.shuttle.throttle = 1;
          e.preventDefault();
        }
        // Space: stage separation
        if (key === 'Space') {
          this.shuttle.performStaging();
          this.showNotification('Stage ' + this.shuttle.currentStage + ' separated', 'info');
          e.preventDefault();
        }
        // T: toggle SAS
        if (key === 't' || key === 'T') {
          this.shuttle.sasEnabled = !this.shuttle.sasEnabled;
          this.updateRcsSasButtons();
          this.showNotification(this.shuttle.sasEnabled ? 'SAS enabled' : 'SAS disabled', 'info');
          e.preventDefault();
        }
        // R: toggle RCS
        if (key === 'r' || key === 'R') {
          this.shuttle.rcsEnabled = !this.shuttle.rcsEnabled;
          this.updateRcsSasButtons();
          this.showNotification(this.shuttle.rcsEnabled ? 'RCS enabled' : 'RCS disabled', 'info');
          e.preventDefault();
        }
        // G: toggle landing gear
        if (key === 'g' || key === 'G') {
          this.shuttle.gearDeployed = !this.shuttle.gearDeployed;
          this.updateGearButton();
          this.showNotification(
            this.shuttle.gearDeployed ? 'Landing gear deployed' : 'Landing gear retracted',
            'info'
          );
          e.preventDefault();
        }
        // , (comma): decrease time warp
        if (key === ',') {
          this.decreaseTimeWarp();
          e.preventDefault();
        }
        // . (period): increase time warp
        if (key === '.') {
          this.increaseTimeWarp();
          e.preventDefault();
        }
        // V: cycle camera mode
        if (key === 'v' || key === 'V') {
          this.cycleCameraMode();
          e.preventDefault();
        }
        // P: pause/unpause
        if (key === 'p' || key === 'P') {
          this.togglePause();
          e.preventDefault();
        }
      };

      const handleKeyUp = (e) => {
        const key = e.key === ' ' ? 'Space' : e.key;
        this.keys[key] = false;
        this.keys[key.toLowerCase()] = false;
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      this._keydownHandler = handleKeyDown;
      this._keyupHandler = handleKeyUp;
    }

    updateRcsSasButtons() {
      const btnRcs = document.getElementById('btn-rcs');
      const btnSas = document.getElementById('btn-sas');
      if (btnRcs) btnRcs.classList.toggle('active', this.shuttle.rcsEnabled);
      if (btnSas) btnSas.classList.toggle('active', this.shuttle.sasEnabled);
    }

    updateGearButton() {
      const btnGear = document.getElementById('btn-gear');
      if (btnGear) btnGear.classList.toggle('active', this.shuttle.gearDeployed);
    }

    decreaseTimeWarp() {
      if (this.timeWarpIndex > 0) {
        this.timeWarpIndex--;
        this.timeWarp = this.timeWarpLevels[this.timeWarpIndex];
        this.updateTimeWarpSelect();
        this.showNotification('Time warp: ' + this.timeWarp + 'x', 'info');
      }
    }

    increaseTimeWarp() {
      if (this.timeWarpIndex < this.timeWarpLevels.length - 1) {
        this.timeWarpIndex++;
        this.timeWarp = this.timeWarpLevels[this.timeWarpIndex];
        this.updateTimeWarpSelect();
        this.showNotification('Time warp: ' + this.timeWarp + 'x', 'info');
      }
    }

    updateTimeWarpSelect() {
      const select = document.getElementById('param-timewarp');
      if (select) {
        select.value = String(this.timeWarp);
      }
    }

    setupUI() {
      // Toggle controls panel
      const toggleBtn = document.getElementById('toggle-controls');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          document.getElementById('controls-panel').classList.toggle('collapsed');
          toggleBtn.textContent = document
            .getElementById('controls-panel')
            .classList.contains('collapsed')
            ? '▶'
            : '◀';
        });
      }

      // Scenario buttons
      document.querySelectorAll('.scenario-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.scenario-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          const scenario = btn.getAttribute('data-scenario');
          this.onScenarioChange(scenario);
          this.showNotification('Loading scenario: ' + scenario, 'info');
        });
      });

      // Navigation mode buttons
      document.querySelectorAll('.nav-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          const mode = btn.getAttribute('data-mode');
          this.setNavMode(mode);
        });
      });

      // Action buttons
      const btnStage = document.getElementById('btn-stage');
      if (btnStage) {
        btnStage.addEventListener('click', () => {
          this.shuttle.performStaging();
          this.showNotification('Stage ' + this.shuttle.currentStage + ' separated', 'info');
        });
      }

      const btnRcs = document.getElementById('btn-rcs');
      if (btnRcs) {
        btnRcs.addEventListener('click', () => {
          this.shuttle.rcsEnabled = !this.shuttle.rcsEnabled;
          this.updateRcsSasButtons();
        });
      }

      const btnSas = document.getElementById('btn-sas');
      if (btnSas) {
        btnSas.addEventListener('click', () => {
          this.shuttle.sasEnabled = !this.shuttle.sasEnabled;
          this.updateRcsSasButtons();
        });
      }

      const btnGear = document.getElementById('btn-gear');
      if (btnGear) {
        btnGear.addEventListener('click', () => {
          this.shuttle.gearDeployed = !this.shuttle.gearDeployed;
          this.updateGearButton();
        });
      }

      const btnPause = document.getElementById('btn-pause');
      if (btnPause) {
        btnPause.addEventListener('click', () => this.togglePause());
      }

      const btnReset = document.getElementById('btn-reset');
      if (btnReset) {
        btnReset.addEventListener('click', () => this.onReset());
      }

      // Camera mode buttons
      document.querySelectorAll('.cam-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const mode = btn.getAttribute('data-cam');
          this.setCameraMode(mode);
        });
      });

      // Time warp select
      const timeWarpSelect = document.getElementById('param-timewarp');
      if (timeWarpSelect) {
        timeWarpSelect.addEventListener('change', (e) => {
          this.timeWarp = parseFloat(e.target.value);
          this.timeWarpIndex = this.timeWarpLevels.indexOf(this.timeWarp);
          if (this.timeWarpIndex < 0) this.timeWarpIndex = 1;
        });
      }
    }

    setNavMode(mode) {
      if (typeof SpacePhysics === 'undefined' || !SpacePhysics.Vec3) return;

      const pos = this.shuttle.position;
      const vel = this.shuttle.velocity;
      const Vec3 = SpacePhysics.Vec3;

      let dir;
      switch (mode) {
        case 'prograde':
          this.shuttle.pointPrograde();
          return;
        case 'retrograde':
          this.shuttle.pointRetrograde();
          return;
        case 'normal': {
          const h = Vec3.cross(pos, vel);
          dir = Vec3.normalize(h);
          break;
        }
        case 'antinormal': {
          const h = Vec3.cross(pos, vel);
          dir = Vec3.scale(Vec3.normalize(h), -1);
          break;
        }
        case 'radialout':
          dir = Vec3.normalize(pos);
          break;
        case 'radialin':
          dir = Vec3.scale(Vec3.normalize(pos), -1);
          break;
        default:
          return;
      }

      const m = Vec3.magnitude(dir);
      if (m < 1e-6) return;
      this.shuttle.rotation.pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
      this.shuttle.rotation.yaw = Math.atan2(dir.z, dir.x);
    }

    setupSliders() {
      const sliderConfigs = [
        { id: 'param-drymass', valId: 'val-drymass', format: 'number' },
        { id: 'param-fuelmass', valId: 'val-fuelmass', format: 'number' },
        { id: 'param-thrust', valId: 'val-thrust', format: 'number' },
        { id: 'param-isp', valId: 'val-isp', format: 'number' },
        { id: 'param-cd', valId: 'val-cd', format: 'decimal', decimals: 2 },
        { id: 'param-area', valId: 'val-area', format: 'number' },
        { id: 'param-altitude', valId: 'val-altitude', format: 'number' },
        { id: 'param-velocity', valId: 'val-velocity', format: 'number' },
        { id: 'param-inclination', valId: 'val-inclination', format: 'decimal', decimals: 1 }
      ];

      sliderConfigs.forEach(({ id, valId, format, decimals = 0 }) => {
        const input = document.getElementById(id);
        const valSpan = document.getElementById(valId);
        if (!input || !valSpan) return;

        const updateDisplay = () => {
          let val = parseFloat(input.value);
          if (format === 'number') {
            valSpan.textContent = val.toLocaleString('en-US', { maximumFractionDigits: 0 });
          } else {
            valSpan.textContent = val.toFixed(decimals);
          }
        };

        input.addEventListener('input', updateDisplay);
        input.addEventListener('change', updateDisplay);
        updateDisplay();
      });
    }

    processInput(dt) {
      if (this.isPaused) return;

      if (this.keys['w'] || this.keys['W']) this.shuttle.applyRotation('pitch', 1);
      if (this.keys['s'] || this.keys['S']) this.shuttle.applyRotation('pitch', -1);
      if (this.keys['a'] || this.keys['A']) this.shuttle.applyRotation('yaw', -1);
      if (this.keys['d'] || this.keys['D']) this.shuttle.applyRotation('yaw', 1);
      if (this.keys['q'] || this.keys['Q']) this.shuttle.applyRotation('roll', -1);
      if (this.keys['e'] || this.keys['E']) this.shuttle.applyRotation('roll', 1);

      if (this.keys['Shift']) {
        this.shuttle.throttle = Math.min(1, this.shuttle.throttle + 0.5 * dt);
      }
      if (this.keys['Control']) {
        this.shuttle.throttle = Math.max(0, this.shuttle.throttle - 0.5 * dt);
      }
    }

    getSliderParams() {
      return {
        dryMass: parseFloat(document.getElementById('param-drymass')?.value || 68585),
        fuelMass: parseFloat(document.getElementById('param-fuelmass')?.value || 720000),
        maxThrust:
          parseFloat(document.getElementById('param-thrust')?.value || 12500) * 1000,
        isp: parseFloat(document.getElementById('param-isp')?.value || 366),
        cd: parseFloat(document.getElementById('param-cd')?.value || 0.8),
        area: parseFloat(document.getElementById('param-area')?.value || 180),
        altitude:
          parseFloat(document.getElementById('param-altitude')?.value || 250) * 1000,
        velocity: parseFloat(document.getElementById('param-velocity')?.value || 7800),
        inclination: parseFloat(document.getElementById('param-inclination')?.value || 28.5)
      };
    }

    showNotification(message, type = 'info') {
      const area = document.getElementById('notification-area');
      if (!area) return;

      const toast = document.createElement('div');
      toast.className = 'notification-toast notification-' + type;
      toast.textContent = message;
      area.appendChild(toast);

      requestAnimationFrame(() => {
        toast.classList.add('show');
      });

      setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }

    cycleCameraMode() {
      this.cameraModeIndex = (this.cameraModeIndex + 1) % this.cameraModes.length;
      const mode = this.cameraModes[this.cameraModeIndex];
      this.setCameraMode(mode);
    }

    setCameraMode(mode) {
      this.cameraModeIndex = this.cameraModes.indexOf(mode);
      if (this.cameraModeIndex < 0) this.cameraModeIndex = 0;
      document.querySelectorAll('.cam-btn').forEach((b) => b.classList.remove('active'));
      const activeBtn = document.querySelector('.cam-btn[data-cam="' + mode + '"]');
      if (activeBtn) activeBtn.classList.add('active');
      this.onViewChange(mode);
      this.showNotification('Camera: ' + mode.charAt(0).toUpperCase() + mode.slice(1), 'info');
    }

    togglePause() {
      this.isPaused = !this.isPaused;
      const btn = document.getElementById('btn-pause');
      if (btn) {
        btn.textContent = this.isPaused ? '▶ Resume' : '⏸ Pause';
      }
    }

    getTimeWarp() {
      return this.timeWarp;
    }
  }

  global.Controls = Controls;
})(typeof window !== 'undefined' ? window : globalThis);
