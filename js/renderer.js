/**
 * Space Shuttle Physics Simulator - 3D Renderer
 * Uses Three.js r128 for visualization. THREE is a global.
 * Creates SimRenderer class for all 3D rendering.
 */
(function (global) {
  'use strict';

  const SCALE = 0.001; // 1 meter = 0.001 render units (1 unit = 1 km)
  const EARTH_RADIUS = 6371;   // units (6371 km)
  const MOON_RADIUS = 1737;   // units (1737 km)
  const MOON_DISTANCE = 384400; // units (384400 km)
  const SHUTTLE_LENGTH = 37;  // meters

  class SimRenderer {
    constructor(canvas) {
      const w = window.innerWidth;
      const h = window.innerHeight;

      // Initialize Three.js
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1e12);
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1;
      this.renderer.outputEncoding = THREE.sRGBEncoding;

      // View modes
      this.viewMode = 'chase';
      this.cameraDistance = 50;
      this.cameraAngle = { theta: 0, phi: 0.3 };
      this.cameraTarget = new THREE.Vector3(0, 0, 0);
      this.cameraPosition = new THREE.Vector3(0, 0, 0);
      this.cameraLerpFactor = 0.08;

      // Mouse/touch orbit controls (simple custom implementation)
      this.isDragging = false;
      this.lastMouse = { x: 0, y: 0 };
      this.orbitTarget = new THREE.Vector3(0, 0, 0);

      // Set up mouse event listeners for camera orbit
      canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
      canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
      canvas.addEventListener('mouseup', () => this.onMouseUp());
      canvas.addEventListener('mouseleave', () => this.onMouseUp());
      canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
      canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
      canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
      canvas.addEventListener('touchend', () => this.onTouchEnd());

      // Create scene elements
      this.createStarfield();
      this.createEarth();
      this.createMoon();
      this.createSun();
      this.createShuttle();
      this.createExhaustParticles();
      this.createOrbitLine();
      this.createAtmosphereGlow();

      // Resize handler
      window.addEventListener('resize', () => this.onResize());
    }

    onMouseDown(e) {
      if (e.button === 0) {
        this.isDragging = true;
        this.lastMouse = { x: e.clientX, y: e.clientY };
      }
    }

    onMouseMove(e) {
      if (this.isDragging) {
        const dx = e.clientX - this.lastMouse.x;
        const dy = e.clientY - this.lastMouse.y;
        this.cameraAngle.theta -= dx * 0.005;
        this.cameraAngle.phi = Math.max(0.05, Math.min(Math.PI - 0.05, this.cameraAngle.phi - dy * 0.005));
        this.lastMouse = { x: e.clientX, y: e.clientY };
      }
    }

    onMouseUp() {
      this.isDragging = false;
    }

    onWheel(e) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1.1 : 0.9;
      this.cameraDistance = Math.max(5, Math.min(5000, this.cameraDistance * delta));
    }

    onTouchStart(e) {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }

    onTouchMove(e) {
      if (this.isDragging && e.touches.length === 1) {
        const dx = e.touches[0].clientX - this.lastMouse.x;
        const dy = e.touches[0].clientY - this.lastMouse.y;
        this.cameraAngle.theta -= dx * 0.005;
        this.cameraAngle.phi = Math.max(0.05, Math.min(Math.PI - 0.05, this.cameraAngle.phi - dy * 0.005));
        this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }

    onTouchEnd() {
      this.isDragging = false;
    }

    createStarfield() {
      const starCount = 10000;
      const positions = new Float32Array(starCount * 3);
      const colors = new Float32Array(starCount * 3);
      const sizes = new Float32Array(starCount);

      const radius = 500000;
      for (let i = 0; i < starCount; i++) {
        // Random positions in a large sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = radius * (0.5 + Math.random() * 0.5);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);

        // Varying colors: white, slightly blue, slightly yellow
        const colorChoice = Math.random();
        if (colorChoice < 0.7) {
          colors[i * 3] = 1; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 1;
        } else if (colorChoice < 0.85) {
          colors[i * 3] = 0.9; colors[i * 3 + 1] = 0.95; colors[i * 3 + 2] = 1;
        } else {
          colors[i * 3] = 1; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 0.9;
        }

        sizes[i] = 0.5 + Math.random() * 2;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

      const material = new THREE.PointsMaterial({
        size: 2,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        sizeAttenuation: true
      });

      this.starfield = new THREE.Points(geometry, material);
      this.scene.add(this.starfield);
      this.starfieldTime = 0;
    }

    createEarth() {
      const geometry = new THREE.SphereGeometry(EARTH_RADIUS, 64, 48);
      const material = new THREE.MeshPhongMaterial({
        color: 0x2233aa,
        emissive: 0x001133,
        specular: 0x333333,
        shininess: 5,
        flatShading: false
      });
      this.earth = new THREE.Mesh(geometry, material);
      this.scene.add(this.earth);

      // Cloud layer
      const cloudGeometry = new THREE.SphereGeometry(EARTH_RADIUS * 1.02, 64, 48);
      const cloudMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide
      });
      this.clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
      this.scene.add(this.clouds);
    }

    createMoon() {
      const geometry = new THREE.SphereGeometry(MOON_RADIUS, 32, 24);
      const material = new THREE.MeshPhongMaterial({
        color: 0x888888,
        emissive: 0x222222,
        specular: 0x111111,
        shininess: 2
      });
      this.moon = new THREE.Mesh(geometry, material);
      this.moon.position.set(MOON_DISTANCE, 0, 0);
      this.scene.add(this.moon);
    }

    createSun() {
      this.ambientLight = new THREE.AmbientLight(0x222244, 0.3);
      this.scene.add(this.ambientLight);

      this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
      this.directionalLight.position.set(500000, 0, 0);
      this.directionalLight.castShadow = false;
      this.scene.add(this.directionalLight);

      this.pointLight = new THREE.PointLight(0xffffee, 0.5, 1000000);
      this.pointLight.position.set(500000, 0, 0);
      this.scene.add(this.pointLight);
    }

    createShuttle() {
      const s = SHUTTLE_LENGTH * SCALE;
      this.shuttleGroup = new THREE.Group();

      // Fuselage - elongated box/cylinder
      const fuselageGeom = new THREE.CylinderGeometry(s * 0.08, s * 0.12, s * 0.7, 8);
      const fuselageMat = new THREE.MeshPhongMaterial({ color: 0xf0f0f0 });
      const fuselage = new THREE.Mesh(fuselageGeom, fuselageMat);
      fuselage.rotation.z = Math.PI / 2;
      fuselage.position.x = s * 0.15;
      this.shuttleGroup.add(fuselage);

      // Cockpit - darker front
      const cockpitGeom = new THREE.SphereGeometry(s * 0.12, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      const cockpitMat = new THREE.MeshPhongMaterial({ color: 0x333333 });
      const cockpit = new THREE.Mesh(cockpitGeom, cockpitMat);
      cockpit.rotation.z = -Math.PI / 2;
      cockpit.position.x = -s * 0.2;
      this.shuttleGroup.add(cockpit);

      // Delta wings - triangular
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.lineTo(s * 0.5, -s * 0.15);
      wingShape.lineTo(s * 0.5, s * 0.15);
      wingShape.lineTo(0, 0);
      const wingGeom = new THREE.ShapeGeometry(wingShape);
      const wingMat = new THREE.MeshPhongMaterial({ color: 0xf0f0f0 });
      const wings = new THREE.Mesh(wingGeom, wingMat);
      wings.rotation.x = -Math.PI / 2;
      wings.position.set(s * 0.1, 0, 0);
      this.shuttleGroup.add(wings);

      // Vertical stabilizer (tail)
      const tailGeom = new THREE.BoxGeometry(s * 0.06, s * 0.25, s * 0.02);
      const tailMat = new THREE.MeshPhongMaterial({ color: 0xf0f0f0 });
      const tail = new THREE.Mesh(tailGeom, tailMat);
      tail.position.set(s * 0.45, s * 0.12, 0);
      this.shuttleGroup.add(tail);

      // Engine nozzles
      const nozzleGeom = new THREE.CylinderGeometry(s * 0.02, s * 0.04, s * 0.08, 8);
      const nozzleMat = new THREE.MeshPhongMaterial({ color: 0x333333 });
      for (let i = -1; i <= 1; i++) {
        const nozzle = new THREE.Mesh(nozzleGeom, nozzleMat);
        nozzle.rotation.z = Math.PI / 2;
        nozzle.position.set(s * 0.38, i * s * 0.04, 0);
        this.shuttleGroup.add(nozzle);
      }

      // External tank (orange cylinder)
      this.stackGroup = new THREE.Group();
      const etGeom = new THREE.CylinderGeometry(s * 0.15, s * 0.2, s * 1.2, 12);
      const etMat = new THREE.MeshPhongMaterial({ color: 0xe85c00 });
      this.externalTank = new THREE.Mesh(etGeom, etMat);
      this.externalTank.rotation.z = Math.PI / 2;
      this.externalTank.position.set(s * 0.9, 0, 0);
      this.stackGroup.add(this.externalTank);

      // SRBs (white cylinders)
      const srbGeom = new THREE.CylinderGeometry(s * 0.08, s * 0.1, s * 0.9, 12);
      const srbMat = new THREE.MeshPhongMaterial({ color: 0xf5f5f5 });
      this.srbLeft = new THREE.Mesh(srbGeom, srbMat);
      this.srbLeft.rotation.z = Math.PI / 2;
      this.srbLeft.position.set(s * 0.6, -s * 0.2, 0);
      this.stackGroup.add(this.srbLeft);
      this.srbRight = new THREE.Mesh(srbGeom, srbMat);
      this.srbRight.rotation.z = Math.PI / 2;
      this.srbRight.position.set(s * 0.6, s * 0.2, 0);
      this.stackGroup.add(this.srbRight);

      this.shuttleGroup.add(this.stackGroup);
      this.scene.add(this.shuttleGroup);

      // Heating glow (invisible until re-entry)
      this.heatingGlow = new THREE.Mesh(
        new THREE.SphereGeometry(s * 0.5, 16, 12),
        new THREE.MeshBasicMaterial({
          color: 0xff4400,
          transparent: true,
          opacity: 0,
          side: THREE.BackSide
        })
      );
      this.shuttleGroup.add(this.heatingGlow);
    }

    createExhaustParticles() {
      const maxParticles = 500;
      const positions = new Float32Array(maxParticles * 3);
      const colors = new Float32Array(maxParticles * 3);
      const sizes = new Float32Array(maxParticles);

      for (let i = 0; i < maxParticles; i++) {
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;
        colors[i * 3] = 1;
        colors[i * 3 + 1] = 0.8;
        colors[i * 3 + 2] = 0.3;
        sizes[i] = 0;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

      const material = new THREE.PointsMaterial({
        size: 3,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      this.exhaustParticles = new THREE.Points(geometry, material);
      this.exhaustParticles.frustumCulled = false;
      this.scene.add(this.exhaustParticles);

      this.particleData = [];
      for (let i = 0; i < maxParticles; i++) {
        this.particleData.push({
          x: 0, y: 0, z: 0,
          vx: 0, vy: 0, vz: 0,
          life: 0,
          maxLife: 0.3,
          size: 2
        });
      }
    }

    createOrbitLine() {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(3);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const material = new THREE.LineBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.6,
        linewidth: 1
      });

      this.orbitLine = new THREE.Line(geometry, material);
      this.orbitLine.frustumCulled = false;
      this.scene.add(this.orbitLine);
    }

    createAtmosphereGlow() {
      const geometry = new THREE.SphereGeometry(EARTH_RADIUS * 1.05, 64, 48);
      const material = new THREE.ShaderMaterial({
        uniforms: {
          c: { value: 0.3 },
          p: { value: 4.0 }
        },
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float c;
          uniform float p;
          varying vec3 vNormal;
          void main() {
            float intensity = pow(c - dot(vNormal, vec3(0.0, 0.0, 1.0)), p);
            gl_FragColor = vec4(0.3, 0.5, 1.0, intensity * 0.4);
          }
        `,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false
      });
      this.atmosphereGlow = new THREE.Mesh(geometry, material);
      this.scene.add(this.atmosphereGlow);
    }

    update(shuttle) {
      const scale = SCALE;
      const pos = shuttle.position;
      const rot = shuttle.rotation;

      // Shuttle position and rotation
      this.shuttleGroup.position.set(pos.x * scale, pos.y * scale, pos.z * scale);

      const pitch = rot.pitch;
      const yaw = rot.yaw;
      const roll = rot.roll;

      this.shuttleGroup.rotation.order = 'YXZ';
      this.shuttleGroup.rotation.y = yaw;
      this.shuttleGroup.rotation.x = pitch;
      this.shuttleGroup.rotation.z = roll;

      // Camera target (shuttle position)
      this.cameraTarget.set(pos.x * scale, pos.y * scale, pos.z * scale);

      // Update camera based on view mode
      if (this.viewMode === 'chase') {
        const dist = this.cameraDistance * scale;
        const camX = this.cameraTarget.x + dist * Math.sin(this.cameraAngle.theta) * Math.cos(this.cameraAngle.phi);
        const camY = this.cameraTarget.y + dist * Math.cos(this.cameraAngle.theta) * Math.cos(this.cameraAngle.phi);
        const camZ = this.cameraTarget.z + dist * Math.sin(this.cameraAngle.phi);

        this.cameraPosition.lerp(
          new THREE.Vector3(camX, camY, camZ),
          this.cameraLerpFactor
        );
        this.camera.position.copy(this.cameraPosition);
        this.camera.lookAt(this.cameraTarget);
      } else if (this.viewMode === 'orbit') {
        this.orbitTarget.set(0, 0, 0);
        const dist = this.cameraDistance * scale;
        const camX = this.orbitTarget.x + dist * Math.sin(this.cameraAngle.theta) * Math.cos(this.cameraAngle.phi);
        const camY = this.orbitTarget.y + dist * Math.cos(this.cameraAngle.theta) * Math.cos(this.cameraAngle.phi);
        const camZ = this.orbitTarget.z + dist * Math.sin(this.cameraAngle.phi);

        this.camera.position.set(camX, camY, camZ);
        this.camera.lookAt(this.orbitTarget);
      } else if (this.viewMode === 'free') {
        const dist = this.cameraDistance * scale;
        const camX = this.cameraTarget.x + dist * Math.sin(this.cameraAngle.theta) * Math.cos(this.cameraAngle.phi);
        const camY = this.cameraTarget.y + dist * Math.cos(this.cameraAngle.theta) * Math.cos(this.cameraAngle.phi);
        const camZ = this.cameraTarget.z + dist * Math.sin(this.cameraAngle.phi);

        this.camera.position.set(camX, camY, camZ);
        this.camera.lookAt(this.cameraTarget);
      }

      // Update orbit trail
      this.updateOrbitTrail(shuttle.trail);

      // Update exhaust particles
      this.updateExhaust(shuttle);

      // Show/hide stack components based on staging
      const stage = shuttle.currentStage || 0;
      this.stackGroup.visible = stage === 0;
      this.externalTank.visible = stage <= 1;
      this.srbLeft.visible = stage === 0;
      this.srbRight.visible = stage === 0;

      // Re-entry heating visual
      const heatingThreshold = 10000;
      if (shuttle.heatingRate > heatingThreshold) {
        const intensity = Math.min(1, (shuttle.heatingRate - heatingThreshold) / 50000);
        this.heatingGlow.material.opacity = intensity * 0.5;
        this.heatingGlow.material.color.setHex(0xff4400);
      } else {
        this.heatingGlow.material.opacity = 0;
      }

      // Star twinkle
      this.starfieldTime = (this.starfieldTime || 0) + 0.016;
      const sizes = this.starfield.geometry.attributes.size;
      if (sizes) {
        for (let i = 0; i < sizes.count; i++) {
          const base = sizes.array[i];
          sizes.array[i] = base * (0.8 + 0.4 * Math.sin(this.starfieldTime * 2 + i * 0.1));
        }
        sizes.needsUpdate = true;
      }
    }

    updateExhaust(shuttle) {
      if (!shuttle || shuttle.throttle <= 0) {
        for (let i = 0; i < this.particleData.length; i++) {
          this.particleData[i].life = 0;
        }
        this.exhaustParticles.geometry.attributes.position.needsUpdate = true;
        this.exhaustParticles.geometry.attributes.size.needsUpdate = true;
        return;
      }

      const scale = SCALE;
      const s = SHUTTLE_LENGTH * scale;
      const thrustDir = shuttle.getThrustDirection();
      const spawnPos = {
        x: this.shuttleGroup.position.x + thrustDir.x * (s * 0.38),
        y: this.shuttleGroup.position.y + thrustDir.y * (s * 0.38),
        z: this.shuttleGroup.position.z + thrustDir.z * (s * 0.38)
      };

      const dt = 0.016;
      const positions = this.exhaustParticles.geometry.attributes.position.array;
      const sizes = this.exhaustParticles.geometry.attributes.size.array;

      for (let i = 0; i < this.particleData.length; i++) {
        const p = this.particleData[i];

        if (p.life <= 0 && Math.random() < shuttle.throttle * 0.5) {
          p.x = spawnPos.x;
          p.y = spawnPos.y;
          p.z = spawnPos.z;
          const exhaustSpeed = 5;
          p.vx = -thrustDir.x * exhaustSpeed;
          p.vy = -thrustDir.y * exhaustSpeed;
          p.vz = -thrustDir.z * exhaustSpeed;
          p.life = p.maxLife;
          p.size = 1 + Math.random() * 2;
        }

        if (p.life > 0) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          p.vx *= 0.98;
          p.vy *= 0.98;
          p.vz *= 0.98;
          p.life -= dt;

          const t = 1 - p.life / p.maxLife;
          positions[i * 3] = p.x;
          positions[i * 3 + 1] = p.y;
          positions[i * 3 + 2] = p.z;
          sizes[i] = p.size * (1 - t);
        } else {
          positions[i * 3] = 0;
          positions[i * 3 + 1] = 0;
          positions[i * 3 + 2] = 0;
          sizes[i] = 0;
        }
      }

      this.exhaustParticles.geometry.attributes.position.needsUpdate = true;
      this.exhaustParticles.geometry.attributes.size.needsUpdate = true;
    }

    updateOrbitTrail(trail) {
      if (!trail || trail.length < 2) {
        this.orbitLine.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
        return;
      }

      const scale = SCALE;
      const positions = new Float32Array(trail.length * 3);
      for (let i = 0; i < trail.length; i++) {
        positions[i * 3] = trail[i].x * scale;
        positions[i * 3 + 1] = trail[i].y * scale;
        positions[i * 3 + 2] = trail[i].z * scale;
      }

      this.orbitLine.geometry.dispose();
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      this.orbitLine.geometry = geometry;
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
    }
  }

  global.SimRenderer = SimRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
