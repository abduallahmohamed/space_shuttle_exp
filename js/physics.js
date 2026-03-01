/**
 * Space Physics Engine - Core physics module for space shuttle simulation
 * All units: SI (meters, seconds, kilograms, Newtons)
 */
(function (global) {
  'use strict';

  const SpacePhysics = {};

  // ============================================================================
  // Constants
  // ============================================================================
  SpacePhysics.Constants = {
    G: 6.674e-11,
    EARTH_MASS: 5.972e24,
    EARTH_RADIUS: 6371000,
    EARTH_MU: null, // Set below
    MOON_MASS: 7.342e22,
    MOON_RADIUS: 1737000,
    MOON_DISTANCE: 384400000,
    ATM_SCALE_HEIGHT: 8500,
    SEA_LEVEL_DENSITY: 1.225,
    SEA_LEVEL_PRESSURE: 101325,
    SEA_LEVEL_TEMP: 288.15,
    BOLTZMANN: 1.381e-23,
    STEFAN_BOLTZMANN: 5.67e-8
  };
  SpacePhysics.Constants.EARTH_MU =
    SpacePhysics.Constants.G * SpacePhysics.Constants.EARTH_MASS;

  const C = SpacePhysics.Constants;
  const MU = C.EARTH_MU;
  const R_EARTH = C.EARTH_RADIUS;

  // ============================================================================
  // Atmosphere Model
  // ============================================================================
  SpacePhysics.Atmosphere = {
    ATMOSPHERE_LIMIT: 200000, // 200 km

    getDensity(altitude) {
      if (altitude >= this.ATMOSPHERE_LIMIT) return 0;
      return C.SEA_LEVEL_DENSITY * Math.exp(-altitude / C.ATM_SCALE_HEIGHT);
    },

    getPressure(altitude) {
      if (altitude >= this.ATMOSPHERE_LIMIT) return 0;
      return C.SEA_LEVEL_PRESSURE * Math.exp(-altitude / C.ATM_SCALE_HEIGHT);
    },

    getTemperature(altitude) {
      const altKm = altitude / 1000;
      if (altKm <= 11) {
        return 288.15 - 6.5 * altKm;
      }
      if (altKm <= 20) {
        return 216.65;
      }
      if (altKm <= 32) {
        return 216.65 + (altKm - 20);
      }
      if (altKm <= 47) {
        return 228.65 + 2.8 * (altKm - 32);
      }
      // Above 47 km: mesosphere/thermosphere - gradual decrease then increase
      if (altKm <= 86) {
        return 270.65 - 2.8 * (altKm - 47);
      }
      if (altKm <= 100) {
        return 186.87 + 1.5 * (altKm - 86);
      }
      // Above 100 km: thermosphere - gradual increase
      return 186.87 + 1.5 * 14 + 2.8 * (altKm - 100);
    },

    getSpeedOfSound(altitude) {
      const T = this.getTemperature(altitude);
      return Math.sqrt(1.4 * 287 * T);
    },

    getMachNumber(velocity, altitude) {
      const speedOfSound = this.getSpeedOfSound(altitude);
      if (speedOfSound <= 0) return Infinity;
      const v = typeof velocity === 'number' ? velocity : SpacePhysics.Vec3.magnitude(velocity);
      return v / speedOfSound;
    }
  };

  // ============================================================================
  // Gravity
  // ============================================================================
  SpacePhysics.Gravity = {
    getAcceleration(position) {
      const r = Math.max(SpacePhysics.Vec3.magnitude(position), 1); // Avoid singularity
      const r3 = r * r * r;
      const ax = (-MU / r3) * position.x;
      const ay = (-MU / r3) * position.y;
      const az = (-MU / r3) * position.z;
      return { x: ax, y: ay, z: az };
    },

    getSurfaceGravity() {
      return 9.81;
    }
  };

  // ============================================================================
  // Orbital Mechanics
  // ============================================================================
  SpacePhysics.OrbitalMechanics = {
    getOrbitalElements(position, velocity) {
      const r = Math.max(SpacePhysics.Vec3.magnitude(position), 1);
      const v = SpacePhysics.Vec3.magnitude(velocity);

      const specificEnergy = (v * v) / 2 - MU / r;
      const hVec = SpacePhysics.Vec3.cross(position, velocity);
      const h = SpacePhysics.Vec3.magnitude(hVec);

      let semiMajorAxis;
      let eccentricity;
      let apoapsisAlt;
      let periapsisAlt;

      if (h < 1e-6) {
        return {
          semiMajorAxis: r,
          eccentricity: 1,
          inclination: 0,
          apoapsisAltitude: r - R_EARTH,
          periapsisAltitude: r - R_EARTH,
          orbitalPeriod: Infinity,
          specificEnergy,
          specificAngularMomentum: h
        };
      }

      const inclination = Math.acos(Math.max(-1, Math.min(1, hVec.z / h)));

      if (specificEnergy >= 0) {
        semiMajorAxis = -MU / (2 * specificEnergy);
        eccentricity = Math.sqrt(1 + (2 * specificEnergy * h * h) / (MU * MU));
        if (eccentricity >= 1) {
          apoapsisAlt = Infinity;
          periapsisAlt = semiMajorAxis * (1 - eccentricity) - R_EARTH;
        } else {
          const rApo = semiMajorAxis * (1 + eccentricity);
          const rPeri = semiMajorAxis * (1 - eccentricity);
          apoapsisAlt = rApo - R_EARTH;
          periapsisAlt = rPeri - R_EARTH;
        }
      } else {
        semiMajorAxis = -MU / (2 * specificEnergy);
        eccentricity = Math.sqrt(1 + (2 * specificEnergy * h * h) / (MU * MU));
        const rApo = semiMajorAxis * (1 + eccentricity);
        const rPeri = semiMajorAxis * (1 - eccentricity);
        apoapsisAlt = rApo - R_EARTH;
        periapsisAlt = rPeri - R_EARTH;
      }

      const orbitalPeriod =
        eccentricity < 1
          ? 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / MU)
          : Infinity;

      return {
        semiMajorAxis,
        eccentricity,
        inclination: (inclination * 180) / Math.PI,
        apoapsisAltitude: apoapsisAlt,
        periapsisAltitude: periapsisAlt,
        orbitalPeriod,
        specificEnergy,
        specificAngularMomentum: h
      };
    },

    getOrbitalVelocity(altitude) {
      const r = R_EARTH + altitude;
      return Math.sqrt(MU / r);
    },

    getEscapeVelocity(altitude) {
      const r = R_EARTH + altitude;
      return Math.sqrt((2 * MU) / r);
    },

    hohmannTransfer(r1, r2) {
      const aTransfer = (r1 + r2) / 2;
      const dv1 =
        Math.sqrt(MU / r1) * (Math.sqrt((2 * r2) / (r1 + r2)) - 1);
      const dv2 =
        Math.sqrt(MU / r2) * (1 - Math.sqrt((2 * r1) / (r1 + r2)));
      const transferTime = Math.PI * Math.sqrt(Math.pow(aTransfer, 3) / MU);
      return { dv1, dv2, transferTime };
    }
  };

  // ============================================================================
  // Drag
  // ============================================================================
  SpacePhysics.Drag = {
    HEATING_K: 1.7415e-4,
    R_NOSE: 1.0,

    getForce(velocity, altitude, Cd, area) {
      const density = SpacePhysics.Atmosphere.getDensity(altitude);
      const v = SpacePhysics.Vec3.magnitude(velocity);
      if (v < 1e-6) return { x: 0, y: 0, z: 0 };

      const fMag = 0.5 * density * v * v * Cd * area;
      const vHat = SpacePhysics.Vec3.normalize(velocity);
      return SpacePhysics.Vec3.scale(vHat, -fMag);
    },

    getHeatingRate(velocity, altitude) {
      const density = SpacePhysics.Atmosphere.getDensity(altitude);
      const v = typeof velocity === 'number' ? velocity : SpacePhysics.Vec3.magnitude(velocity);
      return (
        this.HEATING_K *
        Math.sqrt(density / this.R_NOSE) *
        Math.pow(v, 3)
      );
    }
  };

  // ============================================================================
  // Integrator (4th-order Runge-Kutta)
  // ============================================================================
  SpacePhysics.Integrator = {
    rk4(state, dt, derivativeFn) {
      const k1 = derivativeFn(state);
      const state1 = {
        position: SpacePhysics.Vec3.add(
          state.position,
          SpacePhysics.Vec3.scale(k1.dPosition, dt / 2)
        ),
        velocity: SpacePhysics.Vec3.add(
          state.velocity,
          SpacePhysics.Vec3.scale(k1.dVelocity, dt / 2)
        )
      };

      const k2 = derivativeFn(state1);
      const state2 = {
        position: SpacePhysics.Vec3.add(
          state.position,
          SpacePhysics.Vec3.scale(k2.dPosition, dt / 2)
        ),
        velocity: SpacePhysics.Vec3.add(
          state.velocity,
          SpacePhysics.Vec3.scale(k2.dVelocity, dt / 2)
        )
      };

      const k3 = derivativeFn(state2);
      const state3 = {
        position: SpacePhysics.Vec3.add(
          state.position,
          SpacePhysics.Vec3.scale(k3.dPosition, dt)
        ),
        velocity: SpacePhysics.Vec3.add(
          state.velocity,
          SpacePhysics.Vec3.scale(k3.dVelocity, dt)
        )
      };

      const k4 = derivativeFn(state3);

      const dt6 = dt / 6;
      const newPosition = {
        x:
          state.position.x +
          dt6 * (k1.dPosition.x + 2 * k2.dPosition.x + 2 * k3.dPosition.x + k4.dPosition.x),
        y:
          state.position.y +
          dt6 * (k1.dPosition.y + 2 * k2.dPosition.y + 2 * k3.dPosition.y + k4.dPosition.y),
        z:
          state.position.z +
          dt6 * (k1.dPosition.z + 2 * k2.dPosition.z + 2 * k3.dPosition.z + k4.dPosition.z)
      };
      const newVelocity = {
        x:
          state.velocity.x +
          dt6 * (k1.dVelocity.x + 2 * k2.dVelocity.x + 2 * k3.dVelocity.x + k4.dVelocity.x),
        y:
          state.velocity.y +
          dt6 * (k1.dVelocity.y + 2 * k2.dVelocity.y + 2 * k3.dVelocity.y + k4.dVelocity.y),
        z:
          state.velocity.z +
          dt6 * (k1.dVelocity.z + 2 * k2.dVelocity.z + 2 * k3.dVelocity.z + k4.dVelocity.z)
      };

      return { position: newPosition, velocity: newVelocity };
    }
  };

  // ============================================================================
  // Vector Utilities (Vec3)
  // ============================================================================
  SpacePhysics.Vec3 = {
    add(a, b) {
      return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
    },

    sub(a, b) {
      return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
    },

    scale(v, s) {
      return { x: v.x * s, y: v.y * s, z: v.z * s };
    },

    dot(a, b) {
      return a.x * b.x + a.y * b.y + a.z * b.z;
    },

    cross(a, b) {
      return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
      };
    },

    magnitude(v) {
      return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    },

    normalize(v) {
      const m = this.magnitude(v);
      if (m < 1e-12) return { x: 0, y: 0, z: 0 };
      return { x: v.x / m, y: v.y / m, z: v.z / m };
    },

    distance(a, b) {
      return this.magnitude(this.sub(a, b));
    }
  };

  // Export to global
  global.SpacePhysics = SpacePhysics;
})(typeof window !== 'undefined' ? window : globalThis);
