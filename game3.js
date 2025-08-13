// ========================================
// DRONE SQUAD - VERSION CORRIGÉE
// ARROSAGE RAPIDE EN 1 SECONDE
// ========================================

// Configuration globale
const CONFIG = {
    WATERING_TIME: 1000,        // 1 seconde pour arroser
    WATERING_DISTANCE: 50,      // Distance pour arroser
    WATERING_HEIGHT: 40,        // Hauteur d'arrosage
    DRONE_SPEED: 2.0,           // Vitesse de déplacement
    WATER_PER_PLANT: 20,        // 20% du réservoir par plante
    REFILL_SPEED: 10            // Vitesse de recharge au lac
};

// Variables globales
let scene, camera, renderer;
let aiDrones = [];
let plants = [];
let waterDrops = [];
let particles = [];
let lakeMesh;
let sun, ambientLight;
let gameRunning = false;
let gamePaused = false;
let startTime;
let droneCount = 3;

let stats = {
    score: 0,
    plantsWatered: 0,
    totalPlants: 0,
    highScore: parseInt(localStorage.getItem('droneHighScore') || 0)
};

const MAP_SIZE = 1500;

// ========================================
// CLASSE PLANT SIMPLIFIÉE
// ========================================
class Plant {
    constructor(position, type = 'flower') {
        this.position = position;
        this.type = type;
        this.health = 0;
        this.watered = false;
        this.pointValue = type === 'tree' ? 20 : type === 'bush' ? 15 : 10;

        // Créer le mesh
        this.createMesh();

        // Créer l'indicateur
        this.createIndicator();
    }

    createMesh() {
        const group = new THREE.Group();

        if (this.type === 'flower') {
            // Pot
            const potGeo = new THREE.CylinderGeometry(5, 4, 6, 8);
            const potMat = new THREE.MeshPhongMaterial({ color: 0x8b4513 });
            const pot = new THREE.Mesh(potGeo, potMat);
            pot.position.y = 3;
            group.add(pot);

            // Fleur
            const flowerGeo = new THREE.SphereGeometry(8, 16, 16);
            this.flowerMat = new THREE.MeshPhongMaterial({
                color: 0xff6666,
                emissive: 0x440000,
                emissiveIntensity: 0.2
            });
            this.flower = new THREE.Mesh(flowerGeo, this.flowerMat);
            this.flower.position.y = 18;
            this.flower.scale.set(1.5, 1, 1.5);
            group.add(this.flower);

        } else if (this.type === 'tree') {
            // Tronc
            const trunkGeo = new THREE.CylinderGeometry(4, 5, 25, 8);
            const trunkMat = new THREE.MeshPhongMaterial({ color: 0x4a3c28 });
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 12.5;
            group.add(trunk);

            // Feuillage
            const foliageGeo = new THREE.ConeGeometry(15, 20, 8);
            this.foliageMat = new THREE.MeshPhongMaterial({
                color: 0x994444,
                flatShading: true
            });
            this.foliage = new THREE.Mesh(foliageGeo, this.foliageMat);
            this.foliage.position.y = 30;
            group.add(this.foliage);

        } else {
            // Buisson
            const bushGeo = new THREE.SphereGeometry(12, 8, 6);
            this.bushMat = new THREE.MeshPhongMaterial({
                color: 0x885544,
                flatShading: true
            });
            this.bush = new THREE.Mesh(bushGeo, this.bushMat);
            this.bush.position.y = 10;
            this.bush.scale.set(1.5, 1, 1.5);
            group.add(this.bush);
        }

        this.mesh = group;
        this.mesh.position.copy(this.position);
        scene.add(this.mesh);
    }

    createIndicator() {
        // Lumière rouge au-dessus
        this.indicator = new THREE.PointLight(0xff0000, 2, 50);
        this.indicator.position.copy(this.position);
        this.indicator.position.y = 40;
        scene.add(this.indicator);

        // Icône d'eau
        const dropGeo = new THREE.SphereGeometry(3, 8, 8);
        const dropMat = new THREE.MeshBasicMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.8
        });
        this.waterIcon = new THREE.Mesh(dropGeo, dropMat);
        this.waterIcon.position.copy(this.position);
        this.waterIcon.position.y = 45;
        this.waterIcon.scale.set(1, 1.5, 1);
        scene.add(this.waterIcon);
    }

    startWatering() {
        console.log(`🌱 Début arrosage ${this.type}`);
        this.wateringStartTime = Date.now();
    }

    updateWatering() {
        if (!this.wateringStartTime || this.watered) return false;

        const elapsed = Date.now() - this.wateringStartTime;
        const progress = Math.min(100, (elapsed / CONFIG.WATERING_TIME) * 100);

        this.health = progress;
        this.updateAppearance();

        // Arrosage terminé
        if (elapsed >= CONFIG.WATERING_TIME) {
            this.completeWatering();
            return true;
        }

        return false;
    }

    completeWatering() {
        this.health = 100;
        this.watered = true;
        this.wateringStartTime = null;

        // Changer apparence
        this.updateAppearance();

        // Retirer indicateurs
        if (this.indicator) {
            scene.remove(this.indicator);
            this.indicator = null;
        }
        if (this.waterIcon) {
            scene.remove(this.waterIcon);
            this.waterIcon = null;
        }

        // Effet de complétion
        this.createCompletionEffect();

        console.log(`✅ ${this.type} arrosé! Points: ${this.pointValue}`);
    }

    updateAppearance() {
        const healthRatio = this.health / 100;

        if (this.type === 'flower' && this.flowerMat) {
            // Rouge → Vert
            const hue = this.watered ? 0.3 : (0 + healthRatio * 0.3);
            const sat = this.watered ? 0.8 : 0.6;
            const light = 0.4 + healthRatio * 0.2;
            this.flowerMat.color.setHSL(hue, sat, light);

            if (this.watered) {
                this.flowerMat.emissive = new THREE.Color(0x00ff00);
                this.flowerMat.emissiveIntensity = 0.2;
                this.flower.scale.setScalar(1.3);
            }

        } else if (this.type === 'tree' && this.foliageMat) {
            const hue = this.watered ? 0.3 : (0.1 + healthRatio * 0.2);
            const sat = this.watered ? 0.7 : 0.4;
            const light = 0.3 + healthRatio * 0.2;
            this.foliageMat.color.setHSL(hue, sat, light);

            if (this.watered) {
                this.foliageMat.emissive = new THREE.Color(0x00ff00);
                this.foliageMat.emissiveIntensity = 0.1;
                this.foliage.scale.setScalar(1.2);
            }

        } else if (this.type === 'bush' && this.bushMat) {
            const hue = this.watered ? 0.3 : (0.08 + healthRatio * 0.22);
            const sat = this.watered ? 0.6 : 0.3;
            const light = 0.3 + healthRatio * 0.2;
            this.bushMat.color.setHSL(hue, sat, light);

            if (this.watered) {
                this.bushMat.emissive = new THREE.Color(0x00ff00);
                this.bushMat.emissiveIntensity = 0.1;
                this.bush.scale.setScalar(1.25);
            }
        }

        // Mettre à jour l'indicateur
        if (this.indicator && !this.watered) {
            const intensity = 3 - healthRatio * 2;
            this.indicator.intensity = intensity;
            this.indicator.color.setHSL(0, 1 - healthRatio * 0.7, 0.5);
        }
    }

    createCompletionEffect() {
        // Particules vertes
        for(let i = 0; i < 10; i++) {
            const particleGeo = new THREE.SphereGeometry(1, 6, 6);
            const particleMat = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                transparent: true,
                opacity: 0.8
            });
            const particle = new THREE.Mesh(particleGeo, particleMat);
            particle.position.copy(this.position);
            particle.position.y += 20;

            const angle = (i / 10) * Math.PI * 2;
            particle.velocity = new THREE.Vector3(
                Math.cos(angle) * 5,
                10 + Math.random() * 5,
                Math.sin(angle) * 5
            );
            particle.life = 40;

            scene.add(particle);
            particles.push(particle);
        }
    }

    update() {
        // Animation de l'icône d'eau
        if (this.waterIcon && !this.watered) {
            this.waterIcon.rotation.y += 0.05;
            this.waterIcon.position.y = 45 + Math.sin(Date.now() * 0.003) * 3;
        }

        // Rotation douce si arrosé
        if (this.watered) {
            this.mesh.rotation.y += 0.003;
        }
    }
}

// ========================================
// CLASSE DRONE SIMPLIFIÉE
// ========================================
class AIDrone {
    constructor(id, startPos) {
        this.id = id;
        this.position = startPos.clone();
        this.velocity = new THREE.Vector3();
        this.waterLevel = 100;
        this.state = 'SEARCHING';
        this.target = null;
        this.plantsWatered = 0;

        this.createMesh();
    }

    createMesh() {
        const group = new THREE.Group();

        // Corps
        const bodyGeo = new THREE.OctahedronGeometry(10, 1);
        const bodyMat = new THREE.MeshPhongMaterial({
            color: new THREE.Color().setHSL(this.id * 0.15, 0.8, 0.5),
            metalness: 0.5,
            roughness: 0.3
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);

        // Rotors
        this.rotors = [];
        for(let i = 0; i < 4; i++) {
            const angle = (i/4) * Math.PI * 2;
            const rotorGeo = new THREE.BoxGeometry(8, 0.5, 2);
            const rotorMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
            const rotor = new THREE.Mesh(rotorGeo, rotorMat);
            rotor.position.x = Math.cos(angle) * 12;
            rotor.position.z = Math.sin(angle) * 12;
            rotor.position.y = 5;
            group.add(rotor);
            this.rotors.push(rotor);
        }

        // Réservoir d'eau (visuel)
        const tankGeo = new THREE.SphereGeometry(6, 8, 8);
        this.tankMat = new THREE.MeshPhongMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.6
        });
        this.tank = new THREE.Mesh(tankGeo, this.tankMat);
        this.tank.position.y = -8;
        group.add(this.tank);

        // Numéro
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.id.toString(), 32, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.y = 15;
        sprite.scale.set(8, 8, 1);
        group.add(sprite);

        this.mesh = group;
        this.mesh.position.copy(this.position);
        scene.add(this.mesh);
    }

    update() {
        // Animation des rotors
        this.rotors.forEach(rotor => {
            rotor.rotation.y += 0.9;
        });

        // Machine d'état simple
        switch(this.state) {
            case 'SEARCHING':
                this.findTarget();
                break;
            case 'MOVING':
                this.moveToTarget();
                break;
            case 'WATERING':
                this.waterPlant();
                break;
            case 'REFILLING':
                this.refillAtLake();
                break;
        }

        // Appliquer la vélocité
        this.position.add(this.velocity);
        this.velocity.multiplyScalar(0.9); // Friction

        // Mettre à jour la position du mesh
        this.mesh.position.copy(this.position);

        // Limites
        const limit = MAP_SIZE/2 - 50;
        this.position.x = Math.max(-limit, Math.min(limit, this.position.x));
        this.position.z = Math.max(-limit, Math.min(limit, this.position.z));
        this.position.y = Math.max(20, Math.min(150, this.position.y));

        // Visuel du réservoir
        this.updateTankVisual();
    }

    findTarget() {
        // Vérifier l'eau
        if (this.waterLevel < 30) {
            this.state = 'REFILLING';
            console.log(`🔋 Drone ${this.id} → Recharge`);
            return;
        }

        // Trouver la plante la plus proche non arrosée
        let nearest = null;
        let nearestDist = Infinity;

        for (let plant of plants) {
            if (plant.watered) continue;

            const dist = this.position.distanceTo(plant.position);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = plant;
            }
        }

        if (nearest) {
            this.target = nearest;
            this.state = 'MOVING';
            console.log(`🎯 Drone ${this.id} → ${nearest.type}`);
        }
    }

    moveToTarget() {
        if (!this.target || this.target.watered) {
            this.state = 'SEARCHING';
            this.target = null;
            return;
        }

        const targetPos = this.target.position.clone();
        targetPos.y = CONFIG.WATERING_HEIGHT;

        const dist = this.position.distanceTo(targetPos);

        // Arrivé ?
        if (dist < CONFIG.WATERING_DISTANCE) {
            this.state = 'WATERING';
            this.target.startWatering();
            console.log(`💧 Drone ${this.id} commence arrosage`);
            return;
        }

        // Se déplacer
        const direction = targetPos.clone().sub(this.position).normalize();
        this.velocity.add(direction.multiplyScalar(CONFIG.DRONE_SPEED));
    }

    waterPlant() {
        if (!this.target) {
            this.state = 'SEARCHING';
            return;
        }

        // Rester en position
        const targetPos = this.target.position.clone();
        targetPos.y = CONFIG.WATERING_HEIGHT;
        const dist = this.position.distanceTo(targetPos);

        if (dist > CONFIG.WATERING_DISTANCE) {
            const direction = targetPos.clone().sub(this.position).normalize();
            this.velocity.add(direction.multiplyScalar(0.5));
        }

        // Créer des gouttes d'eau
        if (Math.random() < 0.3) {
            this.createWaterDrop();
        }

        // Mettre à jour l'arrosage
        const completed = this.target.updateWatering();

        if (completed) {
            // Plante arrosée !
            this.waterLevel -= CONFIG.WATER_PER_PLANT;
            this.plantsWatered++;
            stats.plantsWatered++;
            stats.score += this.target.pointValue;

            console.log(`✅ Drone ${this.id} a fini! (${stats.plantsWatered}/${stats.totalPlants})`);

            this.target = null;
            this.state = 'SEARCHING';

            updateHUD();

            // Vérifier victoire
            if (stats.plantsWatered >= stats.totalPlants) {
                endGame(true);
            }
        }
    }

    refillAtLake() {
        const lakePos = new THREE.Vector3(0, 30, 0);
        const dist = this.position.distanceTo(lakePos);

        if (dist > 100) {
            // Aller au lac
            const direction = lakePos.clone().sub(this.position).normalize();
            this.velocity.add(direction.multiplyScalar(CONFIG.DRONE_SPEED * 1.5));
        } else {
            // Recharger
            this.waterLevel = Math.min(100, this.waterLevel + CONFIG.REFILL_SPEED);

            if (this.waterLevel >= 100) {
                this.state = 'SEARCHING';
                console.log(`✅ Drone ${this.id} rechargé!`);
            }
        }
    }

    createWaterDrop() {
        const dropGeo = new THREE.SphereGeometry(0.5, 6, 6);
        const dropMat = new THREE.MeshBasicMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.8
        });
        const drop = new THREE.Mesh(dropGeo, dropMat);
        drop.position.copy(this.position);
        drop.position.y -= 10;

        drop.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            -5,
            (Math.random() - 0.5) * 2
        );
        drop.life = 30;

        scene.add(drop);
        waterDrops.push(drop);
    }

    updateTankVisual() {
        const ratio = this.waterLevel / 100;
        this.tank.scale.y = 0.5 + ratio * 0.5;
        this.tankMat.opacity = 0.3 + ratio * 0.4;

        if (this.waterLevel < 30) {
            this.tankMat.color.setHex(0xff4444);
        } else {
            this.tankMat.color.setHex(0x00aaff);
        }
    }
}

// ========================================
// INITIALISATION THREE.JS
// ========================================
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.0004);

    // Camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        3000
    );
    camera.position.set(0, 150, 250);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('c'),
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    // Lumières
    ambientLight = new THREE.HemisphereLight(0x87ceeb, 0x545454, 0.8);
    scene.add(ambientLight);

    sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(200, 400, 200);
    sun.castShadow = true;
    scene.add(sun);

    // Sol
    const groundGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
    const groundMat = new THREE.MeshPhongMaterial({ color: 0x3a5f0b });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI/2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Lac central
    const lakeGeo = new THREE.CircleGeometry(100, 32);
    const lakeMat = new THREE.MeshPhongMaterial({
        color: 0x006994,
        transparent: true,
        opacity: 0.8
    });
    lakeMesh = new THREE.Mesh(lakeGeo, lakeMat);
    lakeMesh.rotation.x = -Math.PI/2;
    lakeMesh.position.y = 0.5;
    scene.add(lakeMesh);

    // Ciel
    const skyGeo = new THREE.SphereGeometry(2000, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({
        color: 0x87ceeb,
        side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);
}

// ========================================
// GÉNÉRATION DES PLANTES
// ========================================
function generatePlants() {
    // Nettoyer anciennes plantes
    plants.forEach(plant => {
        if (plant.mesh) scene.remove(plant.mesh);
        if (plant.indicator) scene.remove(plant.indicator);
        if (plant.waterIcon) scene.remove(plant.waterIcon);
    });
    plants = [];

    const count = 20; // Nombre de plantes
    const types = ['flower', 'tree', 'bush'];

    for(let i = 0; i < count; i++) {
        let x, z;
        let valid = false;
        let attempts = 0;

        // Trouver une position valide
        while(!valid && attempts < 50) {
            x = (Math.random() - 0.5) * (MAP_SIZE - 200);
            z = (Math.random() - 0.5) * (MAP_SIZE - 200);

            // Éviter le lac
            if (Math.sqrt(x*x + z*z) > 150) {
                valid = true;

                // Éviter les autres plantes
                for(let p of plants) {
                    const dist = Math.sqrt(
                        Math.pow(x - p.position.x, 2) +
                        Math.pow(z - p.position.z, 2)
                    );
                    if (dist < 80) {
                        valid = false;
                        break;
                    }
                }
            }
            attempts++;
        }

        if (valid) {
            const type = types[Math.floor(Math.random() * types.length)];
            const plant = new Plant(
                new THREE.Vector3(x, 0, z),
                type
            );
            plants.push(plant);
        }
    }

    stats.totalPlants = plants.length;
    console.log(`🌱 Généré ${plants.length} plantes`);
}

// ========================================
// CRÉATION DES DRONES
// ========================================
function createDrones(count) {
    // Nettoyer anciens drones
    aiDrones.forEach(drone => {
        if (drone.mesh) scene.remove(drone.mesh);
    });
    aiDrones = [];

    // Créer nouveaux drones
    for(let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const radius = 80;
        const startPos = new THREE.Vector3(
            Math.cos(angle) * radius,
            60,
            Math.sin(angle) * radius
        );

        const drone = new AIDrone(i + 1, startPos);
        aiDrones.push(drone);
    }

    console.log(`🚁 Créé ${count} drones`);
}

// ========================================
// FONCTIONS DE JEU
// ========================================
function startNewGame() {
    gameRunning = true;
    gamePaused = false;
    stats.score = 0;
    stats.plantsWatered = 0;
    startTime = Date.now();

    // Configuration
    droneCount = parseInt(document.getElementById('droneCount').value);

    // Générer monde
    generatePlants();
    createDrones(droneCount);

    // Cacher game over
    document.getElementById('gameOver').style.display = 'none';

    updateHUD();

    console.log('🎮 === NOUVELLE PARTIE ===');
    console.log(`🚁 Drones: ${droneCount}`);
    console.log(`🌱 Plantes: ${stats.totalPlants}`);
    console.log(`⚡ Arrosage: 1 seconde/plante`);
}

function pauseGame() {
    if (!gameRunning) return;
    gamePaused = !gamePaused;
    console.log(gamePaused ? '⏸️ PAUSE' : '▶️ REPRISE');
}

function endGame(victory) {
    gameRunning = false;

    const gameOverDiv = document.getElementById('gameOver');
    const title = document.getElementById('gameOverTitle');

    if (victory) {
        title.textContent = '🎉 VICTOIRE!';
        title.style.color = '#00ff00';

        // Feux d'artifice
        for(let i = 0; i < 50; i++) {
            setTimeout(() => {
                const particleGeo = new THREE.SphereGeometry(2, 8, 8);
                const particleMat = new THREE.MeshBasicMaterial({
                    color: new THREE.Color().setHSL(Math.random(), 1, 0.5)
                });
                const particle = new THREE.Mesh(particleGeo, particleMat);
                particle.position.set(
                    (Math.random() - 0.5) * 500,
                    200 + Math.random() * 100,
                    (Math.random() - 0.5) * 500
                );
                particle.velocity = new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    -5,
                    (Math.random() - 0.5) * 10
                );
                particle.life = 100;
                scene.add(particle);
                particles.push(particle);
            }, i * 50);
        }
    } else {
        title.textContent = '⏰ TEMPS ÉCOULÉ!';
        title.style.color = '#ff6666';
    }

    document.getElementById('finalScore').textContent = stats.score;
    document.getElementById('finalPlants').textContent =
        `${stats.plantsWatered}/${stats.totalPlants}`;

    const elapsed = Date.now() - startTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    document.getElementById('finalTime').textContent =
        `${minutes}:${secs.toString().padStart(2, '0')}`;

    if (stats.score > stats.highScore) {
        stats.highScore = stats.score;
        localStorage.setItem('droneHighScore', stats.highScore);
        document.getElementById('scoreComparison').textContent = '🏆 NOUVEAU RECORD!';
    }

    gameOverDiv.style.display = 'block';
}

function updateHUD() {
    document.getElementById('score').textContent = stats.score;
    document.getElementById('plantsWatered').textContent = stats.plantsWatered;
    document.getElementById('totalPlants').textContent = stats.totalPlants;
    document.getElementById('activeDrones').textContent = aiDrones.length;
    document.getElementById('highScore').textContent = stats.highScore;
}

function showScorePopup(position, text) {
    const popup = document.createElement('div');
    popup.style.position = 'fixed';
    popup.style.color = '#00ff88';
    popup.style.fontSize = '24px';
    popup.style.fontWeight = 'bold';
    popup.style.pointerEvents = 'none';
    popup.style.zIndex = '1000';
    popup.textContent = text;

    const vector = position.clone();
    vector.project(camera);

    popup.style.left = ((vector.x * 0.5 + 0.5) * window.innerWidth) + 'px';
    popup.style.top = ((-vector.y * 0.5 + 0.5) * window.innerHeight) + 'px';

    document.body.appendChild(popup);

    // Animation
    let opacity = 1;
    let y = 0;
    const animatePopup = () => {
        opacity -= 0.02;
        y -= 2;
        popup.style.opacity = opacity;
        popup.style.transform = `translateY(${y}px)`;

        if (opacity > 0) {
            requestAnimationFrame(animatePopup);
        } else {
            popup.remove();
        }
    };
    animatePopup();
}

// ========================================
// BOUCLE D'ANIMATION
// ========================================
function animate() {
    requestAnimationFrame(animate);

    if (gameRunning && !gamePaused) {
        // Mise à jour des drones
        aiDrones.forEach(drone => drone.update());

        // Mise à jour des plantes
        plants.forEach(plant => plant.update());

        // Mise à jour des gouttes d'eau
        waterDrops = waterDrops.filter(drop => {
            drop.position.add(drop.velocity);
            drop.velocity.y -= 0.3;
            drop.life--;

            if (drop.position.y <= 0 || drop.life <= 0) {
                scene.remove(drop);
                return false;
            }

            drop.scale.setScalar(drop.life / 30);
            drop.material.opacity = (drop.life / 30) * 0.8;
            return true;
        });

        // Mise à jour des particules
        particles = particles.filter(particle => {
            particle.position.add(particle.velocity);
            particle.velocity.y -= 0.3;
            particle.life--;

            if (particle.life <= 0) {
                scene.remove(particle);
                return false;
            }

            if (particle.material) {
                particle.material.opacity = particle.life / 100;
            }
            return true;
        });
    }

    // Rotation caméra
    const time = Date.now() * 0.0001;
    camera.position.x = Math.sin(time) * 300;
    camera.position.z = Math.cos(time) * 300;
    camera.position.y = 150 + Math.sin(time * 2) * 50;
    camera.lookAt(0, 50, 0);

    // Rendu
    renderer.render(scene, camera);
}

// ========================================
// ÉVÉNEMENTS
// ========================================
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

document.getElementById('droneCount').addEventListener('input', (e) => {
    document.getElementById('droneCountDisplay').textContent = e.target.value;
});

// ========================================
// LANCEMENT
// ========================================
window.addEventListener('DOMContentLoaded', () => {
    console.log('🚁 Drone Squad - Initialisation...');

    init();
    animate();

    console.log('✅ Prêt! Cliquez sur "Lancer Mission"');
});

// Fonctions globales pour les boutons
window.startNewGame = startNewGame;
window.pauseGame = pauseGame;
window.toggleCamera = () => {
    console.log('📷 Changement de caméra');
};
window.toggleAIDebug = () => {
    console.log('🧠 Mode debug');
};