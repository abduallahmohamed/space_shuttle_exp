/**
 * Space Shuttle Physics Simulator - 3D Renderer
 * Uses Three.js r128 for visualization. THREE is a global.
 * Creates SimRenderer class for all 3D rendering.
 */
(function (global) {
  'use strict';

  const SCALE = 0.001; // 1 meter = 0.001 render units (1 unit = 1 km)
  const EARTH_RADIUS = 6371;
  const MOON_RADIUS = 1737;
  const MOON_DISTANCE = 384400;
  const SHUTTLE_LENGTH = 37; // meters
  const S = SHUTTLE_LENGTH * SCALE; // shuttle length in render units

  class SimRenderer {
    constructor(canvas) {
      const w = window.innerWidth;
      const h = window.innerHeight;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(60, w / h, 0.0001, 1e9);
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1;
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.logarithmicDepthBuffer = true;

      // Camera system
      this.viewMode = 'chase';
      this.cameraOrbitAngle = { theta: Math.PI, phi: 0.4 };
      this.cameraOrbitDist = 0.15; // render units (~150m) for close views
      this.cameraLerpFactor = 0.08;
      this._smoothCamPos = new THREE.Vector3();
      this._smoothCamTarget = new THREE.Vector3();
      this._camInitialized = false;

      // Camera distance limits per mode (render units)
      this.distLimits = {
        chase:   { min: 0.03, max: 2, default: 0.15 },
        close:   { min: 0.02, max: 1, default: 0.08 },
        cockpit: { min: 0, max: 0, default: 0 },
        orbit:   { min: 5000, max: 100000, default: 15000 },
        flyby:   { min: 0.05, max: 5, default: 0.5 }
      };

      // Flyby state
      this._flybyAngle = 0;

      // Mouse controls
      this.isDragging = false;
      this.lastMouse = { x: 0, y: 0 };

      canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
      canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
      canvas.addEventListener('mouseup', () => this.onMouseUp());
      canvas.addEventListener('mouseleave', () => this.onMouseUp());
      canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
      canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
      canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
      canvas.addEventListener('touchend', () => this.onTouchEnd());

      this.createStarfield();
      this.createEarth();
      this.createMoon();
      this.createSun();
      this.createShuttle();
      this.createExhaustParticles();
      this.createOrbitLine();
      this.createAtmosphereGlow();

      window.addEventListener('resize', () => this.onResize());
    }

    // ---- Input handlers ----

    onMouseDown(e) {
      if (e.button === 0) {
        this.isDragging = true;
        this.lastMouse = { x: e.clientX, y: e.clientY };
      }
    }

    onMouseMove(e) {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.cameraOrbitAngle.theta -= dx * 0.005;
      this.cameraOrbitAngle.phi = Math.max(
        -Math.PI / 2 + 0.05,
        Math.min(Math.PI / 2 - 0.05, this.cameraOrbitAngle.phi + dy * 0.005)
      );
      this.lastMouse = { x: e.clientX, y: e.clientY };
    }

    onMouseUp() { this.isDragging = false; }

    onWheel(e) {
      e.preventDefault();
      if (this.viewMode === 'cockpit') return;
      const factor = e.deltaY > 0 ? 1.12 : 0.88;
      const limits = this.distLimits[this.viewMode] || this.distLimits.chase;
      this.cameraOrbitDist = Math.max(limits.min, Math.min(limits.max, this.cameraOrbitDist * factor));
    }

    onTouchStart(e) {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }

    onTouchMove(e) {
      if (!this.isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - this.lastMouse.x;
      const dy = e.touches[0].clientY - this.lastMouse.y;
      this.cameraOrbitAngle.theta -= dx * 0.005;
      this.cameraOrbitAngle.phi = Math.max(
        -Math.PI / 2 + 0.05,
        Math.min(Math.PI / 2 - 0.05, this.cameraOrbitAngle.phi + dy * 0.005)
      );
      this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }

    onTouchEnd() { this.isDragging = false; }

    // ---- Scene creation ----

    createStarfield() {
      const starCount = 10000;
      const positions = new Float32Array(starCount * 3);
      const colors = new Float32Array(starCount * 3);
      const sizes = new Float32Array(starCount);
      const radius = 500000;

      for (let i = 0; i < starCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = radius * (0.5 + Math.random() * 0.5);
        positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);

        const c = Math.random();
        if (c < 0.7)       { colors[i*3]=1;   colors[i*3+1]=1;    colors[i*3+2]=1;   }
        else if (c < 0.85) { colors[i*3]=0.9;  colors[i*3+1]=0.95; colors[i*3+2]=1;   }
        else               { colors[i*3]=1;    colors[i*3+1]=1;    colors[i*3+2]=0.9;  }

        sizes[i] = 0.5 + Math.random() * 2;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

      this.starfield = new THREE.Points(geometry, new THREE.PointsMaterial({
        size: 2, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true
      }));
      this.scene.add(this.starfield);
      this.starfieldTime = 0;
      this.starBaseSizes = new Float32Array(sizes);
    }

    createEarth() {
      this.earth = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_RADIUS, 64, 48),
        new THREE.MeshPhongMaterial({ color: 0x2233aa, emissive: 0x001133, specular: 0x333333, shininess: 5 })
      );
      this.scene.add(this.earth);

      this.clouds = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_RADIUS * 1.005, 64, 48),
        new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
      );
      this.scene.add(this.clouds);
    }

    createMoon() {
      this.moon = new THREE.Mesh(
        new THREE.SphereGeometry(MOON_RADIUS, 32, 24),
        new THREE.MeshPhongMaterial({ color: 0x888888, emissive: 0x222222, specular: 0x111111, shininess: 2 })
      );
      this.moon.position.set(MOON_DISTANCE, 0, 0);
      this.scene.add(this.moon);
    }

    createSun() {
      this.scene.add(new THREE.AmbientLight(0x334466, 0.4));

      this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
      this.directionalLight.position.set(500000, 100000, 0);
      this.scene.add(this.directionalLight);

      this.scene.add(new THREE.PointLight(0xffffee, 0.5, 1000000));

      // Shuttle-local fill light so the body is visible in shadow
      this.shuttleLight = new THREE.PointLight(0x4488cc, 0.6, 0.5);
      this.shuttleLight.position.set(0, 0, 0);
      this.scene.add(this.shuttleLight);
    }

    createShuttle() {
      this.shuttleGroup = new THREE.Group();
      const white = new THREE.MeshPhongMaterial({ color: 0xf0f0f0, shininess: 30 });
      const dark  = new THREE.MeshPhongMaterial({ color: 0x222222, shininess: 60 });
      const tile  = new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 10 });

      // Fuselage
      const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(S*0.07, S*0.10, S*0.75, 12), white);
      fuselage.rotation.z = Math.PI / 2;
      this.shuttleGroup.add(fuselage);

      // Nose cone
      const nose = new THREE.Mesh(new THREE.ConeGeometry(S*0.07, S*0.18, 12), white);
      nose.rotation.z = Math.PI / 2;
      nose.position.x = -S * 0.47;
      this.shuttleGroup.add(nose);

      // Cockpit windows
      const cockpitWindows = new THREE.Mesh(
        new THREE.BoxGeometry(S*0.06, S*0.04, S*0.12),
        new THREE.MeshPhongMaterial({ color: 0x003366, emissive: 0x001122, shininess: 100 })
      );
      cockpitWindows.position.set(-S*0.32, S*0.06, 0);
      this.shuttleGroup.add(cockpitWindows);

      // Belly heat shield (dark tiles)
      const belly = new THREE.Mesh(new THREE.BoxGeometry(S*0.6, S*0.02, S*0.14), tile);
      belly.position.set(0, -S*0.08, 0);
      this.shuttleGroup.add(belly);

      // Delta wings
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.lineTo(S*0.35, -S*0.28);
      wingShape.lineTo(S*0.45, -S*0.05);
      wingShape.lineTo(S*0.15, 0);
      const wingGeom = new THREE.ExtrudeGeometry(wingShape, { depth: S*0.015, bevelEnabled: false });

      const wingL = new THREE.Mesh(wingGeom, white);
      wingL.rotation.x = -Math.PI/2;
      wingL.position.set(-S*0.1, -S*0.04, S*0.01);
      this.shuttleGroup.add(wingL);

      const wingR = new THREE.Mesh(wingGeom, white);
      wingR.rotation.x = Math.PI/2;
      wingR.scale.z = -1;
      wingR.position.set(-S*0.1, -S*0.04, -S*0.01);
      this.shuttleGroup.add(wingR);

      // Vertical stabilizer
      const tailShape = new THREE.Shape();
      tailShape.moveTo(0, 0);
      tailShape.lineTo(S*0.12, S*0.22);
      tailShape.lineTo(S*0.22, S*0.22);
      tailShape.lineTo(S*0.18, 0);
      const tailGeom = new THREE.ExtrudeGeometry(tailShape, { depth: S*0.012, bevelEnabled: false });
      const tail = new THREE.Mesh(tailGeom, white);
      tail.position.set(S*0.15, S*0.05, -S*0.006);
      this.shuttleGroup.add(tail);

      // OMS pods
      const omsPod = new THREE.CylinderGeometry(S*0.03, S*0.035, S*0.15, 8);
      const omsL = new THREE.Mesh(omsPod, white);
      omsL.rotation.z = Math.PI/2;
      omsL.position.set(S*0.3, S*0.02, S*0.08);
      this.shuttleGroup.add(omsL);
      const omsR = new THREE.Mesh(omsPod, white);
      omsR.rotation.z = Math.PI/2;
      omsR.position.set(S*0.3, S*0.02, -S*0.08);
      this.shuttleGroup.add(omsR);

      // Main engine nozzles (3 SSMEs)
      const nozzleGeom = new THREE.CylinderGeometry(S*0.015, S*0.035, S*0.07, 10);
      const nozzleMat = new THREE.MeshPhongMaterial({ color: 0x444444, shininess: 80 });
      const nozzlePositions = [
        [S*0.40, S*0.03, 0],
        [S*0.40, 0, S*0.04],
        [S*0.40, 0, -S*0.04]
      ];
      nozzlePositions.forEach(([x,y,z]) => {
        const n = new THREE.Mesh(nozzleGeom, nozzleMat);
        n.rotation.z = Math.PI/2;
        n.position.set(x, y, z);
        this.shuttleGroup.add(n);
      });

      // Payload bay doors (closed by default)
      const bayDoor = new THREE.Mesh(
        new THREE.BoxGeometry(S*0.35, S*0.015, S*0.12),
        new THREE.MeshPhongMaterial({ color: 0xdddddd })
      );
      bayDoor.position.set(-S*0.02, S*0.075, 0);
      this.shuttleGroup.add(bayDoor);

      // External tank
      this.stackGroup = new THREE.Group();
      const etMat = new THREE.MeshPhongMaterial({ color: 0xe85c00, shininess: 20 });
      this.externalTank = new THREE.Mesh(new THREE.CylinderGeometry(S*0.12, S*0.12, S*1.1, 16), etMat);
      this.externalTank.rotation.z = Math.PI/2;
      this.externalTank.position.set(S*0.2, -S*0.18, 0);
      this.stackGroup.add(this.externalTank);

      // ET nose
      const etNose = new THREE.Mesh(new THREE.ConeGeometry(S*0.12, S*0.2, 16), etMat);
      etNose.rotation.z = Math.PI/2;
      etNose.position.set(-S*0.45, -S*0.18, 0);
      this.stackGroup.add(etNose);

      // SRBs
      const srbMat = new THREE.MeshPhongMaterial({ color: 0xeeeeee, shininess: 15 });
      const srbGeom = new THREE.CylinderGeometry(S*0.06, S*0.07, S*0.9, 12);
      this.srbLeft = new THREE.Mesh(srbGeom, srbMat);
      this.srbLeft.rotation.z = Math.PI/2;
      this.srbLeft.position.set(S*0.15, -S*0.18, S*0.2);
      this.stackGroup.add(this.srbLeft);

      this.srbRight = new THREE.Mesh(srbGeom, srbMat);
      this.srbRight.rotation.z = Math.PI/2;
      this.srbRight.position.set(S*0.15, -S*0.18, -S*0.2);
      this.stackGroup.add(this.srbRight);

      // SRB nose cones
      const srbNoseGeom = new THREE.ConeGeometry(S*0.06, S*0.1, 12);
      const srbNoseL = new THREE.Mesh(srbNoseGeom, srbMat);
      srbNoseL.rotation.z = Math.PI/2;
      srbNoseL.position.set(-S*0.32, -S*0.18, S*0.2);
      this.stackGroup.add(srbNoseL);
      const srbNoseR = new THREE.Mesh(srbNoseGeom, srbMat);
      srbNoseR.rotation.z = Math.PI/2;
      srbNoseR.position.set(-S*0.32, -S*0.18, -S*0.2);
      this.stackGroup.add(srbNoseR);

      this.shuttleGroup.add(this.stackGroup);
      this.scene.add(this.shuttleGroup);

      // Heating glow
      this.heatingGlow = new THREE.Mesh(
        new THREE.SphereGeometry(S * 0.5, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0, side: THREE.BackSide })
      );
      this.shuttleGroup.add(this.heatingGlow);

      // Docking target
      this.targetMesh = new THREE.Group();
      const tBody = new THREE.Mesh(
        new THREE.BoxGeometry(S*0.3, S*0.3, S*0.6),
        new THREE.MeshPhongMaterial({ color: 0xcccccc })
      );
      this.targetMesh.add(tBody);
      const panelGeom = new THREE.BoxGeometry(S*1.2, S*0.02, S*0.3);
      const panelMat = new THREE.MeshPhongMaterial({ color: 0x2244aa, emissive: 0x111144 });
      [-1, 1].forEach(side => {
        const panel = new THREE.Mesh(panelGeom, panelMat);
        panel.position.set(0, side * S * 0.15, 0);
        this.targetMesh.add(panel);
      });
      this.targetMesh.visible = false;
      this.scene.add(this.targetMesh);
    }

    createExhaustParticles() {
      const maxParticles = 800;
      const positions = new Float32Array(maxParticles * 3);
      const colors = new Float32Array(maxParticles * 3);
      const sizes = new Float32Array(maxParticles);

      for (let i = 0; i < maxParticles; i++) {
        colors[i*3] = 1; colors[i*3+1] = 0.8; colors[i*3+2] = 0.3;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

      this.exhaustParticles = new THREE.Points(geometry, new THREE.PointsMaterial({
        size: 0.008,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }));
      this.exhaustParticles.frustumCulled = false;
      this.scene.add(this.exhaustParticles);

      this.particleData = [];
      for (let i = 0; i < maxParticles; i++) {
        this.particleData.push({ x:0,y:0,z:0, vx:0,vy:0,vz:0, life:0, maxLife:0.6, size:1 });
      }
    }

    createOrbitLine() {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
      this.orbitLine = new THREE.Line(geometry, new THREE.LineBasicMaterial({
        color: 0x00ffff, transparent: true, opacity: 0.6
      }));
      this.orbitLine.frustumCulled = false;
      this.scene.add(this.orbitLine);
    }

    createAtmosphereGlow() {
      this.atmosphereGlow = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_RADIUS * 1.04, 64, 48),
        new THREE.ShaderMaterial({
          uniforms: { c: { value: 0.3 }, p: { value: 4.0 } },
          vertexShader: `
            varying vec3 vNormal;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
          fragmentShader: `
            uniform float c; uniform float p;
            varying vec3 vNormal;
            void main() {
              float intensity = pow(c - dot(vNormal, vec3(0.0, 0.0, 1.0)), p);
              gl_FragColor = vec4(0.3, 0.5, 1.0, intensity * 0.4);
            }`,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false
        })
      );
      this.scene.add(this.atmosphereGlow);
    }

    // ---- Camera system ----

    _getShuttleWorldMatrix(shuttle) {
      const px = shuttle.position.x * SCALE;
      const py = shuttle.position.y * SCALE;
      const pz = shuttle.position.z * SCALE;
      const m = new THREE.Matrix4();
      const euler = new THREE.Euler(shuttle.rotation.pitch, shuttle.rotation.yaw, shuttle.rotation.roll, 'YXZ');
      m.makeRotationFromEuler(euler);
      m.setPosition(px, py, pz);
      return m;
    }

    _localToWorld(localOffset, worldMatrix) {
      const v = new THREE.Vector3(localOffset.x, localOffset.y, localOffset.z);
      v.applyMatrix4(worldMatrix);
      return v;
    }

    updateCamera(shuttle) {
      const wm = this._getShuttleWorldMatrix(shuttle);
      const shuttlePos = new THREE.Vector3().setFromMatrixPosition(wm);

      // Fill light follows shuttle
      this.shuttleLight.position.copy(shuttlePos);

      if (this.viewMode === 'chase') {
        // Third-person behind-and-above, follows shuttle orientation
        const dist = this.cameraOrbitDist;
        const behind = this._localToWorld({
          x: dist * 0.8,
          y: dist * 0.35,
          z: dist * Math.sin(this.cameraOrbitAngle.theta) * 0.3
        }, wm);

        const lookAhead = this._localToWorld({ x: -S * 0.5, y: 0, z: 0 }, wm);

        if (!this._camInitialized) {
          this._smoothCamPos.copy(behind);
          this._smoothCamTarget.copy(lookAhead);
          this._camInitialized = true;
        }

        this._smoothCamPos.lerp(behind, this.cameraLerpFactor);
        this._smoothCamTarget.lerp(lookAhead, this.cameraLerpFactor * 1.5);

        this.camera.position.copy(this._smoothCamPos);
        this.camera.lookAt(this._smoothCamTarget);

      } else if (this.viewMode === 'close') {
        // Free orbit around shuttle body -- user can rotate and zoom
        const dist = this.cameraOrbitDist;
        const cx = dist * Math.cos(this.cameraOrbitAngle.phi) * Math.sin(this.cameraOrbitAngle.theta);
        const cy = dist * Math.sin(this.cameraOrbitAngle.phi);
        const cz = dist * Math.cos(this.cameraOrbitAngle.phi) * Math.cos(this.cameraOrbitAngle.theta);

        this.camera.position.set(
          shuttlePos.x + cx,
          shuttlePos.y + cy,
          shuttlePos.z + cz
        );
        this.camera.lookAt(shuttlePos);

      } else if (this.viewMode === 'cockpit') {
        // First-person from cockpit
        const eyePos = this._localToWorld({ x: -S * 0.35, y: S * 0.08, z: 0 }, wm);
        const lookDir = this._localToWorld({ x: -S * 2, y: S * 0.05, z: 0 }, wm);

        if (!this._camInitialized) {
          this._smoothCamPos.copy(eyePos);
          this._smoothCamTarget.copy(lookDir);
          this._camInitialized = true;
        }

        this._smoothCamPos.lerp(eyePos, 0.15);
        this._smoothCamTarget.lerp(lookDir, 0.15);

        this.camera.position.copy(this._smoothCamPos);
        this.camera.lookAt(this._smoothCamTarget);

      } else if (this.viewMode === 'orbit') {
        // Far view centered on Earth showing the whole orbit
        const dist = this.cameraOrbitDist;
        const cx = dist * Math.cos(this.cameraOrbitAngle.phi) * Math.sin(this.cameraOrbitAngle.theta);
        const cy = dist * Math.sin(this.cameraOrbitAngle.phi);
        const cz = dist * Math.cos(this.cameraOrbitAngle.phi) * Math.cos(this.cameraOrbitAngle.theta);

        this.camera.position.set(cx, cy, cz);
        this.camera.lookAt(0, 0, 0);

      } else if (this.viewMode === 'flyby') {
        // Cinematic slow orbit around shuttle
        this._flybyAngle += 0.003;
        const dist = this.cameraOrbitDist;
        const cx = dist * Math.cos(this._flybyAngle) * Math.cos(0.3);
        const cy = dist * Math.sin(0.3);
        const cz = dist * Math.sin(this._flybyAngle) * Math.cos(0.3);

        const target = new THREE.Vector3(
          shuttlePos.x + cx,
          shuttlePos.y + cy,
          shuttlePos.z + cz
        );

        if (!this._camInitialized) {
          this._smoothCamPos.copy(target);
          this._camInitialized = true;
        }

        this._smoothCamPos.lerp(target, 0.04);
        this.camera.position.copy(this._smoothCamPos);
        this.camera.lookAt(shuttlePos);
      }
    }

    // ---- Main update ----

    update(shuttle) {
      const pos = shuttle.position;
      const rot = shuttle.rotation;

      // Shuttle position and rotation
      this.shuttleGroup.position.set(pos.x * SCALE, pos.y * SCALE, pos.z * SCALE);
      this.shuttleGroup.rotation.order = 'YXZ';
      this.shuttleGroup.rotation.y = rot.yaw;
      this.shuttleGroup.rotation.x = rot.pitch;
      this.shuttleGroup.rotation.z = rot.roll;

      // Camera
      this.updateCamera(shuttle);

      // Orbit trail
      this.updateOrbitTrail(shuttle.trail);

      // Exhaust particles
      this.updateExhaust(shuttle);

      // Staging visibility
      const stage = shuttle.currentStage || 0;
      this.stackGroup.visible = stage < 2;
      this.externalTank.visible = stage < 2;
      this.srbLeft.visible = stage === 0;
      this.srbRight.visible = stage === 0;

      // Re-entry heating glow
      const heatThresh = 10000;
      if (shuttle.heatingRate > heatThresh) {
        const intensity = Math.min(1, (shuttle.heatingRate - heatThresh) / 50000);
        this.heatingGlow.material.opacity = intensity * 0.6;
      } else {
        this.heatingGlow.material.opacity = 0;
      }

      // Star twinkle (skip if in close view to save perf)
      if (this.viewMode !== 'close' && this.viewMode !== 'cockpit') {
        this.starfieldTime = (this.starfieldTime || 0) + 0.016;
        const szAttr = this.starfield.geometry.attributes.size;
        if (szAttr && this.starBaseSizes) {
          for (let i = 0; i < szAttr.count; i++) {
            szAttr.array[i] = this.starBaseSizes[i] * (0.8 + 0.4 * Math.sin(this.starfieldTime * 2 + i * 0.1));
          }
          szAttr.needsUpdate = true;
        }
      }
    }

    updateExhaust(shuttle) {
      const posArr = this.exhaustParticles.geometry.attributes.position.array;
      const sizeArr = this.exhaustParticles.geometry.attributes.size.array;
      const colorArr = this.exhaustParticles.geometry.attributes.color.array;

      if (!shuttle || shuttle.throttle <= 0) {
        for (let i = 0; i < this.particleData.length; i++) {
          this.particleData[i].life = 0;
          sizeArr[i] = 0;
        }
        this.exhaustParticles.geometry.attributes.position.needsUpdate = true;
        this.exhaustParticles.geometry.attributes.size.needsUpdate = true;
        return;
      }

      // Nozzle positions in world space (use shuttle group world matrix)
      this.shuttleGroup.updateMatrixWorld(true);
      const worldMat = this.shuttleGroup.matrixWorld;

      const nozzleLocal = new THREE.Vector3(S * 0.42, 0, 0);
      const nozzleWorld = nozzleLocal.clone().applyMatrix4(worldMat);

      // Thrust direction in world space (backward from shuttle nose)
      const fwd = new THREE.Vector3(-1, 0, 0).transformDirection(worldMat).normalize();
      const exhaustDir = fwd.clone().negate(); // exhaust goes backward

      const dt = 0.016;
      const throttle = shuttle.throttle;

      for (let i = 0; i < this.particleData.length; i++) {
        const p = this.particleData[i];

        if (p.life <= 0 && Math.random() < throttle * 0.6) {
          const spread = S * 0.03;
          p.x = nozzleWorld.x + (Math.random()-0.5) * spread;
          p.y = nozzleWorld.y + (Math.random()-0.5) * spread;
          p.z = nozzleWorld.z + (Math.random()-0.5) * spread;

          const speed = S * 8 * (0.8 + Math.random() * 0.4);
          p.vx = exhaustDir.x * speed + (Math.random()-0.5) * speed * 0.15;
          p.vy = exhaustDir.y * speed + (Math.random()-0.5) * speed * 0.15;
          p.vz = exhaustDir.z * speed + (Math.random()-0.5) * speed * 0.15;
          p.life = p.maxLife * (0.6 + Math.random() * 0.4);
          p.size = 1 + Math.random() * 1.5;
        }

        if (p.life > 0) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          p.vx *= 0.97;
          p.vy *= 0.97;
          p.vz *= 0.97;
          p.life -= dt;

          const t = 1 - p.life / p.maxLife;
          posArr[i*3] = p.x;
          posArr[i*3+1] = p.y;
          posArr[i*3+2] = p.z;
          sizeArr[i] = p.size * (1 - t * 0.7);

          // Color fade: white-yellow -> orange -> red-dim
          colorArr[i*3]   = 1;
          colorArr[i*3+1] = Math.max(0.2, 1 - t * 1.2);
          colorArr[i*3+2] = Math.max(0.05, 0.6 - t * 1.5);
        } else {
          posArr[i*3] = 0; posArr[i*3+1] = 0; posArr[i*3+2] = 0;
          sizeArr[i] = 0;
        }
      }

      this.exhaustParticles.geometry.attributes.position.needsUpdate = true;
      this.exhaustParticles.geometry.attributes.size.needsUpdate = true;
      this.exhaustParticles.geometry.attributes.color.needsUpdate = true;
    }

    updateOrbitTrail(trail) {
      if (!trail || trail.length < 2) {
        this.orbitLine.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
        return;
      }
      const positions = new Float32Array(trail.length * 3);
      for (let i = 0; i < trail.length; i++) {
        positions[i*3]   = trail[i].x * SCALE;
        positions[i*3+1] = trail[i].y * SCALE;
        positions[i*3+2] = trail[i].z * SCALE;
      }
      this.orbitLine.geometry.dispose();
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      this.orbitLine.geometry = geom;
    }

    render() {
      this.renderer.render(this.scene, this.camera);
    }

    onResize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    }

    setViewMode(mode) {
      this.viewMode = mode;
      this._camInitialized = false;
      const limits = this.distLimits[mode];
      if (limits) {
        this.cameraOrbitDist = limits.default;
      }
      if (mode === 'chase') {
        this.cameraOrbitAngle = { theta: 0, phi: 0.3 };
      }
    }
  }

  global.SimRenderer = SimRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
