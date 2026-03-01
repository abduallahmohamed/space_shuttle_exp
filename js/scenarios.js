/**
 * Space Shuttle Physics Simulator - Mission Scenarios
 * Defines preset mission scenarios for the shuttle simulator.
 * Depends on SpacePhysics (physics.js) loaded before this file.
 */
(function (global) {
  'use strict';

  const Scenarios = {
    // Each scenario returns a configuration object for initializing the shuttle

    freeplay: {
      name: 'FREE PLAY',
      description: 'Start in low Earth orbit. Full control.',
      setup(shuttle) {
        const R = SpacePhysics.Constants.EARTH_RADIUS;
        const alt = 250000; // 250 km
        const r = R + alt;
        const orbitalVel = SpacePhysics.OrbitalMechanics.getOrbitalVelocity(alt);

        // Position on the "day side" of Earth
        shuttle.position = { x: r, y: 0, z: 0 };
        // Velocity perpendicular to radius for circular orbit
        shuttle.velocity = { x: 0, y: 0, z: orbitalVel };
        shuttle.rotation = { pitch: 0, yaw: Math.PI / 2, roll: 0 };

        shuttle.dryMass = 68585;
        shuttle.fuelMass = 10000; // Some OMS fuel
        shuttle.maxFuelMass = 10000;
        shuttle.maxThrust = 53400; // OMS only
        shuttle.specificImpulse = 316;
        shuttle.currentStage = 3;
        shuttle.throttle = 0;
        shuttle.met = 0;
        shuttle.trail = [];
      }
    },

    launch: {
      name: 'LAUNCH TO ORBIT',
      description: 'Launch from Kennedy Space Center. Full stack.',
      setup(shuttle) {
        const R = SpacePhysics.Constants.EARTH_RADIUS;
        const lat = 28.5 * Math.PI / 180; // KSC latitude

        // Position on Earth surface at KSC
        shuttle.position = {
          x: R * Math.cos(lat),
          y: R * Math.sin(lat),
          z: 0
        };
        // Initially stationary (relative to Earth surface - simplification)
        shuttle.velocity = { x: 0, y: 0, z: 0 };
        shuttle.rotation = { pitch: Math.PI / 2, yaw: 0, roll: 0 }; // pointing up

        shuttle.dryMass = 68585 + 2 * 68000 + 26500; // Orbiter + 2 SRBs + ET
        shuttle.fuelMass = 720000;
        shuttle.maxFuelMass = 720000;
        shuttle.maxThrust = 12500000 + 2 * 12500000; // SSMEs + SRBs
        shuttle.specificImpulse = 366;
        shuttle.currentStage = 0;
        shuttle.throttle = 0;
        shuttle.met = 0;
        shuttle.trail = [];
      }
    },

    orbit: {
      name: 'ORBITAL MECHANICS',
      description: 'In a 200x400 km elliptical orbit. Practice maneuvers.',
      setup(shuttle) {
        const R = SpacePhysics.Constants.EARTH_RADIUS;
        const alt = 200000; // Start at periapsis (200 km)
        const r = R + alt;

        // Calculate velocity for 200x400 km orbit
        // v at periapsis of elliptical orbit: v = sqrt(mu * (2/r - 1/a))
        // a = (r_pe + r_ap) / 2
        const r_ap = R + 400000;
        const a = (r + r_ap) / 2;
        const mu = SpacePhysics.Constants.EARTH_MU;
        const v = Math.sqrt(mu * (2 / r - 1 / a));

        shuttle.position = { x: r, y: 0, z: 0 };
        shuttle.velocity = { x: 0, y: 0, z: v };
        shuttle.rotation = { pitch: 0, yaw: Math.PI / 2, roll: 0 };

        shuttle.dryMass = 68585;
        shuttle.fuelMass = 8000;
        shuttle.maxFuelMass = 8000;
        shuttle.maxThrust = 53400;
        shuttle.specificImpulse = 316;
        shuttle.currentStage = 3;
        shuttle.throttle = 0;
        shuttle.met = 0;
        shuttle.trail = [];
      }
    },

    reentry: {
      name: 'RE-ENTRY',
      description: 'De-orbit and survive re-entry heating.',
      setup(shuttle) {
        const R = SpacePhysics.Constants.EARTH_RADIUS;
        const alt = 120000; // 120 km - edge of atmosphere
        const r = R + alt;

        // Sub-orbital velocity for re-entry trajectory
        const v = 7500; // m/s, slightly less than orbital

        shuttle.position = { x: r, y: 0, z: 0 };
        // Slight downward angle
        shuttle.velocity = { x: -v * 0.02, y: 0, z: v };
        shuttle.rotation = { pitch: -0.7, yaw: Math.PI / 2, roll: 0 }; // nose up for re-entry

        shuttle.dryMass = 68585;
        shuttle.fuelMass = 2000;
        shuttle.maxFuelMass = 2000;
        shuttle.maxThrust = 53400;
        shuttle.specificImpulse = 316;
        shuttle.dragCoefficient = 1.2; // belly-first re-entry
        shuttle.crossSectionArea = 350; // exposed area
        shuttle.currentStage = 3;
        shuttle.throttle = 0;
        shuttle.met = 0;
        shuttle.trail = [];
      }
    },

    moon: {
      name: 'MOON TRANSFER',
      description: 'Perform a trans-lunar injection burn.',
      setup(shuttle) {
        const R = SpacePhysics.Constants.EARTH_RADIUS;
        const alt = 250000;
        const r = R + alt;
        const orbitalVel = SpacePhysics.OrbitalMechanics.getOrbitalVelocity(alt);

        shuttle.position = { x: r, y: 0, z: 0 };
        shuttle.velocity = { x: 0, y: 0, z: orbitalVel };
        shuttle.rotation = { pitch: 0, yaw: Math.PI / 2, roll: 0 };

        shuttle.dryMass = 30000; // Lighter spacecraft for moon mission
        shuttle.fuelMass = 50000;
        shuttle.maxFuelMass = 50000;
        shuttle.maxThrust = 100000; // 100 kN engine
        shuttle.specificImpulse = 450; // Higher efficiency engine
        shuttle.currentStage = 3;
        shuttle.throttle = 0;
        shuttle.met = 0;
        shuttle.trail = [];
      }
    },

    docking: {
      name: 'DOCKING',
      description: 'Approach and dock with a target spacecraft.',
      setup(shuttle) {
        const R = SpacePhysics.Constants.EARTH_RADIUS;
        const alt = 400000; // ISS altitude
        const r = R + alt;
        const orbitalVel = SpacePhysics.OrbitalMechanics.getOrbitalVelocity(alt);

        shuttle.position = { x: r, y: 0, z: 0 };
        shuttle.velocity = { x: 0, y: 0, z: orbitalVel };
        shuttle.rotation = { pitch: 0, yaw: Math.PI / 2, roll: 0 };

        shuttle.dryMass = 68585;
        shuttle.fuelMass = 5000;
        shuttle.maxFuelMass = 5000;
        shuttle.maxThrust = 53400;
        shuttle.specificImpulse = 316;
        shuttle.currentStage = 3;
        shuttle.throttle = 0;
        shuttle.met = 0;
        shuttle.trail = [];

        // Return target info for the renderer to place a target spacecraft
        return {
          targetPosition: { x: r + 500, y: 200, z: 300 },
          targetVelocity: { x: 0, y: 0, z: orbitalVel }
        };
      }
    }
  };

  global.Scenarios = Scenarios;
})(typeof window !== 'undefined' ? window : globalThis);
