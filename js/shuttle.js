/**
 * Space Shuttle Physics Simulator
 * Defines the Shuttle class for the space shuttle vehicle and its state.
 * Depends on SpacePhysics (physics.js) loaded before this file.
 */
(function (global) {
  'use strict';

  class Shuttle {
    constructor(config = {}) {
      // Vehicle properties
      this.dryMass = config.dryMass || 68585;        // kg (orbiter dry mass)
      this.fuelMass = config.fuelMass || 720000;     // kg (total propellant)
      this.maxFuelMass = this.fuelMass;
      this.maxThrust = config.maxThrust || 12500000;  // N (12,500 kN combined)
      this.specificImpulse = config.isp || 366;       // seconds
      this.dragCoefficient = config.cd || 0.8;
      this.crossSectionArea = config.area || 180;     // m²

      // State
      this.position = { x: 0, y: 0, z: 0 };  // meters from Earth center
      this.velocity = { x: 0, y: 0, z: 0 };   // m/s
      this.rotation = { pitch: 0, yaw: 0, roll: 0 }; // radians
      this.angularVelocity = { pitch: 0, yaw: 0, roll: 0 }; // rad/s

      // Control state
      this.throttle = 0;            // 0 to 1
      this.rcsEnabled = false;
      this.sasEnabled = false;
      this.gearDeployed = false;
      this.currentStage = 0;        // 0=full stack, 1=SRB sep, 2=ET sep, 3=orbiter only

      // Computed values (updated each frame)
      this.altitude = 0;            // meters above surface
      this.speed = 0;               // m/s magnitude
      this.orbitalElements = {};
      this.gForce = 0;
      this.machNumber = 0;
      this.dynamicPressure = 0;
      this.heatingRate = 0;
      this.dragForce = { x: 0, y: 0, z: 0 };
      this.thrustForce = { x: 0, y: 0, z: 0 };
      this.gravityAccel = { x: 0, y: 0, z: 0 };

      // Mission elapsed time
      this.met = 0; // seconds

      // Trail for orbit visualization
      this.trail = [];
      this.maxTrailPoints = 2000;
    }

    get totalMass() {
      return this.dryMass + this.fuelMass;
    }

    get fuelFraction() {
      return this.fuelMass / this.maxFuelMass;
    }

    getThrustDirection() {
      // Thrust direction based on shuttle orientation (pitch, yaw)
      // Default is along the velocity vector (prograde)
      // Use rotation to transform the base thrust direction
      const cp = Math.cos(this.rotation.pitch);
      const sp = Math.sin(this.rotation.pitch);
      const cy = Math.cos(this.rotation.yaw);
      const sy = Math.sin(this.rotation.yaw);
      return {
        x: cp * cy,
        y: sp,
        z: cp * sy
      };
    }

    update(dt) {
      const Vec3 = SpacePhysics.Vec3;
      const Physics = SpacePhysics;

      // Calculate altitude
      this.altitude = Vec3.magnitude(this.position) - Physics.Constants.EARTH_RADIUS;
      this.speed = Vec3.magnitude(this.velocity);

      // SAS: auto-stabilize angular velocity
      if (this.sasEnabled) {
        this.angularVelocity.pitch *= 0.95;
        this.angularVelocity.yaw *= 0.95;
        this.angularVelocity.roll *= 0.95;
      }

      // Update rotation from angular velocity
      this.rotation.pitch += this.angularVelocity.pitch * dt;
      this.rotation.yaw += this.angularVelocity.yaw * dt;
      this.rotation.roll += this.angularVelocity.roll * dt;

      // Derivative function for RK4
      const self = this;
      const derivativeFn = (state) => {
        const r = Vec3.magnitude(state.position);
        const alt = r - Physics.Constants.EARTH_RADIUS;
        const v = Vec3.magnitude(state.velocity);

        // Gravity
        const grav = Physics.Gravity.getAcceleration(state.position);

        // Atmospheric drag
        let dragAccel = { x: 0, y: 0, z: 0 };
        if (alt < 200000 && alt > 0 && v > 0) {
          const dragF = Physics.Drag.getForce(state.velocity, alt, self.dragCoefficient, self.crossSectionArea);
          dragAccel = Vec3.scale(dragF, 1 / self.totalMass);
          self.dragForce = dragF;
        } else {
          self.dragForce = { x: 0, y: 0, z: 0 };
        }

        // Thrust
        let thrustAccel = { x: 0, y: 0, z: 0 };
        if (self.throttle > 0 && self.fuelMass > 0) {
          const thrustMag = self.maxThrust * self.throttle;
          const thrustDir = self.getThrustDirection();
          const tForce = Vec3.scale(thrustDir, thrustMag);
          thrustAccel = Vec3.scale(tForce, 1 / self.totalMass);
          self.thrustForce = tForce;
        } else {
          self.thrustForce = { x: 0, y: 0, z: 0 };
        }

        // Total acceleration
        const totalAccel = Vec3.add(Vec3.add(grav, dragAccel), thrustAccel);

        return {
          dPosition: state.velocity,
          dVelocity: totalAccel
        };
      };

      // Check if crashed
      if (this.altitude <= 0) {
        if (this.speed > 5) {
          // Crash! Stop simulation for this object
          this.altitude = 0;
          this.velocity = { x: 0, y: 0, z: 0 };
          const r = Physics.Constants.EARTH_RADIUS;
          const norm = Vec3.normalize(this.position);
          this.position = Vec3.scale(norm, r);
          return 'crashed';
        }
        return 'landed';
      }

      // Integrate
      const state = { position: { ...this.position }, velocity: { ...this.velocity } };
      const newState = Physics.Integrator.rk4(state, dt, derivativeFn);
      this.position = newState.position;
      this.velocity = newState.velocity;

      // Consume fuel
      if (this.throttle > 0 && this.fuelMass > 0) {
        const massFlowRate = (self.maxThrust * self.throttle) / (self.specificImpulse * 9.81);
        this.fuelMass = Math.max(0, this.fuelMass - massFlowRate * dt);
      }

      // Update computed values
      this.altitude = Vec3.magnitude(this.position) - Physics.Constants.EARTH_RADIUS;
      this.speed = Vec3.magnitude(this.velocity);
      this.orbitalElements = Physics.OrbitalMechanics.getOrbitalElements(this.position, this.velocity);
      this.gForce = Vec3.magnitude(Vec3.add(
        Physics.Gravity.getAcceleration(this.position),
        Vec3.scale(this.thrustForce, 1 / this.totalMass)
      )) / 9.81;

      if (this.altitude < 200000) {
        this.machNumber = Physics.Atmosphere.getMachNumber(this.speed, this.altitude);
        this.dynamicPressure = 0.5 * Physics.Atmosphere.getDensity(this.altitude) * this.speed * this.speed;
        this.heatingRate = Physics.Drag.getHeatingRate(this.speed, this.altitude);
      } else {
        this.machNumber = 0;
        this.dynamicPressure = 0;
        this.heatingRate = 0;
      }

      // Update MET
      this.met += dt;

      // Update trail
      this.trail.push({ ...this.position });
      if (this.trail.length > this.maxTrailPoints) {
        this.trail.shift();
      }

      return 'flying';
    }

    // Stage separation
    performStaging() {
      this.currentStage++;
      if (this.currentStage === 1) {
        // SRB separation - reduce dry mass and adjust thrust
        this.dryMass -= 2 * 68000; // 2 SRBs
        this.maxThrust -= 2 * 12500000; // SRB thrust removed
        this.maxThrust = Math.max(this.maxThrust, 2090000); // SSME thrust remains
      } else if (this.currentStage === 2) {
        // External tank separation
        this.dryMass -= 26500; // ET mass
        this.maxThrust = 2090000; // SSMEs only
      } else if (this.currentStage === 3) {
        // OMS engines only
        this.maxThrust = 53400; // 2x OMS engines
        this.specificImpulse = 316;
      }
      return this.currentStage;
    }

    // Apply rotation input
    applyRotation(axis, value) {
      const rcsForce = this.rcsEnabled ? 2.0 : 0.5;
      if (axis === 'pitch') this.angularVelocity.pitch += value * rcsForce * 0.01;
      if (axis === 'yaw') this.angularVelocity.yaw += value * rcsForce * 0.01;
      if (axis === 'roll') this.angularVelocity.roll += value * rcsForce * 0.01;
    }

    // Point in specific direction relative to velocity
    pointPrograde() {
      const vel = SpacePhysics.Vec3.normalize(this.velocity);
      this.rotation.pitch = Math.asin(vel.y);
      this.rotation.yaw = Math.atan2(vel.z, vel.x);
    }

    pointRetrograde() {
      const vel = SpacePhysics.Vec3.normalize(SpacePhysics.Vec3.scale(this.velocity, -1));
      this.rotation.pitch = Math.asin(vel.y);
      this.rotation.yaw = Math.atan2(vel.z, vel.x);
    }

    // Reset the shuttle - reinitialize all values
    reset(config = {}) {
      // Vehicle properties
      this.dryMass = config.dryMass || 68585;
      this.fuelMass = config.fuelMass || 720000;
      this.maxFuelMass = this.fuelMass;
      this.maxThrust = config.maxThrust || 12500000;
      this.specificImpulse = config.isp || 366;
      this.dragCoefficient = config.cd || 0.8;
      this.crossSectionArea = config.area || 180;

      // State
      this.position = config.position ? { ...config.position } : { x: 0, y: 0, z: 0 };
      this.velocity = config.velocity ? { ...config.velocity } : { x: 0, y: 0, z: 0 };
      this.rotation = config.rotation ? { ...config.rotation } : { pitch: 0, yaw: 0, roll: 0 };
      this.angularVelocity = config.angularVelocity ? { ...config.angularVelocity } : { pitch: 0, yaw: 0, roll: 0 };

      // Control state
      this.throttle = config.throttle ?? 0;
      this.rcsEnabled = config.rcsEnabled ?? false;
      this.sasEnabled = config.sasEnabled ?? false;
      this.gearDeployed = config.gearDeployed ?? false;
      this.currentStage = config.currentStage ?? 0;

      // Computed values (derive from position/velocity)
      this.altitude = SpacePhysics.Vec3.magnitude(this.position) - SpacePhysics.Constants.EARTH_RADIUS;
      this.speed = SpacePhysics.Vec3.magnitude(this.velocity);
      this.orbitalElements = SpacePhysics.OrbitalMechanics.getOrbitalElements(this.position, this.velocity);
      this.gForce = 0;
      this.machNumber = 0;
      this.dynamicPressure = 0;
      this.heatingRate = 0;
      this.dragForce = { x: 0, y: 0, z: 0 };
      this.thrustForce = { x: 0, y: 0, z: 0 };
      this.gravityAccel = { x: 0, y: 0, z: 0 };

      // Mission elapsed time
      this.met = config.met ?? 0;

      // Trail
      this.trail = config.trail ? [...config.trail] : [];
      this.maxTrailPoints = config.maxTrailPoints ?? 2000;
    }

    // Serialize state
    getState() {
      return {
        position: { ...this.position },
        velocity: { ...this.velocity },
        rotation: { ...this.rotation },
        altitude: this.altitude,
        speed: this.speed,
        fuelMass: this.fuelMass,
        totalMass: this.totalMass,
        fuelFraction: this.fuelFraction,
        throttle: this.throttle,
        met: this.met,
        orbitalElements: { ...this.orbitalElements },
        gForce: this.gForce,
        machNumber: this.machNumber,
        dynamicPressure: this.dynamicPressure,
        heatingRate: this.heatingRate,
        stage: this.currentStage,
        rcs: this.rcsEnabled,
        sas: this.sasEnabled,
        gear: this.gearDeployed,
        status: this.altitude <= 0 ? 'ground' : 'flying'
      };
    }
  }

  // Expose globally
  global.Shuttle = Shuttle;
})(typeof window !== 'undefined' ? window : globalThis);
