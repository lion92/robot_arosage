// ========================================
// DRONE ARROSEUR HD - GAME ENGINE
// ========================================

// Global variables - Déclaration d'abord
let scene, camera, renderer, composer;
let playerDrone;
let enemies = [];
let bullets = [];
let particles = [];
let plants = [];
let waterDrops = [];
let keys = {};
let mouse = { x: 0, y: 0 };
let cameraMode = 0;
let stats = {
    score: 0,
    plantsWatered: 0,
    waterLevel: 100,
    highScore: parseInt(localStorage.getItem('droneHighScore') || 0)
};
let ambientLight, sun, sky;
let waterRefillStation, lakeMesh;
let startTime = Date.now();
let clouds = [];
let gameRunning = false;
let gamePaused = false;
let gameTimeLimit = 5 * 60 * 1000; // 5 minutes
let remainingTime = gameTimeLimit;

const MAP_SIZE = 2000;
const CITY_BLOCKS = 8;
const BLOCK_SIZE = MAP_SIZE / CITY_BLOCKS;

// ========================================
// INITIALIZATION
// ========================================

function initThreeJS() {
    // Create scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.0003);

    // Create camera
    camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 5000);
    camera.position.set(0, 150, 200);

    // Create renderer
    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('c'),
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        precision: "highp",
        logarithmicDepthBuffer: true
    });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.physicallyCorrectLights = true;

    // Setup lighting after renderer is created
    setupLighting();
    createSky();
}

function setupLighting() {
    // Ambient light
    ambientLight = new THREE.HemisphereLight(0x87ceeb, 0x494949, 0.6);
    scene.add(ambientLight);

    // Sun light
    sun = new THREE.DirectionalLight(0xffd4a3, 2);
    sun.position.set(500, 800, 500);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 4096;
    sun.shadow.mapSize.height = 4096;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 3000;
    sun.shadow.camera.left = -1000;
    sun.shadow.camera.right = 1000;
    sun.shadow.camera.top = 1000;
    sun.shadow.camera.bottom = -1000;
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    // Rim light
    const rimLight = new THREE.DirectionalLight(0x88ccff, 0.5);
    rimLight.position.set(-300, 400, -300);
    scene.add(rimLight);
}

function createSky() {
    const skyGeo = new THREE.SphereGeometry(4000, 64, 64);
    const skyMat = new THREE.ShaderMaterial({
        uniforms: {
            topColor: { value: new THREE.Color(0x0088ff) },
            bottomColor: { value: new THREE.Color(0xffd4a3) },
            offset: { value: 400 },
            exponent: { value: 0.6 }
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize(vWorldPosition + offset).y;
                gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
            }
        `,
        side: THREE.BackSide
    });
    sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);
}

function createClouds() {
    const cloudGeometry = new THREE.SphereGeometry(1, 6, 6);

    for(let i = 0; i < 15; i++) {
        const cloudGroup = new THREE.Group();

        for(let j = 0; j < 8; j++) {
            const cloudPart = new THREE.Mesh(
                cloudGeometry,
                new THREE.MeshPhongMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.4,
                    depthWrite: false
                })
            );
            cloudPart.position.set(
                (Math.random() - 0.5) * 50,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 50
            );
            cloudPart.scale.setScalar(20 + Math.random() * 30);
            cloudGroup.add(cloudPart);
        }

        cloudGroup.position.set(
            (Math.random() - 0.5) * 3000,
            300 + Math.random() * 300,
            (Math.random() - 0.5) * 3000
        );
        cloudGroup.userData.speed = 0.05 + Math.random() * 0.1;
        clouds.push(cloudGroup);
        scene.add(cloudGroup);
    }
}

// ========================================
// PLANT CLASS
// ========================================

class Plant {
    constructor(position, type = 'flower') {
        const group = new THREE.Group();

        this.type = type;
        this.watered = false;
        this.health = 0;
        this.position = position;

        this.createModel(group, type);
        this.createIndicator(group);

        this.mesh = group;
        this.mesh.position.copy(position);
        scene.add(this.mesh);

        this.updateAppearance();
    }

    createModel(group, type) {
        if(type === 'flower') {
            this.createFlower(group);
            this.pointValue = 10;
        } else if(type === 'tree') {
            this.createTree(group);
            this.pointValue = 20;
        } else if(type === 'bush') {
            this.createBush(group);
            this.pointValue = 15;
        }
    }

    createFlower(group) {
        // Pot
        const potGeo = new THREE.CylinderGeometry(5, 4, 6, 12);
        const potMat = new THREE.MeshPhongMaterial({
            color: 0x8b4513,
            roughness: 0.7,
            metalness: 0.1
        });
        const pot = new THREE.Mesh(potGeo, potMat);
        pot.position.y = 3;
        pot.castShadow = true;
        pot.receiveShadow = true;
        group.add(pot);

        // Pot rim
        const rimGeo = new THREE.TorusGeometry(5, 0.5, 8, 12);
        const rim = new THREE.Mesh(rimGeo, potMat);
        rim.position.y = 6;
        rim.rotation.x = Math.PI / 2;
        group.add(rim);

        // Stem
        const stemGeo = new THREE.CylinderGeometry(0.4, 0.6, 12, 8);
        const stemMat = new THREE.MeshPhongMaterial({
            color: 0x228b22,
            emissive: 0x0a3d0a,
            emissiveIntensity: 0.2
        });
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.y = 12;
        group.add(stem);

        // Petals
        this.petals = [];
        const petalCount = 8;
        const petalGeo = new THREE.SphereGeometry(2.5, 8, 6);

        for(let i = 0; i < petalCount; i++) {
            const petalMat = new THREE.MeshPhongMaterial({
                color: new THREE.Color().setHSL(0.95, 0.8, 0.6),
                emissive: 0xff1493,
                emissiveIntensity: 0.1
            });
            const petal = new THREE.Mesh(petalGeo, petalMat);
            const angle = (i / petalCount) * Math.PI * 2;
            petal.position.set(
                Math.cos(angle) * 4,
                18,
                Math.sin(angle) * 4
            );
            petal.scale.set(1.2, 0.6, 1);
            petal.rotation.z = angle;
            group.add(petal);
            this.petals.push(petal);
        }

        // Center
        const centerGeo = new THREE.SphereGeometry(2, 12, 8);
        const centerMat = new THREE.MeshPhongMaterial({
            color: 0xffff00,
            emissive: 0xffaa00,
            emissiveIntensity: 0.5
        });
        const center = new THREE.Mesh(centerGeo, centerMat);
        center.position.y = 18;
        group.add(center);
    }

    createTree(group) {
        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(4, 5, 25, 10, 1);
        const trunkMat = new THREE.MeshPhongMaterial({
            color: 0x4a3c28,
            roughness: 0.9,
            metalness: 0
        });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 12.5;
        trunk.castShadow = true;
        group.add(trunk);

        // Foliage layers
        this.foliageLayers = [];
        for(let i = 0; i < 3; i++) {
            const foliageGeo = new THREE.DodecahedronGeometry(10 - i * 2, 1);
            const foliageMat = new THREE.MeshPhongMaterial({
                color: new THREE.Color().setHSL(0.25, 0.8, 0.3 - i * 0.05),
                flatShading: true,
                emissive: 0x0a4d0a,
                emissiveIntensity: 0.1
            });
            const foliage = new THREE.Mesh(foliageGeo, foliageMat);
            foliage.position.y = 28 + i * 5;
            foliage.rotation.y = Math.random() * Math.PI;
            foliage.castShadow = true;
            group.add(foliage);
            this.foliageLayers.push(foliage);
        }
    }

    createBush(group) {
        const bushGeo = new THREE.IcosahedronGeometry(10, 1);
        const bushMat = new THREE.MeshPhongMaterial({
            color: 0x2d5016,
            flatShading: true,
            emissive: 0x1a300d,
            emissiveIntensity: 0.2
        });
        this.bush = new THREE.Mesh(bushGeo, bushMat);
        this.bush.position.y = 8;
        this.bush.scale.set(1.8, 1, 1.8);
        this.bush.castShadow = true;
        group.add(this.bush);

        // Flowers on bush
        for(let i = 0; i < 8; i++) {
            const flowerGeo = new THREE.SphereGeometry(0.8, 6, 6);
            const flowerMat = new THREE.MeshPhongMaterial({
                color: new THREE.Color().setHSL(Math.random() * 0.1 + 0.9, 0.9, 0.7),
                emissive: 0xff00ff,
                emissiveIntensity: 0.3
            });
            const flower = new THREE.Mesh(flowerGeo, flowerMat);
            flower.position.set(
                (Math.random() - 0.5) * 15,
                5 + Math.random() * 8,
                (Math.random() - 0.5) * 15
            );
            group.add(flower);
        }
    }

    createIndicator(group) {
        // Light indicator
        this.indicator = new THREE.PointLight(0xff0000, 3, 40);
        this.indicator.position.y = 35;
        group.add(this.indicator);

        // Water drop icon
        const dropGroup = new THREE.Group();
        const dropGeo = new THREE.SphereGeometry(3, 8, 8);
        const dropMat = new THREE.MeshPhongMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.8,
            emissive: 0x0088ff,
            emissiveIntensity: 0.3
        });
        const drop = new THREE.Mesh(dropGeo, dropMat);
        drop.scale.set(1, 1.5, 1);
        dropGroup.add(drop);

        const dropTip = new THREE.Mesh(
            new THREE.ConeGeometry(2, 4, 8),
            dropMat
        );
        dropTip.position.y = -3;
        dropTip.rotation.x = Math.PI;
        dropGroup.add(dropTip);

        dropGroup.position.y = 40;
        this.waterIcon = dropGroup;
        group.add(dropGroup);
    }

    water(amount) {
        if(this.watered) return 0;

        this.health = Math.min(100, this.health + amount);

        if(this.health >= 100 && !this.watered) {
            this.watered = true;
            stats.plantsWatered++;
            stats.score += this.pointValue;

            showScorePopup(this.mesh.position, `+${this.pointValue}`);
            createWaterSplash(this.mesh.position, 30);

            updateHUD();

            return this.pointValue;
        }

        this.updateAppearance();
        return 0;
    }

    updateAppearance() {
        const healthRatio = this.health / 100;

        if(this.type === 'flower' && this.petals) {
            this.petals.forEach((petal, i) => {
                const hue = 0.95 - (1 - healthRatio) * 0.8;
                const sat = healthRatio * 0.8;
                const light = 0.3 + healthRatio * 0.3;
                petal.material.color.setHSL(hue, sat, light);
                petal.material.emissiveIntensity = healthRatio * 0.2;
            });
        } else if(this.type === 'tree' && this.foliageLayers) {
            this.foliageLayers.forEach((foliage, i) => {
                const hue = 0.25 - (1 - healthRatio) * 0.15;
                const sat = healthRatio * 0.8;
                const light = 0.2 + healthRatio * 0.2;
                foliage.material.color.setHSL(hue, sat, light);
            });
        } else if(this.type === 'bush' && this.bush) {
            const hue = 0.25 - (1 - healthRatio) * 0.15;
            const sat = healthRatio * 0.7;
            const light = 0.2 + healthRatio * 0.2;
            this.bush.material.color.setHSL(hue, sat, light);
        }

        if(this.watered) {
            this.indicator.color.setHex(0x00ff00);
            this.indicator.intensity = 1.5;
            this.waterIcon.visible = false;
        } else {
            const r = 1;
            const g = healthRatio;
            const b = 0;
            this.indicator.color.setRGB(r, g, b);
            this.indicator.intensity = 3 - healthRatio * 1.5;
            this.waterIcon.visible = true;
        }
    }

    update() {
        if(this.waterIcon && this.waterIcon.visible) {
            this.waterIcon.rotation.y += 0.03;
            this.waterIcon.position.y = 40 + Math.sin(Date.now() * 0.003) * 3;

            const pulse = 0.8 + Math.sin(Date.now() * 0.005) * 0.2;
            this.waterIcon.scale.setScalar(pulse);
        }

        if(this.watered) {
            this.mesh.rotation.y += 0.01;

            if(this.type === 'flower' && this.petals) {
                this.petals.forEach((petal, i) => {
                    petal.position.y = 18 + Math.sin(Date.now() * 0.002 + i) * 0.5;
                });
            }
        }

        if(this.indicator && !this.watered) {
            this.indicator.intensity = 3 + Math.sin(Date.now() * 0.01) * 1;
        }
    }
}

// ========================================
// PLAYER DRONE CLASS
// ========================================

class PlayerDrone {
    constructor() {
        const group = new THREE.Group();

        this.createBody(group);
        this.createRotors(group);
        this.createAccessories(group);

        this.mesh = group;
        this.mesh.position.set(0, 100, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.isWatering = false;
        this.lastWater = 0;

        scene.add(this.mesh);
    }

    createBody(group) {
        // Main body
        const bodyGeo = new THREE.OctahedronGeometry(15, 2);
        const bodyMat = new THREE.MeshPhongMaterial({
            color: 0x4facfe,
            emissive: 0x0066cc,
            emissiveIntensity: 0.4,
            metalness: 0.9,
            roughness: 0.1,
            reflectivity: 1
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        group.add(body);

        // Cockpit
        const cockpitGeo = new THREE.SphereGeometry(8, 16, 12);
        const cockpitMat = new THREE.MeshPhongMaterial({
            color: 0x88ddff,
            transparent: true,
            opacity: 0.6,
            emissive: 0x4488ff,
            emissiveIntensity: 0.3,
            shininess: 100
        });
        const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
        cockpit.position.y = 5;
        cockpit.scale.set(1, 0.7, 1);
        group.add(cockpit);

        // Water tank
        const tankGeo = new THREE.SphereGeometry(10, 16, 16);
        const tankMat = new THREE.MeshPhongMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.5,
            emissive: 0x0088ff,
            emissiveIntensity: 0.2
        });
        const tank = new THREE.Mesh(tankGeo, tankMat);
        tank.position.y = -10;
        tank.scale.set(0.8, 1, 0.8);
        group.add(tank);
        this.waterTank = tank;

        // Water level
        const waterGeo = new THREE.SphereGeometry(9, 16, 16);
        const waterMat = new THREE.MeshPhongMaterial({
            color: 0x00d4ff,
            transparent: true,
            opacity: 0.8,
            emissive: 0x00aaff,
            emissiveIntensity: 0.5
        });
        this.waterLevel = new THREE.Mesh(waterGeo, waterMat);
        this.waterLevel.position.y = -10;
        this.waterLevel.scale.set(0.8, 1, 0.8);
        group.add(this.waterLevel);
    }

    createRotors(group) {
        this.rotors = [];
        this.rotorBlurs = [];

        for(let i = 0; i < 4; i++) {
            const angle = (i/4) * Math.PI * 2;

            // Rotor arm
            const armGeo = new THREE.BoxGeometry(20, 2, 3);
            const armMat = new THREE.MeshPhongMaterial({
                color: 0x2a2a2a,
                metalness: 0.8,
                roughness: 0.2
            });
            const arm = new THREE.Mesh(armGeo, armMat);
            arm.position.x = Math.cos(angle) * 10;
            arm.position.z = Math.sin(angle) * 10;
            arm.position.y = 3;
            arm.rotation.y = angle;
            group.add(arm);

            // Rotor blade
            const rotorGeo = new THREE.BoxGeometry(15, 0.5, 4);
            const rotorMat = new THREE.MeshBasicMaterial({
                color: 0x111111,
                transparent: true,
                opacity: 0.9
            });
            const rotor = new THREE.Mesh(rotorGeo, rotorMat);
            rotor.position.x = Math.cos(angle) * 18;
            rotor.position.z = Math.sin(angle) * 18;
            rotor.position.y = 6;
            group.add(rotor);
            this.rotors.push(rotor);

            // Blur effect
            const blurGeo = new THREE.CylinderGeometry(15, 15, 0.2, 32);
            const blurMat = new THREE.MeshBasicMaterial({
                color: 0x333333,
                transparent: true,
                opacity: 0.2
            });
            const blur = new THREE.Mesh(blurGeo, blurMat);
            blur.position.x = Math.cos(angle) * 18;
            blur.position.z = Math.sin(angle) * 18;
            blur.position.y = 6;
            group.add(blur);
            this.rotorBlurs.push(blur);
        }
    }

    createAccessories(group) {
        // Water sprayer
        const sprayerGeo = new THREE.ConeGeometry(4, 10, 12);
        const sprayerMat = new THREE.MeshPhongMaterial({
            color: 0x00ffff,
            emissive: 0x00aaff,
            emissiveIntensity: 0.3,
            metalness: 0.7,
            roughness: 0.3
        });
        const sprayer = new THREE.Mesh(sprayerGeo, sprayerMat);
        sprayer.position.y = -15;
        sprayer.rotation.x = Math.PI;
        group.add(sprayer);

        // LED lights
        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00];
        for(let i = 0; i < 4; i++) {
            const angle = (i/4) * Math.PI * 2;
            const led = new THREE.PointLight(colors[i], 0.5, 20);
            led.position.x = Math.cos(angle) * 12;
            led.position.z = Math.sin(angle) * 12;
            group.add(led);
        }

        // Spotlight
        const spotlight = new THREE.SpotLight(0xffffff, 2, 500, Math.PI/6, 0.3, 1);
        spotlight.position.set(0, -10, 15);
        spotlight.target.position.set(0, -100, 100);
        spotlight.castShadow = true;
        spotlight.shadow.mapSize.width = 1024;
        spotlight.shadow.mapSize.height = 1024;
        group.add(spotlight);
        group.add(spotlight.target);
    }

    update() {
        // Animate rotors
        const rotorSpeed = 0.6 + this.velocity.length() * 2;
        this.rotors.forEach((rotor, i) => {
            rotor.rotation.y += rotorSpeed;
            this.rotorBlurs[i].rotation.y += rotorSpeed * 0.5;
            this.rotorBlurs[i].visible = rotorSpeed > 0.8;
        });

        // Movement physics
        const moveSpeed = 0.5;
        const rotSpeed = 0.05;

        if(keys['arrowleft']) {
            this.mesh.rotation.y += rotSpeed;
        }
        if(keys['arrowright']) {
            this.mesh.rotation.y -= rotSpeed;
        }

        if(keys['arrowup']) {
            this.velocity.x -= Math.sin(this.mesh.rotation.y) * moveSpeed;
            this.velocity.z -= Math.cos(this.mesh.rotation.y) * moveSpeed;
        }
        if(keys['arrowdown']) {
            this.velocity.x += Math.sin(this.mesh.rotation.y) * moveSpeed * 0.6;
            this.velocity.z += Math.cos(this.mesh.rotation.y) * moveSpeed * 0.6;
        }

        if(keys[' ']) {
            this.velocity.y = moveSpeed * 2.5;
        } else if(keys['shift']) {
            this.velocity.y = -moveSpeed * 2.5;
        } else {
            this.velocity.y *= 0.85;
        }

        // Apply drag
        this.velocity.x *= 0.92;
        this.velocity.z *= 0.92;

        this.mesh.position.add(this.velocity);

        // Boundaries
        const mapLimit = MAP_SIZE/2 - 50;
        this.mesh.position.x = Math.max(-mapLimit, Math.min(mapLimit, this.mesh.position.x));
        this.mesh.position.z = Math.max(-mapLimit, Math.min(mapLimit, this.mesh.position.z));
        this.mesh.position.y = Math.max(20, Math.min(500, this.mesh.position.y));

        // Dynamic tilt
        const targetTiltX = -this.velocity.z * 0.08;
        const targetTiltZ = -this.velocity.x * 0.08;
        this.mesh.rotation.x += (targetTiltX - this.mesh.rotation.x) * 0.15;
        this.mesh.rotation.z += (targetTiltZ - this.mesh.rotation.z) * 0.15;

        // Animate water tank
        const waterRatio = stats.waterLevel / 100;
        this.waterLevel.scale.y = 0.3 + waterRatio * 0.7;
        this.waterLevel.position.y = -10 - (1 - waterRatio) * 5;
        this.waterTank.material.opacity = 0.3 + waterRatio * 0.4;

        // Update HUD position
        document.getElementById('posX').textContent = Math.floor(this.mesh.position.x);
        document.getElementById('posZ').textContent = Math.floor(this.mesh.position.z);
        document.getElementById('altitude').textContent = Math.floor(this.mesh.position.y);
    }

    waterPlants() {
        const now = Date.now();
        if(now - this.lastWater < 80) return;
        if(stats.waterLevel <= 0) {
            showModeIndicator("💧 Réservoir vide! Touche P au lac!");
            return;
        }

        // Create water drops
        for(let i = 0; i < 5; i++) {
            const dropGeo = new THREE.SphereGeometry(0.8 + Math.random() * 0.5);
            const dropMat = new THREE.MeshPhongMaterial({
                color: 0x00aaff,
                transparent: true,
                opacity: 0.9,
                emissive: 0x0088ff,
                emissiveIntensity: 0.3
            });
            const drop = new THREE.Mesh(dropGeo, dropMat);
            drop.position.copy(this.mesh.position);
            drop.position.y -= 15;

            const spread = 3;
            drop.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * spread,
                -8 - Math.random() * 2,
                (Math.random() - 0.5) * spread
            );
            drop.life = 40;
            scene.add(drop);
            waterDrops.push(drop);
        }

        stats.waterLevel = Math.max(0, stats.waterLevel - 0.8);
        updateHUD();
        this.lastWater = now;

        // Water nearby plants
        plants.forEach(plant => {
            const dist = plant.mesh.position.distanceTo(this.mesh.position);
            if(dist < 60 && this.mesh.position.y < 120) {
                const effectiveness = Math.max(0, 1 - (dist / 60));
                plant.water(8 * effectiveness);
            }
        });
    }

    refillWater() {
        if(lakeMesh) {
            const dist = this.mesh.position.distanceTo(lakeMesh.position);
            if(dist < 80 && this.mesh.position.y < 60) {
                const oldLevel = stats.waterLevel;
                stats.waterLevel = Math.min(100, stats.waterLevel + 3);

                if(oldLevel < 100 && stats.waterLevel >= 100) {
                    showModeIndicator("💧 Réservoir plein!");
                    createWaterSplash(this.mesh.position, 20);
                }

                updateHUD();
            } else {
                showModeIndicator("🌊 Approchez-vous du lac central!");
            }
        }
    }
}

// ========================================
// CITY GENERATION
// ========================================

function generateCity() {
    createGround();
    createLake();
    generateRoads();
    generateBuildings();
    generateParks();
    generatePlants();
    createClouds();
}

function createGround() {
    const groundGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, 50, 50);
    const groundMat = new THREE.MeshPhongMaterial({
        color: 0x3a5f0b,
        roughness: 0.8,
        metalness: 0.1
    });

    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI/2;
    ground.receiveShadow = true;

    // Add terrain variation
    const vertices = ground.geometry.attributes.position.array;
    for(let i = 0; i < vertices.length; i += 3) {
        vertices[i + 1] = Math.sin(vertices[i] * 0.01) * 5 + Math.cos(vertices[i + 2] * 0.01) * 5;
    }
    ground.geometry.computeVertexNormals();
    scene.add(ground);
}

function createLake() {
    const lakeGeo = new THREE.CircleGeometry(120, 64);
    const lakeMat = new THREE.MeshPhongMaterial({
        color: 0x006994,
        transparent: true,
        opacity: 0.7,
        shininess: 100,
        reflectivity: 1,
        emissive: 0x004466,
        emissiveIntensity: 0.1
    });
    lakeMesh = new THREE.Mesh(lakeGeo, lakeMat);
    lakeMesh.rotation.x = -Math.PI/2;
    lakeMesh.position.y = 0.5;
    lakeMesh.receiveShadow = true;
    scene.add(lakeMesh);

    // Lake shore
    const shoreGeo = new THREE.TorusGeometry(125, 5, 8, 32);
    const shoreMat = new THREE.MeshPhongMaterial({
        color: 0x8b7355,
        roughness: 0.9
    });
    const shore = new THREE.Mesh(shoreGeo, shoreMat);
    shore.rotation.x = -Math.PI/2;
    shore.position.y = 1;
    scene.add(shore);

    // Fountain
    const fountainBase = new THREE.Mesh(
        new THREE.CylinderGeometry(15, 18, 8, 16),
        new THREE.MeshPhongMaterial({
            color: 0x808080,
            metalness: 0.5,
            roughness: 0.3
        })
    );
    fountainBase.position.y = 4;
    fountainBase.castShadow = true;
    scene.add(fountainBase);
}

function generateRoads() {
    const roadMat = new THREE.MeshPhongMaterial({
        color: 0x333333,
        roughness: 0.9
    });

    const linesMat = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        emissive: 0xffff00
    });

    for(let i = 1; i < CITY_BLOCKS; i++) {
        // Horizontal roads
        const roadH = new THREE.Mesh(
            new THREE.PlaneGeometry(MAP_SIZE, 40),
            roadMat
        );
        roadH.rotation.x = -Math.PI/2;
        roadH.position.set(0, 0.2, -MAP_SIZE/2 + i * BLOCK_SIZE);
        roadH.receiveShadow = true;
        scene.add(roadH);

        // Vertical roads
        const roadV = new THREE.Mesh(
            new THREE.PlaneGeometry(40, MAP_SIZE),
            roadMat
        );
        roadV.rotation.x = -Math.PI/2;
        roadV.position.set(-MAP_SIZE/2 + i * BLOCK_SIZE, 0.2, 0);
        roadV.receiveShadow = true;
        scene.add(roadV);
    }
}

function generateBuildings() {
    for(let i = 0; i < 25; i++) {
        const width = 50 + Math.random() * 80;
        const height = 60 + Math.random() * 200;
        const depth = 50 + Math.random() * 80;

        const buildingGeo = new THREE.BoxGeometry(width, height, depth);
        const hue = 0.55 + Math.random() * 0.1;
        const buildingMat = new THREE.MeshPhongMaterial({
            color: new THREE.Color().setHSL(hue, 0.2, 0.3),
            metalness: 0.5,
            roughness: 0.5
        });

        const building = new THREE.Mesh(buildingGeo, buildingMat);

        let x, z;
        do {
            x = (Math.random() - 0.5) * (MAP_SIZE - 200);
            z = (Math.random() - 0.5) * (MAP_SIZE - 200);
        } while(Math.sqrt(x*x + z*z) < 200);

        building.position.set(x, height/2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);
    }
}

function generateParks() {
    for(let i = 0; i < 5; i++) {
        const parkSize = 80 + Math.random() * 40;
        const parkGeo = new THREE.CircleGeometry(parkSize, 32);
        const parkMat = new THREE.MeshPhongMaterial({
            color: 0x2d5016,
            roughness: 0.9
        });

        const park = new THREE.Mesh(parkGeo, parkMat);
        park.rotation.x = -Math.PI/2;
        park.position.set(
            (Math.random() - 0.5) * (MAP_SIZE - 400),
            0.1,
            (Math.random() - 0.5) * (MAP_SIZE - 400)
        );

        if(park.position.length() > 200) {
            park.receiveShadow = true;
            scene.add(park);
        }
    }
}

function generatePlants() {
    plants.forEach(plant => {
        scene.remove(plant.mesh);
    });
    plants = [];

    const plantCount = 30;

    for(let i = 0; i < plantCount; i++) {
        const types = ['flower', 'tree', 'bush'];
        const weights = [0.5, 0.3, 0.2];
        const random = Math.random();
        let type = 'flower';

        if(random < weights[0]) type = 'flower';
        else if(random < weights[0] + weights[1]) type = 'tree';
        else type = 'bush';

        let x, z;
        let validPosition = false;

        while(!validPosition) {
            x = (Math.random() - 0.5) * (MAP_SIZE - 150);
            z = (Math.random() - 0.5) * (MAP_SIZE - 150);

            if(Math.sqrt(x*x + z*z) > 180) {
                validPosition = true;
                for(let plant of plants) {
                    const dist = Math.sqrt(
                        Math.pow(x - plant.position.x, 2) +
                        Math.pow(z - plant.position.z, 2)
                    );
                    if(dist < 60) {
                        validPosition = false;
                        break;
                    }
                }
            }
        }

        const plant = new Plant(new THREE.Vector3(x, 0, z), type);
        plants.push(plant);
    }

    document.getElementById('totalPlants').textContent = plants.length;
}

// ========================================
// EFFECTS
// ========================================

function createWaterSplash(position, count = 20) {
    for(let i = 0; i < count; i++) {
        const particleGeo = new THREE.SphereGeometry(Math.random() * 1 + 0.5);
        const particleMat = new THREE.MeshPhongMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.9,
            emissive: 0x0088ff,
            emissiveIntensity: 0.4
        });
        const particle = new THREE.Mesh(particleGeo, particleMat);
        particle.position.copy(position);
        particle.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 8,
            Math.random() * 15,
            (Math.random() - 0.5) * 8
        );
        particle.life = 40;
        scene.add(particle);
        particles.push({
            mesh: particle,
            position: particle.position,
            velocity: particle.velocity,
            life: particle.life
        });
    }
}

function showScorePopup(position, text) {
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = text;

    const vector = position.clone();
    vector.project(camera);

    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

    popup.style.left = x + 'px';
    popup.style.top = y + 'px';

    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 2000);
}

function showModeIndicator(text) {
    const indicator = document.createElement('div');
    indicator.className = 'mode-indicator';
    indicator.textContent = text;
    indicator.style.color = '#00ffaa';
    document.body.appendChild(indicator);
    setTimeout(() => indicator.remove(), 2500);
}

// ========================================
// GAME MANAGEMENT
// ========================================

function startNewGame() {
    gameRunning = true;
    gamePaused = false;
    stats.score = 0;
    stats.plantsWatered = 0;
    stats.waterLevel = 100;
    startTime = Date.now();
    remainingTime = gameTimeLimit;

    document.getElementById('gameOver').style.display = 'none';

    generatePlants();

    if(playerDrone) {
        playerDrone.mesh.position.set(0, 100, 0);
        playerDrone.velocity.set(0, 0, 0);
    }

    showModeIndicator("🏁 NOUVELLE PARTIE - 5 MINUTES!");
    updateHUD();
}

function pauseGame() {
    if(!gameRunning) return;

    gamePaused = !gamePaused;
    if(gamePaused) {
        showModeIndicator("⏸️ JEU EN PAUSE");
    } else {
        showModeIndicator("▶️ JEU REPRIS");
        startTime = Date.now() - (gameTimeLimit - remainingTime);
    }
}

function endGame() {
    gameRunning = false;

    const gameOverDiv = document.getElementById('gameOver');
    document.getElementById('finalScore').textContent = stats.score;
    document.getElementById('finalPlants').textContent = stats.plantsWatered;

    let comparison = "";
    if(stats.score > stats.highScore) {
        comparison = "🏆 NOUVEAU RECORD! 🏆";
        stats.highScore = stats.score;
        localStorage.setItem('droneHighScore', stats.highScore);
    } else if(stats.score === stats.highScore) {
        comparison = "🎯 Égalité avec le record!";
    } else {
        comparison = `Record à battre: ${stats.highScore} points`;
    }

    document.getElementById('scoreComparison').textContent = comparison;
    gameOverDiv.style.display = 'block';

    showModeIndicator("⏰ TEMPS ÉCOULÉ!");
}

function updateHUD() {
    document.getElementById('score').textContent = stats.score;
    document.getElementById('plantsWatered').textContent = stats.plantsWatered;
    document.getElementById('water').style.width = stats.waterLevel + '%';
    document.getElementById('highScore').textContent = stats.highScore;
}

function updateTimer() {
    if(!gameRunning || gamePaused) return;

    const elapsed = Date.now() - startTime;
    remainingTime = gameTimeLimit - elapsed;

    if(remainingTime <= 0) {
        remainingTime = 0;
        endGame();
    }

    const totalSeconds = Math.ceil(remainingTime / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const timerElement = document.getElementById('timeRemaining');
    timerElement.textContent = `⏰ TEMPS: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    if(totalSeconds <= 30) {
        timerElement.classList.add('urgent');
        if(totalSeconds <= 10 && totalSeconds > 0) {
            showModeIndicator(`⏰ ${totalSeconds} SECONDES!`);
        }
    } else {
        timerElement.classList.remove('urgent');
    }
}

function toggleCamera() {
    cameraMode = (cameraMode + 1) % 3;
    const modes = ['3ème Personne', 'FPS', 'Vue du Dessus'];
    showModeIndicator(`📷 Vue: ${modes[cameraMode]}`);
}

function updateCamera() {
    if(!playerDrone) return;

    switch(cameraMode) {
        case 0: // Third person
            const offset = new THREE.Vector3(0, 60, 120);
            offset.applyQuaternion(playerDrone.mesh.quaternion);
            camera.position.lerp(
                playerDrone.mesh.position.clone().add(offset),
                0.1
            );
            camera.lookAt(playerDrone.mesh.position);
            break;
        case 1: // FPS
            camera.position.copy(playerDrone.mesh.position);
            camera.position.y += 8;
            const lookDir = new THREE.Vector3(0, 0, -100);
            lookDir.applyQuaternion(playerDrone.mesh.quaternion);
            camera.lookAt(playerDrone.mesh.position.clone().add(lookDir));
            break;
        case 2: // Top down
            camera.position.set(
                playerDrone.mesh.position.x,
                playerDrone.mesh.position.y + 250,
                playerDrone.mesh.position.z + 50
            );
            camera.lookAt(playerDrone.mesh.position);
            break;
    }
}

function updateRadar() {
    if(!playerDrone) return;

    const canvas = document.getElementById('radarCanvas');
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 200, 200);

    // Grid
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
    for(let i = 0; i <= 200; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 200);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(200, i);
        ctx.stroke();
    }

    // Player
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(100, 100, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Plants
    plants.forEach(plant => {
        const dx = (plant.mesh.position.x - playerDrone.mesh.position.x) / 5;
        const dz = (plant.mesh.position.z - playerDrone.mesh.position.z) / 5;

        if(Math.abs(dx) < 100 && Math.abs(dz) < 100) {
            if(plant.watered) {
                ctx.fillStyle = '#00ff00';
            } else {
                const healthRatio = plant.health / 100;
                const r = Math.floor(255);
                const g = Math.floor(255 * healthRatio);
                ctx.fillStyle = `rgb(${r}, ${g}, 0)`;
            }

            ctx.beginPath();
            ctx.arc(100 + dx, 100 + dz, plant.watered ? 2 : 4, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // Lake
    if(lakeMesh) {
        const dx = (lakeMesh.position.x - playerDrone.mesh.position.x) / 5;
        const dz = (lakeMesh.position.z - playerDrone.mesh.position.z) / 5;

        if(Math.abs(dx) < 100 && Math.abs(dz) < 100) {
            ctx.fillStyle = '#0088ff';
            ctx.beginPath();
            ctx.arc(100 + dx, 100 + dz, 15, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// ========================================
// INPUT HANDLING
// ========================================

window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;

    if(e.key.toLowerCase() === 'm' && gameRunning && !gamePaused) {
        playerDrone.waterPlants();
    }
    if(e.key.toLowerCase() === 'p' && gameRunning && !gamePaused) {
        playerDrone.refillWater();
    }
    if(e.key.toLowerCase() === 'c') {
        toggleCamera();
    }
});

window.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
});

window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

// ========================================
// ANIMATION LOOP
// ========================================

function animate() {
    requestAnimationFrame(animate);

    const time = Date.now() * 0.001;

    // Update game objects
    if(playerDrone && gameRunning && !gamePaused) {
        playerDrone.update();

        if(keys['p']) {
            playerDrone.refillWater();
        }
        if(keys['m']) {
            playerDrone.waterPlants();
        }
    }

    // Animate clouds
    clouds.forEach(cloud => {
        cloud.position.x += cloud.userData.speed;
        if(cloud.position.x > 2000) cloud.position.x = -2000;
        cloud.rotation.y += 0.001;
    });

    // Update plants
    if(gameRunning && !gamePaused) {
        plants.forEach(plant => plant.update());
    }

    // Update water drops
    waterDrops = waterDrops.filter(drop => {
        if(gamePaused) return true;

        drop.position.add(drop.velocity);
        drop.velocity.y -= 0.4;
        drop.velocity.x *= 0.98;
        drop.velocity.z *= 0.98;
        drop.life--;

        if(drop.position.y <= 0) {
            createWaterSplash(drop.position, 5);
            scene.remove(drop);
            return false;
        }

        if(drop.life <= 0) {
            scene.remove(drop);
            return false;
        }

        const scale = drop.life / 40;
        drop.scale.setScalar(scale);
        drop.material.opacity = 0.9 * scale;

        return true;
    });

    // Update particles
    particles = particles.filter(p => {
        if(gamePaused) return true;

        if(p.mesh && p.velocity) {
            p.position.add(p.velocity);
            p.velocity.y -= 0.5;
            p.life--;

            if(p.mesh.material) {
                p.mesh.material.opacity = p.life / 40;
            }

            if(p.life <= 0) {
                scene.remove(p.mesh);
                return false;
            }
        }
        return true;
    });

    // Dynamic lighting (only if sun exists)
    if(sun) {
        const dayProgress = (Math.sin(time * 0.02) + 1) / 2;
        sun.intensity = 1.5 + dayProgress * 0.5;
        sun.position.x = Math.cos(time * 0.02) * 500;
        sun.position.y = 600 + Math.sin(time * 0.02) * 200;
    }

    // Update zone
    let zone = "Centre Ville";
    if(playerDrone) {
        const px = playerDrone.mesh.position.x;
        const pz = playerDrone.mesh.position.z;

        if(Math.sqrt(px*px + pz*pz) < 120) {
            zone = "🌊 Lac Central (Touche P)";
        } else if(px > MAP_SIZE/3) {
            zone = "🏢 Quartier Est";
        } else if(px < -MAP_SIZE/3) {
            zone = "🏛️ Quartier Ouest";
        } else if(pz > MAP_SIZE/3) {
            zone = "🏭 Zone Nord";
        } else if(pz < -MAP_SIZE/3) {
            zone = "🏘️ Banlieue Sud";
        }
    }
    document.getElementById('zone').textContent = zone;

    updateCamera();
    updateRadar();
    updateTimer();

    // Render only if scene and camera are ready
    if(scene && camera && renderer) {
        renderer.render(scene, camera);
    }
}

// ========================================
// INITIALIZATION
// ========================================

// Initialize the game when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    // Initialize Three.js
    initThreeJS();

    // Create player drone after scene is ready
    playerDrone = new PlayerDrone();

    // Generate city
    generateCity();

    // Start animation
    animate();

    // Show welcome message
    setTimeout(() => {
        showModeIndicator("🎮 Bienvenue! Cliquez 'Nouvelle Partie'!");
        setTimeout(() => {
            showModeIndicator("💧 Touche M pour arroser, P pour recharger!");
        }, 3000);
    }, 1000);
});

// Make functions globally accessible for HTML buttons
window.startNewGame = startNewGame;
window.pauseGame = pauseGame;
window.toggleCamera = toggleCamera;