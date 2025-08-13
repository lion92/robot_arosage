// ========================================
// DRONE SQUAD - VERSION COOP + FAIR SHARE
// Chaque drone arrose au moins 1 plante et coopère
// ========================================

// Configuration globale
const CONFIG = {
    WATERING_TIME: 1000,        // 1 seconde pour arroser
    WATERING_DISTANCE: 50,      // Distance pour arroser
    WATERING_HEIGHT: 40,        // Hauteur d'arrosage
    DRONE_SPEED: 2.0,           // Vitesse de déplacement
    WATER_PER_PLANT: 20,        // 20% du réservoir par plante
    REFILL_SPEED: 10,           // Vitesse de recharge au lac
    REBALANCE_EVERY_MS: 1500,    // Fréquence d'équilibrage des tâches
    PLANTS_COUNT: 700        // Nombre de plantes par partie
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
// GESTIONNAIRE DE TÂCHES (COOPÉRATION)
// ========================================
const TaskManager = {
    // Map<plantId, droneId>
    claims: new Map(),
    // Set<plantId> déjà attribuées une fois (pour l'équité)
    everAssigned: new Set(),
    // Dernier équilibrage
    lastBalance: 0,

    reset() {
        this.claims.clear();
        this.everAssigned.clear();
        this.lastBalance = 0;
    },

    plantId(plant) { return plant._uid; },

    isFree(plant) {
        if (plant.watered) return false;
        const id = this.plantId(plant);
        return !this.claims.has(id);
    },

    claim(plant, drone) {
        if (!plant || plant.watered) return false;
        const id = this.plantId(plant);
        if (this.claims.has(id)) return this.claims.get(id) === drone.id; // déjà à moi
        this.claims.set(id, drone.id);
        this.everAssigned.add(id);
        plant.claimedBy = drone.id;
        return true;
    },

    release(plant, drone) {
        if (!plant) return;
        const id = this.plantId(plant);
        if (this.claims.get(id) === drone.id) {
            this.claims.delete(id);
        }
        if (plant) plant.claimedBy = null;
    },

    // Retourne la meilleure plante libre pour ce drone
    nextPlantFor(drone) {
        // 1) Priorité : garantir qu'il arrose au moins une plante
        //    -> on lui choisit une plante jamais assignée tant que possible
        const candidates = plants.filter(p => !p.watered && (p.claimedBy == null));
        if (candidates.length === 0) return null;

        // On peut privilégier les plantes "jamais assignées" si drone n'a pas encore arrosé
        const pool = (drone.plantsWatered === 0)
            ? candidates.filter(p => !this.everAssigned.has(this.plantId(p)))
            : candidates;
        const list = (pool.length > 0) ? pool : candidates;

        // Choisir la plus proche
        let best = null; let bestDist = Infinity;
        for (const p of list) {
            const d = drone.position.distanceTo(p.position);
            if (d < bestDist) { best = p; bestDist = d; }
        }
        return best;
    },

    // Équilibre les tâches pour éviter que 2 drones visent la même plante éloignée
    balance() {
        const now = Date.now();
        if (now - this.lastBalance < CONFIG.REBALANCE_EVERY_MS) return;
        this.lastBalance = now;

        // Libérer les claims des plantes déjà arrosées
        for (const p of plants) {
            if (p.watered && p.claimedBy) {
                const id = this.plantId(p);
                this.claims.delete(id);
                p.claimedBy = null;
            }
        }

        // Si des drones n'ont pas de cible et qu'il reste des plantes libres, on leur assigne
        for (const d of aiDrones) {
            if (d.state === 'SEARCHING' && d.waterLevel >= 30) {
                const target = this.nextPlantFor(d);
                if (target && this.claim(target, d)) {
                    d.target = target;
                    d.state = 'MOVING';
                    console.log(`🤝 Dispatch → Drone ${d.id} obtient ${target.type}`);
                }
            }
        }
    }
};

let _uidCounter = 1;
function assignUID(obj) {
    Object.defineProperty(obj, '_uid', { value: _uidCounter++, enumerable: false });
}

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
        this.claimedBy = null; // coopération
        assignUID(this);

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

    startWatering(droneId) {
        console.log(`🌱 Début arrosage ${this.type} par Drone ${droneId}`);
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
// CLASSE DRONE COOPÉRATIF
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
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.id.toString(), 32, 32);
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.y = 15; sprite.scale.set(8, 8, 1);
        group.add(sprite);

        this.mesh = group;
        this.mesh.position.copy(this.position);
        scene.add(this.mesh);
    }

    update() {
        // Animation des rotors
        this.rotors.forEach(rotor => { rotor.rotation.y += 0.9; });

        // Machine d'état
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
            // Libérer une éventuelle claim
            if (this.target) TaskManager.release(this.target, this);
            this.state = 'REFILLING';
            console.log(`🔋 Drone ${this.id} → Recharge`);
            return;
        }

        // Demander au dispatcher une cible
        const candidate = TaskManager.nextPlantFor(this);
        if (candidate && TaskManager.claim(candidate, this)) {
            this.target = candidate;
            this.state = 'MOVING';
            console.log(`🎯 Drone ${this.id} → ${candidate.type}`);
            return;
        }

        // Sinon, patrouille douce
        const wander = new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.02,
            (Math.random() - 0.5) * 0.2
        );
        this.velocity.add(wander);
    }

    moveToTarget() {
        if (!this.target || this.target.watered) {
            if (this.target) TaskManager.release(this.target, this);
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
            this.target.startWatering(this.id);
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

            // Relâcher la claim
            TaskManager.release(this.target, this);

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
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3000);
    camera.position.set(0, 150, 250);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
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
    const lakeMat = new THREE.MeshPhongMaterial({ color: 0x006994, transparent: true, opacity: 0.8 });
    lakeMesh = new THREE.Mesh(lakeGeo, lakeMat);
    lakeMesh.rotation.x = -Math.PI/2;
    lakeMesh.position.y = 0.5;
    scene.add(lakeMesh);

    // Ciel
    const skyGeo = new THREE.SphereGeometry(2000, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({ color: 0x87ceeb, side: THREE.BackSide });
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

    const count = CONFIG.PLANTS_COUNT; // Nombre de plantes
    const types = ['flower', 'tree', 'bush'];

    for(let i = 0; i < count; i++) {
        let x, z;
        let valid = false;
        let attempts = 0;

        // Trouver une position valide
        while(!valid && attempts < 200) {
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
                    if (dist < 30) {
                        valid = false;
                        break;
                    }
                }
            }
            attempts++;
        }

        if (valid) {
            const type = types[Math.floor(Math.random() * types.length)];
            const plant = new Plant(new THREE.Vector3(x, 0, z), type);
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
    aiDrones.forEach(drone => { if (drone.mesh) scene.remove(drone.mesh); });
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

    // Générer monde d'abord (pour connaître totalPlants)
    generatePlants();

    // Configuration: garantir au moins 1 plante par drone
    const requested = parseInt(document.getElementById('droneCount').value);
    droneCount = Math.min(requested, stats.totalPlants);

    // Reset coop dispatcher
    TaskManager.reset();

    // Créer drones
    createDrones(droneCount);

    // Assignation initiale équitable: une plante proche par drone (distincte)
    const free = new Set(plants.map(p => p._uid));
    for (const d of aiDrones) {
        let best = null; let bestDist = Infinity;
        for (const p of plants) {
            if (!free.has(p._uid) || p.watered) continue;
            const dist = d.position.distanceTo(p.position);
            if (dist < bestDist) { best = p; bestDist = dist; }
        }
        if (best) {
            free.delete(best._uid);
            if (TaskManager.claim(best, d)) {
                d.target = best; d.state = 'MOVING';
                console.log(`🚀 Assignation initiale → Drone ${d.id} vers ${best.type}`);
            }
        }
    }

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
                const particleMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(Math.random(), 1, 0.5) });
                const particle = new THREE.Mesh(particleGeo, particleMat);
                particle.position.set((Math.random() - 0.5) * 500, 200 + Math.random() * 100, (Math.random() - 0.5) * 500);
                particle.velocity = new THREE.Vector3((Math.random() - 0.5) * 10, -5, (Math.random() - 0.5) * 10);
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
    document.getElementById('finalPlants').textContent = `${stats.plantsWatered}/${stats.totalPlants}`;

    const elapsed = Date.now() - startTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    document.getElementById('finalTime').textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;

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
    let opacity = 1; let y = 0;
    const animatePopup = () => {
        opacity -= 0.02; y -= 2;
        popup.style.opacity = opacity;
        popup.style.transform = `translateY(${y}px)`;
        if (opacity > 0) { requestAnimationFrame(animatePopup); } else { popup.remove(); }
    };
    animatePopup();
}

// ========================================
// BOUCLE D'ANIMATION
// ========================================
function animate() {
    requestAnimationFrame(animate);

    if (gameRunning && !gamePaused) {
        // Équilibrage coopératif périodique
        TaskManager.balance();

        // Mise à jour des drones
        aiDrones.forEach(drone => drone.update());

        // Mise à jour des plantes
        plants.forEach(plant => plant.update());

        // Mise à jour des gouttes d'eau
        waterDrops = waterDrops.filter(drop => {
            drop.position.add(drop.velocity);
            drop.velocity.y -= 0.3;
            drop.life--;
            if (drop.position.y <= 0 || drop.life <= 0) { scene.remove(drop); return false; }
            drop.scale.setScalar(drop.life / 30);
            drop.material.opacity = (drop.life / 30) * 0.8;
            return true;
        });

        // Mise à jour des particules
        particles = particles.filter(particle => {
            particle.position.add(particle.velocity);
            particle.velocity.y -= 0.3;
            particle.life--;
            if (particle.life <= 0) { scene.remove(particle); return false; }
            if (particle.material) { particle.material.opacity = particle.life / 100; }
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
window.toggleCamera = () => { console.log('📷 Changement de caméra'); };
window.toggleAIDebug = () => { console.log('🧠 Mode debug'); };

// ======= DÉCOR : FONCTIONS =======
function addScenery() {
    addLakePath();
    spawnClouds(8);
    scatterRocksAndShrubs(40);
    spawnButterflies(25);
    addLakeRippleOverlay();
}

function addLakePath() {
    // Anneau sablonneux autour du lac
    const ringGeo = new THREE.RingGeometry(120, 140, 64);
    const ringMat = new THREE.MeshPhongMaterial({ color: 0xC2B280, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.51;
    scene.add(ring);
}

function makeFluffyTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const grd = ctx.createRadialGradient(64, 64, 20, 64, 64, 60);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd; ctx.fillRect(0,0,128,128);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
}

function spawnClouds(n=6) {
    const tex = makeFluffyTexture();
    for (let i=0;i<n;i++) {
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
        const sprite = new THREE.Sprite(mat);
        sprite.position.set((Math.random()-0.5)*MAP_SIZE, 220 + Math.random()*80, (Math.random()-0.5)*MAP_SIZE);
        sprite.scale.set(200+Math.random()*200, 120+Math.random()*120, 1);
        sprite.userData.speed = 0.1 + Math.random()*0.15;
        scene.add(sprite);
        clouds.push(sprite);
    }
}

function updateClouds() {
    for (const c of clouds) {
        c.position.x += c.userData.speed;
        if (c.position.x > MAP_SIZE/2) c.position.x = -MAP_SIZE/2;
    }
}

function scatterRocksAndShrubs(count=30) {
    const rockGeo = new THREE.DodecahedronGeometry(5, 0);
    const shrubGeo = new THREE.ConeGeometry(6, 10, 6);

    for (let i=0;i<count;i++) {
        const isRock = Math.random() < 0.6;
        const mat = new THREE.MeshPhongMaterial({ color: isRock ? 0x7a7a7a : 0x2f6f3a, flatShading: true });
        const geo = isRock ? rockGeo : shrubGeo;
        const m = new THREE.Mesh(geo, mat);
        let x, z, r;
        // placer hors du lac
        do {
            x = (Math.random()-0.5) * (MAP_SIZE-200);
            z = (Math.random()-0.5) * (MAP_SIZE-200);
            r = Math.sqrt(x*x+z*z);
        } while (r < 170);
        m.position.set(x, isRock?2:5, z);
        m.rotation.y = Math.random()*Math.PI*2;
        const s = isRock ? (0.6+Math.random()*1.4) : (0.8+Math.random()*1.2);
        m.scale.setScalar(s);
        scene.add(m);
    }
}

function spawnButterflies(n=20){
    const wing = new THREE.PlaneGeometry(2, 1.2);
    for(let i=0;i<n;i++){
        const mat = new THREE.MeshBasicMaterial({ color: 0xffb3e6, side: THREE.DoubleSide });
        const left = new THREE.Mesh(wing, mat.clone());
        const right = new THREE.Mesh(wing, mat.clone());
        const group = new THREE.Group();
        left.position.x = -0.6; right.position.x = 0.6;
        group.add(left); group.add(right);
        group.position.set((Math.random()-0.5)*MAP_SIZE*0.8, 10+Math.random()*40, (Math.random()-0.5)*MAP_SIZE*0.8);
        group.userData = { phase: Math.random()*Math.PI*2, dir: new THREE.Vector3(Math.random()-0.5, 0, Math.random()-0.5).normalize(), speed: 0.5+Math.random()*0.6, left, right };
        scene.add(group);
        butterflies.push(group);
    }
}

function updateButterflies(){
    const t = performance.now()*0.005;
    for(const b of butterflies){
        const d = b.userData;
        d.phase += 0.3;
        d.left.rotation.z = Math.sin(d.phase)*0.8;
        d.right.rotation.z = -Math.sin(d.phase)*0.8;
        b.position.addScaledVector(d.dir, d.speed);
        // légère ondulation
        b.position.y += Math.sin(t + b.position.x*0.01 + b.position.z*0.01)*0.1;
        // reboucler aux bords
        const lim = MAP_SIZE/2 - 50;
        if (b.position.x > lim) d.dir.x = -Math.abs(d.dir.x);
        if (b.position.x < -lim) d.dir.x = Math.abs(d.dir.x);
        if (b.position.z > lim) d.dir.z = -Math.abs(d.dir.z);
        if (b.position.z < -lim) d.dir.z = Math.abs(d.dir.z);
    }
}

function makeRippleTexture(){
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const grd = ctx.createRadialGradient(128,128,10,128,128,120);
    grd.addColorStop(0,'rgba(255,255,255,0.25)');
    grd.addColorStop(0.4,'rgba(255,255,255,0.08)');
    grd.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(128,128,120,0,Math.PI*2); ctx.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

function addLakeRippleOverlay(){
    const tex = makeRippleTexture();
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.7 });
    const geo = new THREE.CircleGeometry(115, 64);
    rippleOverlay = new THREE.Mesh(geo, mat);
    rippleOverlay.rotation.x = -Math.PI/2;
    rippleOverlay.position.y = 0.52;
    scene.add(rippleOverlay);
}

function updateLakeRipple(){
    if (!rippleOverlay) return;
    rippleOverlay.rotation.z += 0.0015;
    const s = 1.001 + Math.sin(performance.now()*0.001)*0.002;
    rippleOverlay.scale.set(s, s, 1);
}

