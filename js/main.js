(function () {
    'use strict';

    let shuttle, renderer, hud, controls;
    let isPaused = false;
    let lastTime = 0;
    let currentScenario = 'freeplay';
    let targetInfo = null;

    function init() {
        updateLoadingStatus('Creating shuttle...');
        shuttle = new Shuttle();

        updateLoadingStatus('Initializing renderer...');
        const canvas = document.getElementById('sim-canvas');
        renderer = new SimRenderer(canvas);

        updateLoadingStatus('Setting up HUD...');
        hud = new HUD();

        updateLoadingStatus('Configuring controls...');
        controls = new Controls(
            shuttle,
            onScenarioChange,
            onReset,
            onViewChange
        );

        loadScenario('freeplay');

        updateLoadingStatus('Systems online. Launching...');
        setTimeout(() => {
            const loadingScreen = document.getElementById('loading-screen');
            loadingScreen.classList.add('hidden');
            requestAnimationFrame(gameLoop);
        }, 800);
    }

    function updateLoadingStatus(msg) {
        const el = document.querySelector('.loader-status');
        if (el) el.textContent = msg;
    }

    function loadScenario(name) {
        const scenario = Scenarios[name];
        if (!scenario) return;

        currentScenario = name;
        targetInfo = scenario.setup(shuttle) || null;
        shuttle.altitude = SpacePhysics.Vec3.magnitude(shuttle.position) - SpacePhysics.Constants.EARTH_RADIUS;
        shuttle.speed = SpacePhysics.Vec3.magnitude(shuttle.velocity);
        shuttle.orbitalElements = SpacePhysics.OrbitalMechanics.getOrbitalElements(shuttle.position, shuttle.velocity);
        hud.setMissionName(scenario.name);

        if (renderer.targetMesh) {
            renderer.targetMesh.visible = !!targetInfo;
            if (targetInfo) {
                const s = 0.001;
                renderer.targetMesh.position.set(
                    targetInfo.targetPosition.x * s,
                    targetInfo.targetPosition.y * s,
                    targetInfo.targetPosition.z * s
                );
            }
        }

        controls.showNotification(
            scenario.name + ': ' + scenario.description,
            'info'
        );
    }

    function onScenarioChange(name) {
        loadScenario(name);
    }

    function onReset() {
        loadScenario(currentScenario);
        controls.showNotification('Simulation reset', 'success');
    }

    function onViewChange(mode) {
        renderer.setViewMode(mode);
        controls.showNotification('Camera: ' + mode, 'info');
    }

    function gameLoop(timestamp) {
        requestAnimationFrame(gameLoop);

        if (lastTime === 0) {
            lastTime = timestamp;
            return;
        }

        let rawDt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;

        rawDt = Math.min(rawDt, 0.1);

        if (controls.isPaused) {
            renderer.update(shuttle);
            renderer.render();
            return;
        }

        controls.processInput(rawDt);

        const dt = rawDt * controls.timeWarp;

        const maxStep = 1;
        let remaining = dt;
        while (remaining > 0) {
            const step = Math.min(remaining, maxStep);
            const status = shuttle.update(step);

            if (status === 'crashed') {
                controls.showNotification(
                    'SHUTTLE DESTROYED - Impact at ' +
                        Math.round(shuttle.speed) + ' m/s',
                    'error'
                );
                controls.isPaused = true;
                break;
            }
            if (status === 'landed') {
                controls.showNotification('Touchdown!', 'success');
                controls.isPaused = true;
                break;
            }
            remaining -= step;
        }

        if (targetInfo) {
            updateTarget(rawDt);
        }

        const state = shuttle.getState();
        hud.update(state, controls.timeWarp);

        renderer.update(shuttle);
        renderer.render();
    }

    function updateTarget(dt) {
        if (!targetInfo) return;
        const Vec3 = SpacePhysics.Vec3;
        const grav = SpacePhysics.Gravity.getAcceleration(targetInfo.targetPosition);
        targetInfo.targetVelocity = Vec3.add(
            targetInfo.targetVelocity,
            Vec3.scale(grav, dt * controls.timeWarp)
        );
        targetInfo.targetPosition = Vec3.add(
            targetInfo.targetPosition,
            Vec3.scale(targetInfo.targetVelocity, dt * controls.timeWarp)
        );
        if (renderer.targetMesh) {
            const s = 0.001;
            renderer.targetMesh.position.set(
                targetInfo.targetPosition.x * s,
                targetInfo.targetPosition.y * s,
                targetInfo.targetPosition.z * s
            );
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
