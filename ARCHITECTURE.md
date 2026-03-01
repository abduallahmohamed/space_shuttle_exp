# Agentic Team Architecture

This project was built by an orchestrated team of AI agents, each with a specialized role. Below is the structure and execution flow.

## Team Structure

```
                          ┌─────────────────────┐
                          │       MANAGER        │
                          │  (Orchestrator)      │
                          │                      │
                          │  - Final review      │
                          │  - Git/PR management │
                          │  - Progress tracking │
                          └──────────┬───────────┘
                                     │
                          ┌──────────┴───────────┐
                          │    PROJECT MANAGER    │
                          │                       │
                          │  - Requirements       │
                          │  - Milestones         │
                          │  - Tech stack choice  │
                          │  - Task breakdown     │
                          └──────────┬────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
   ┌──────────┴──────────┐ ┌────────┴─────────┐ ┌─────────┴──────────┐
   │     LEAD SWE        │ │   UX DESIGNER    │ │  PHYSICS & SPACE   │
   │                     │ │                  │ │     EXPERT         │
   │ - Architecture      │ │ - Dark space     │ │                    │
   │ - File structure    │ │   theme design   │ │ - Gravity model    │
   │ - Three.js + HTML   │ │ - HUD layout     │ │ - Atmosphere model │
   │ - GitHub Pages CI   │ │ - Control panel  │ │ - Orbital mechanics│
   │ - Code review       │ │ - Color system   │ │ - Drag & heating   │
   │ - Module boundaries │ │ - Responsive CSS │ │ - Rocket equation  │
   └──────────┬──────────┘ └──────────────────┘ └─────────┬──────────┘
              │                                           │
              │            ┌──────────────────┐           │
              │            │ SIMULATION EXPERT │           │
              │            │                   │           │
              │            │ - RK4 integrator  ├───────────┘
              │            │ - Vec3 utilities  │
              │            │ - State management│
              │            │ - Numerical       │
              │            │   stability       │
              │            └────────┬──────────┘
              │                     │
              ▼                     ▼
   ┌────────────────────────────────────────────────────────┐
   │                    SWE  (x3 parallel)                  │
   │                                                        │
   │  Agent 1: renderer.js     Agent 2: shuttle.js          │
   │  - Three.js scene         - Shuttle class              │
   │  - Earth/Moon/stars       - Staging logic              │
   │  - Shuttle 3D model       - Fuel consumption           │
   │  - Exhaust particles      - State serialization        │
   │  - Camera system          scenarios.js                 │
   │  - Orbit trail            - 6 mission presets          │
   │                           - Orbital parameters         │
   │                                                        │
   │  Agent 3: hud.js + controls.js                         │
   │  - Telemetry display      - Keyboard input             │
   │  - Attitude indicator     - UI panel wiring            │
   │  - Number formatting      - Slider controls            │
   │  - Fuel/throttle bars     - Notifications              │
   │                                                        │
   │  main.js (orchestrator wrote directly)                  │
   │  - Game loop              - Scenario loading           │
   │  - Module wiring          - Target tracking            │
   └────────────────────────┬───────────────────────────────┘
                            │
                 ┌──────────┴──────────┐
                 │         QA          │
                 │                     │
                 │ - Syntax validation │
                 │ - Physics accuracy  │
                 │   tests (orbital    │
                 │   velocity, period, │
                 │   escape velocity)  │
                 │ - Integration tests │
                 │ - Missing file      │
                 │   detection         │
                 │ - Floating-point    │
                 │   edge cases        │
                 │ - Module interface  │
                 │   verification      │
                 └─────────────────────┘
```

## Execution Flow

```
   Phase 1  ──►  PM defines requirements
                 Lead SWE sets architecture
                 UX Designer creates CSS theme
                 Physics Expert defines models
                        │
                        ▼  [COMMIT 1 ─► push]

   Phase 2  ──►  Simulation Expert builds physics.js
                 SWE agents run IN PARALLEL:
                   ┌─ Agent 1: renderer.js
                   ├─ Agent 2: shuttle.js + scenarios.js
                   └─ Agent 3: hud.js + controls.js
                 Orchestrator writes main.js
                        │
                        ▼  [COMMIT 2 ─► push]

   Phase 3  ──►  QA reviews all modules
                 Finds: missing hud.css, renderer bugs,
                        state gaps, float precision
                 Fixes applied
                        │
                        ▼  [COMMITS 3,4 ─► push]

   Phase 4  ──►  Lead SWE configures GitHub Pages
                 Manager merges to main
                        │
                        ▼  [COMMITS 5,6 ─► push]

   Phase 5  ──►  SWE overhauls camera system
                 (chase, close-up, cockpit, flyby, orbit)
                 QA syntax check
                        │
                        ▼  [COMMIT 7 ─► push]
```

## Key Design Decision

The **3 SWE agents ran in parallel** during Phase 2. The renderer, shuttle/scenarios, and HUD/controls modules had no dependencies on each other (only on the physics engine from Phase 1), so they were built simultaneously. The QA agent then caught integration issues between the parallel outputs (missing files, interface mismatches, numerical edge cases).
