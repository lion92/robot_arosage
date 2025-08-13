// ========================================
// DRONE SQUAD - COOPERATIVE AI SYSTEM
// ========================================

// Global variables
let scene, camera, renderer;
let aiDrones = [];
let plants = [];
let waterDrops = [];
let particles = [];
let keys = {};
let cameraMode = 0;
let cameraTarget = null;
let mouseX = 0, mouseY = 0;

let stats = {
    score: 0,
    plantsWatered: 0,
    totalPlants: 0,
    efficiency: 0,
    highScore: parseInt(localStorage.getItem('droneSquadHighScore') || 0)
};

let ambientLight, sun, sky;
let lakeMesh;
let startTime = Date.now();
let clouds = [];
let gameRunning = false;
let gamePaused = false;
let gameTimeLimit = 5 * 60 * 1000; // 5 minutes
let remainingTime = gameTimeLimit;
let aiDebugMode = false;
let droneCount = 3;

const MAP_SIZE = 2000;
const CITY_BLOCKS = 8;
const BLOCK_SIZE = MAP_SIZE / CITY_BLOCKS;

// Communication system
const droneComm = {
    assignedTargets: new Map(), // drone -> plant
    plantAssignments: new Map(), // plant -> drone
    messages: []
};

// ========================================
// A* PATHFINDING ALGORITHM
// ========================================

class PathNode {
    constructor(x, z, g = 0, h = 0, parent = null) {
        this.x = x;
        this.z = z;
        this.g = g; // Cost from start
        this.h = h; // Heuristic to end
        this.f = g + h; // Total cost
        this.parent = parent;
    }
}

class AStar {
    static findPath(start, end, obstacles = []) {
        const openSet = [];
        const closedSet = new Set();
        const gridSize = 20; // Grid resolution

        const startNode = new PathNode(
            Math.round(start.x / gridSize) * gridSize,
            Math.round(start.z / gridSize) * gridSize
        );
        const endNode = new PathNode(
            Math.round(end.x / gridSize) * gridSize,
            Math.round(end.z / gridSize) * gridSize
        );

        openSet.push(startNode);

        while (openSet.length > 0) {
            // Get node with lowest f cost
            let currentNode = openSet.reduce((min, node) =>
                node.f < min.f ? node : min
            );

            // Remove from open set
            const index = openSet.indexOf(currentNode);
            openSet.splice(index, 1);

            // Add to closed set
            closedSet.add(`${currentNode.x},${currentNode.z}`);

            // Check if reached goal
            if (Math.abs(currentNode.x - endNode.x) < gridSize &&
                Math.abs(currentNode.z - endNode.z) < gridSize) {
                return AStar.reconstructPath(currentNode);
            }

            // Check neighbors
            const neighbors = AStar.getNeighbors(currentNode, gridSize);

            for (let neighbor of neighbors) {
                const key = `${neighbor.x},${neighbor.z}`;

                if (closedSet.has(key)) continue;

                // Check obstacles
                if (AStar.isObstacle(neighbor, obstacles)) continue;

                const g = currentNode.g + AStar.distance(currentNode, neighbor);
                const h = AStar.distance(neighbor, endNode);

                const existingNode = openSet.find(n =>
                    n.x === neighbor.x && n.z === neighbor.z
                );

                if (!existingNode) {
                    openSet.push(new PathNode(
                        neighbor.x,
                        neighbor.z,
                        g,
                        h,
                        currentNode
                    ));
                } else if (g < existingNode.g) {
                    existingNode.g = g;
                    existingNode.f = g + h;
                    existingNode.parent = currentNode;
                }
            }
        }

        return []; // No path found
    }

    static getNeighbors(node, gridSize) {
        const neighbors = [];
        const directions = [
            {x: gridSize, z: 0},
            {x: -gridSize, z: 0},
            {x: 0, z: gridSize},
            {x: 0, z: -gridSize},
            {x: gridSize, z: gridSize},
            {x: -gridSize, z: gridSize},
            {x: gridSize, z: -gridSize},
            {x: -gridSize, z: -gridSize}
        ];

        for (let dir of directions) {
            neighbors.push({
                x: node.x + dir.x,
                z: node.z + dir.z
            });
        }

        return neighbors;
    }

    static distance(a, b) {
        return Math.sqrt(
            Math.pow(a.x - b.x, 2) +
            Math.pow(a.z - b.z, 2)
        );
    }

    static isObstacle(node, obstacles) {
        for (let obstacle of obstacles) {
            const dist = Math.sqrt(
                Math.pow(node.x - obstacle.x, 2) +
                Math.pow(node.z - obstacle.z, 2)
            );
            if (dist < obstacle.radius) return true;
        }
        return false;
    }

    static reconstructPath(node) {
        const path = [];
        let current = node;

        while (current) {
            path.unshift({x: current.x, z: current.z});
            current = current.parent;
        }

        return path;
    }
}

// ========================================
// AI DRONE CLASS
// ========================================

class AIDrone {
    constructor(id, startPosition) {
        this.id = id;
        this.mesh = this.createMesh(id);
        this.mesh.position.copy(startPosition);

        this.velocity = new THREE.Vector3(0, 0, 0);
        this.waterLevel = 100;
        this.state = 'IDLE'; // IDLE, SEARCHING, MOVING, WATERING, REFILLING
        this.target = null;
        this.path = [];
        this.pathIndex = 0;
        this.lastWater = 0;
        this.plantsWatered = 0;
        this.distanceTraveled = 0;
        this.lastPosition = startPosition.clone();

        // Communication
        this.nearbyDrones = [];
        this.messageQueue = [];

        scene.add(this.mesh);
    }

    createMesh(id) {
        const group = new THREE.Group();

        // Color based on ID
        const hue = (id * 0.1) % 1;
        const color = new THREE.Color().setHSL(hue, 0.8, 0.5);

        // Body
        const bodyGeo = new THREE.OctahedronGeometry(12, 2);
        const bodyMat = new THREE.MeshPhongMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.3,
            metalness: 0.9,
            roughness: 0.1
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        group.add(body);

        // ID number
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(id.toString(), 32, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({
            map: texture,
            color: 0xffffff
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.y = 20;
        sprite.scale.set(10, 10, 1);
        group.add(sprite);

        // Rotors
        this.rotors = [];
        for(let i = 0; i < 4; i++) {
            const angle = (i/4) * Math.PI * 2;
            const rotorGeo = new THREE.BoxGeometry(10, 0.5, 3);
            const rotorMat = new THREE.MeshBasicMaterial({
                color: 0x111111,
                transparent: true,
                opacity: 0.9
            });
            const rotor = new THREE.Mesh(rotorGeo, rotorMat);
            rotor.position.x = Math.cos(angle) * 15;
            rotor.position.z = Math.sin(angle) * 15;
            rotor.position.y = 5;
            group.add(rotor);
            this.rotors.push(rotor);
        }

        // Water tank indicator
        const tankGeo = new THREE.SphereGeometry(8, 16, 16);
        const tankMat = new THREE.MeshPhongMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.5,
            emissive: 0x0088ff,
            emissiveIntensity: 0.2
        });
        this.waterTank = new THREE.Mesh(tankGeo, tankMat);
        this.waterTank.position.y = -8;
        this.waterTank.scale.set(0.8, 1, 0.8);
        group.add(this.waterTank);

        // Status light
        const lightGeo = new THREE.SphereGeometry(2, 8, 8);
        const lightMat = new THREE.MeshBasicMaterial({
            color: 0x00ff00
        });
        this.statusLight = new THREE.Mesh(lightGeo, lightMat);
        this.statusLight.position.y = 10;
        group.add(this.statusLight);

        return group;
    }

    update() {
        // Animate rotors
        this.rotors.forEach(rotor => {
            rotor.rotation.y += 0.8;
        });

        // Update distance traveled
        const dist = this.mesh.position.distanceTo(this.lastPosition);
        this.distanceTraveled += dist;
        this.lastPosition = this.mesh.position.clone();

        // State machine
        switch(this.state) {
            case 'IDLE':
                this.searchForTarget();
                break;
            case 'SEARCHING':
                this.searchForTarget();
                break;
            case 'MOVING':
                this.moveAlongPath();
                break;
            case 'WATERING':
                this.waterTarget();
                break;
            case 'REFILLING':
                this.moveToLake();
                break;
        }

        // Update status light color
        this.updateStatusLight();

        // Update water tank visual
        const waterRatio = this.waterLevel / 100;
        this.waterTank.scale.y = 0.3 + waterRatio * 0.7;
        this.waterTank.material.opacity = 0.3 + waterRatio * 0.4;

        // Communicate with nearby drones
        this.communicateWithNearby();

        // Apply physics
        this.mesh.position.add(this.velocity);
        this.velocity.multiplyScalar(0.92); // Drag

        // Keep in bounds
        const mapLimit = MAP_SIZE/2 - 50;
        this.mesh.position.x = Math.max(-mapLimit, Math.min(mapLimit, this.mesh.position.x));
        this.mesh.position.z = Math.max(-mapLimit, Math.min(mapLimit, this.mesh.position.z));
        this.mesh.position.y = Math.max(30, Math.min(150, this.mesh.position.y));
    }

    searchForTarget() {
        // Check water level first
        if (this.waterLevel < 20) {
            this.state = 'REFILLING';
            this.target = lakeMesh.position;
            this.calculatePath(this.target);
            return;
        }

        // Find nearest unassigned plant
        let nearestPlant = null;
        let nearestDistance = Infinity;

        for (let plant of plants) {
            if (plant.watered) continue;

            // Check if already assigned to another drone
            if (droneComm.plantAssignments.has(plant) &&
                droneComm.plantAssignments.get(plant) !== this.id) {
                continue;
            }

            const dist = this.mesh.position.distanceTo(plant.mesh.position);

            // Apply smart scoring: distance + plant health
            const score = dist - (plant.health * 2); // Prioritize damaged plants

            if (score < nearestDistance) {
                nearestDistance = score;
                nearestPlant = plant;
            }
        }

        if (nearestPlant) {
            this.assignTarget(nearestPlant);
        } else {
            this.state = 'IDLE';
        }
    }

    assignTarget(plant) {
        // Clear old assignment
        if (droneComm.assignedTargets.has(this.id)) {
            const oldPlant = droneComm.assignedTargets.get(this.id);
            droneComm.plantAssignments.delete(oldPlant);
        }

        // Set new assignment
        this.target = plant;
        droneComm.assignedTargets.set(this.id, plant);
        droneComm.plantAssignments.set(plant, this.id);

        // Calculate path
        this.calculatePath(plant.mesh.position);
        this.state = 'MOVING';

        // Broadcast assignment
        this.broadcast({
            type: 'TARGET_ASSIGNED',
            droneId: this.id,
            plantId: plants.indexOf(plant)
        });
    }

    calculatePath(targetPosition) {
        // Get obstacles (buildings, other drones)
        const obstacles = [];

        // Add other drones as obstacles
        for (let drone of aiDrones) {
            if (drone.id !== this.id) {
                obstacles.push({
                    x: drone.mesh.position.x,
                    z: drone.mesh.position.z,
                    radius: 30
                });
            }
        }

        // Calculate A* path
        this.path = AStar.findPath(
            this.mesh.position,
            targetPosition,
            obstacles
        );

        this.pathIndex = 0;

        // Visualize path in debug mode
        if (aiDebugMode && this.path.length > 0) {
            this.visualizePath();
        }
    }

    moveAlongPath() {
        if (!this.path || this.pathIndex >= this.path.length) {
            if (this.target instanceof Plant) {
                this.state = 'WATERING';
            } else {
                this.state = 'IDLE';
            }
            return;
        }

        const waypoint = this.path[this.pathIndex];
        const targetPos = new THREE.Vector3(waypoint.x, this.mesh.position.y, waypoint.z);
        const direction = targetPos.clone().sub(this.mesh.position);
        const distance = direction.length();

        if (distance < 20) {
            this.pathIndex++;
        } else {
            direction.normalize();
            this.velocity.add(direction.multiplyScalar(0.8));

            // Face direction of movement
            if (this.velocity.length() > 0.1) {
                this.mesh.lookAt(
                    this.mesh.position.clone().add(this.velocity)
                );
            }
        }
    }

    moveToLake() {
        const lakePos = lakeMesh.position;
        const direction = lakePos.clone().sub(this.mesh.position);
        const distance = direction.length();

        if (distance < 80 && this.mesh.position.y < 60) {
            // Refill water
            this.waterLevel = Math.min(100, this.waterLevel + 2);

            if (this.waterLevel >= 100) {
                this.state = 'SEARCHING';
                this.broadcast({
                    type: 'REFILL_COMPLETE',
                    droneId: this.id
                });
            }
        } else {
            // Move toward lake
            direction.normalize();
            this.velocity.add(direction.multiplyScalar(1.0));

            if (distance < 100) {
                this.velocity.y = -0.5; // Descend
            }
        }
    }

    waterTarget() {
        if (!this.target || this.target.watered) {
            this.state = 'SEARCHING';
            this.target = null;
            return;
        }

        const dist = this.mesh.position.distanceTo(this.target.mesh.position);

        if (dist > 60) {
            // Too far, recalculate path
            this.calculatePath(this.target.mesh.position);
            this.state = 'MOVING';
            return;
        }

        // Move closer and descend to watering height
        if (dist > 30) {
            const direction = this.target.mesh.position.clone().sub(this.mesh.position);
            direction.y = 0;
            direction.normalize();
            this.velocity.add(direction.multiplyScalar(0.3));
        }

        // Descend to watering height
        const targetHeight = 40;
        if (this.mesh.position.y > targetHeight) {
            this.velocity.y = -0.8;
        } else if (this.mesh.position.y < targetHeight - 5) {
            this.velocity.y = 0.3;
        }

        // Water the plant when close enough
        const now = Date.now();
        if (dist < 40 && Math.abs(this.mesh.position.y - targetHeight) < 10) {
            if (now - this.lastWater > 50 && this.waterLevel > 0) {
                this.createWaterDrops();
                this.waterLevel -= 0.5;
                this.lastWater = now;

                // Water the plant directly
                const points = this.target.water(5);

                // Check if plant is fully watered
                if (this.target.watered) {
                    this.plantsWatered++;
                    stats.plantsWatered++;
                    stats.score += this.target.pointValue;

                    // Visual feedback
                    createWaterSplash(this.target.mesh.position, 30);
                    showScorePopup(this.target.mesh.position, `+${this.target.pointValue}`);

                    // Clear assignment
                    droneComm.plantAssignments.delete(this.target);
                    droneComm.assignedTargets.delete(this.id);

                    // Broadcast completion
                    this.broadcast({
                        type: 'PLANT_WATERED',
                        droneId: this.id,
                        plantId: plants.indexOf(this.target),
                        points: this.target.pointValue
                    });

                    console.log(`Drone ${this.id} watered plant! Total: ${stats.plantsWatered}/${stats.totalPlants}`);

                    this.target = null;
                    this.state = 'SEARCHING';

                    updateHUD();
                }
            }
        }

        // Check water level
        if (this.waterLevel <= 10) {
            this.state = 'REFILLING';
            this.target = null;
        }
    }

    createWaterDrops() {
        for(let i = 0; i < 3; i++) {
            const dropGeo = new THREE.SphereGeometry(0.5 + Math.random() * 0.3);
            const dropMat = new THREE.MeshPhongMaterial({
                color: 0x00aaff,
                transparent: true,
                opacity: 0.9
            });
            const drop = new THREE.Mesh(dropGeo, dropMat);
            drop.position.copy(this.mesh.position);
            drop.position.y -= 10;

            drop.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                -5 - Math.random() * 2,
                (Math.random() - 0.5) * 2
            );
            drop.life = 30;
            scene.add(drop);
            waterDrops.push(drop);
        }
    }

    updateStatusLight() {
        switch(this.state) {
            case 'IDLE':
                this.statusLight.material.color.setHex(0xffffff);
                break;
            case 'SEARCHING':
                this.statusLight.material.color.setHex(0xffff00);
                break;
            case 'MOVING':
                this.statusLight.material.color.setHex(0x00ff00);
                break;
            case 'WATERING':
                this.statusLight.material.color.setHex(0x00ffff);
                break;
            case 'REFILLING':
                this.statusLight.material.color.setHex(0x0088ff);
                break;
        }
    }

    communicateWithNearby() {
        this.nearbyDrones = [];

        for (let drone of aiDrones) {
            if (drone.id === this.id) continue;

            const dist = this.mesh.position.distanceTo(drone.mesh.position);
            if (dist < 200) {
                this.nearbyDrones.push(drone);

                // Visual communication line in debug mode
                if (aiDebugMode) {
                    this.drawCommLine(drone);
                }
            }
        }
    }

    broadcast(message) {
        droneComm.messages.push({
            ...message,
            timestamp: Date.now()
        });

        // Process by nearby drones
        for (let drone of this.nearbyDrones) {
            drone.receiveMessage(message);
        }
    }

    receiveMessage(message) {
        this.messageQueue.push(message);

        // Process message
        switch(message.type) {
            case 'TARGET_ASSIGNED':
                // Another drone claimed a plant, avoid it
                break;
            case 'PLANT_WATERED':
                // Plant completed, update local knowledge
                break;
            case 'HELP_NEEDED':
                // Drone needs assistance
                break;
        }
    }

    visualizePath() {
        // Draw path points for debugging
        for (let point of this.path) {
            const pathGeo = new THREE.SphereGeometry(2, 8, 8);
            const pathMat = new THREE.MeshBasicMaterial({
                color: 0xffff00,
                transparent: true,
                opacity: 0.5
            });
            const pathMesh = new THREE.Mesh(pathGeo, pathMat);
            pathMesh.position.set(point.x, 10, point.z);
            scene.add(pathMesh);

            // Remove after 2 seconds
            setTimeout(() => scene.remove(pathMesh), 2000);
        }
    }

    drawCommLine(targetDrone) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
            this.mesh.position,
            targetDrone.mesh.position
        ]);
        const lineMat = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.3
        });
        const line = new THREE.Line(lineGeo, lineMat);
        scene.add(line);

        // Remove after brief moment
        setTimeout(() => scene.remove(line), 100);
    }

    getStatus() {
        return {
            id: this.id,
            state: this.state,
            waterLevel: this.waterLevel,
            plantsWatered: this.plantsWatered,
            position: this.mesh.position,
            target: this.target ? plants.indexOf(this.target) : null
        };
    }
}

// ========================================
// PLANT CLASS (Same as before with minor updates)
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
        const potGeo = new THREE.CylinderGeometry(5, 4, 6, 12);
        const potMat = new THREE.MeshPhongMaterial({
            color: 0x8b4513
        });
        const pot = new THREE.Mesh(potGeo, potMat);
        pot.position.y = 3;
        group.add(pot);

        this.petals = [];
        const petalCount = 8;
        const petalGeo = new THREE.SphereGeometry(2.5, 8, 6);

        for(let i = 0; i < petalCount; i++) {
            const petalMat = new THREE.MeshPhongMaterial({
                color: new THREE.Color().setHSL(0.95, 0.8, 0.6)
            });
            const petal = new THREE.Mesh(petalGeo, petalMat);
            const angle = (i / petalCount) * Math.PI * 2;
            petal.position.set(
                Math.cos(angle) * 4,
                18,
                Math.sin(angle) * 4
            );
            petal.scale.set(1.2, 0.6, 1);
            group.add(petal);
            this.petals.push(petal);
        }
    }

    createTree(group) {
        const trunkGeo = new THREE.CylinderGeometry(4, 5, 25, 10);
        const trunkMat = new THREE.MeshPhongMaterial({
            color: 0x4a3c28
        });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 12.5;
        group.add(trunk);

        this.foliageLayers = [];
        for(let i = 0; i < 3; i++) {
            const foliageGeo = new THREE.DodecahedronGeometry(10 - i * 2, 1);
            const foliageMat = new THREE.MeshPhongMaterial({
                color: new THREE.Color().setHSL(0.25, 0.8, 0.3),
                flatShading: true
            });
            const foliage = new THREE.Mesh(foliageGeo, foliageMat);
            foliage.position.y = 28 + i * 5;
            group.add(foliage);
            this.foliageLayers.push(foliage);
        }
    }

    createBush(group) {
        const bushGeo = new THREE.IcosahedronGeometry(10, 1);
        const bushMat = new THREE.MeshPhongMaterial({
            color: 0x2d5016,
            flatShading: true
        });
        this.bush = new THREE.Mesh(bushGeo, bushMat);
        this.bush.position.y = 8;
        this.bush.scale.set(1.8, 1, 1.8);
        group.add(this.bush);
    }

    createIndicator(group) {
        this.indicator = new THREE.PointLight(0xff0000, 3, 40);
        this.indicator.position.y = 35;
        group.add(this.indicator);

        const dropGroup = new THREE.Group();
        const dropGeo = new THREE.SphereGeometry(3, 8, 8);
        const dropMat = new THREE.MeshPhongMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.8
        });
        const drop = new THREE.Mesh(dropGeo, dropMat);
        drop.scale.set(1, 1.5, 1);
        dropGroup.add(drop);

        dropGroup.position.y = 40;
        this.waterIcon = dropGroup;
        group.add(dropGroup);
    }

    water(amount) {
        if(this.watered) return 0;

        this.health = Math.min(100, this.health + amount);

        if(this.health >= 100 && !this.watered) {
            this.watered = true;

            // Change indicator to green
            if(this.indicator) {
                this.indicator.color.setHex(0x00ff00);
                this.indicator.intensity = 2;
            }

            // Hide water icon
            if(this.waterIcon) {
                this.waterIcon.visible = false;
            }

            // Add glow effect
            const glowGeo = new THREE.SphereGeometry(15, 16, 16);
            const glowMat = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                transparent: true,
                opacity: 0.3
            });
            const glow = new THREE.Mesh(glowGeo, glowMat);
            glow.position.copy(this.mesh.position);
            glow.position.y += 20;
            this.mesh.add(glow);

            // Animate glow
            const animateGlow = () => {
                glow.scale.multiplyScalar(1.05);
                glow.material.opacity *= 0.95;
                if(glow.material.opacity > 0.01) {
                    requestAnimationFrame(animateGlow);
                } else {
                    this.mesh.remove(glow);
                }
            };
            animateGlow();

            console.log(`Plant watered! Health: ${this.health}, Points: ${this.pointValue}`);

            return this.pointValue;
        }

        this.updateAppearance();
        return 0;
    }

    updateAppearance() {
        const healthRatio = this.health / 100;

        if(this.type === 'flower' && this.petals) {
            this.petals.forEach(petal => {
                const hue = this.watered ? 0.3 : (0.95 - (1 - healthRatio) * 0.8);
                const sat = this.watered ? 0.9 : healthRatio * 0.8;
                const light = this.watered ? 0.6 : (0.3 + healthRatio * 0.3);
                petal.material.color.setHSL(hue, sat, light);

                if(this.watered) {
                    petal.material.emissive = new THREE.Color(0x00ff00);
                    petal.material.emissiveIntensity = 0.1;
                }
            });
        } else if(this.type === 'tree' && this.foliageLayers) {
            this.foliageLayers.forEach(foliage => {
                const hue = this.watered ? 0.3 : (0.25 - (1 - healthRatio) * 0.15);
                const sat = this.watered ? 0.9 : healthRatio * 0.8;
                const light = this.watered ? 0.5 : (0.2 + healthRatio * 0.2);
                foliage.material.color.setHSL(hue, sat, light);

                if(this.watered) {
                    foliage.material.emissive = new THREE.Color(0x00ff00);
                    foliage.material.emissiveIntensity = 0.05;
                }
            });
        } else if(this.type === 'bush' && this.bush) {
            const hue = this.watered ? 0.3 : (0.25 - (1 - healthRatio) * 0.15);
            const sat = this.watered ? 0.9 : healthRatio * 0.7;
            const light = this.watered ? 0.5 : (0.2 + healthRatio * 0.2);
            this.bush.material.color.setHSL(hue, sat, light);

            if(this.watered) {
                this.bush.material.emissive = new THREE.Color(0x00ff00);
                this.bush.material.emissiveIntensity = 0.05;
            }
        }

        if(this.indicator) {
            if(this.watered) {
                this.indicator.color.setHex(0x00ff00);
                this.indicator.intensity = 2;
            } else {
                const r = 1;
                const g = healthRatio;
                const b = 0;
                this.indicator.color.setRGB(r, g, b);
                this.indicator.intensity = 3 - healthRatio * 1.5;
            }
        }

        if(this.waterIcon) {
            this.waterIcon.visible = !this.watered;
        }
    }

    update() {
        if(this.waterIcon && this.waterIcon.visible && !this.watered) {
            this.waterIcon.rotation.y += 0.03;
            this.waterIcon.position.y = 40 + Math.sin(Date.now() * 0.003) * 3;

            const pulse = 0.8 + Math.sin(Date.now() * 0.005) * 0.2;
            this.waterIcon.scale.setScalar(pulse);
        }

        if(this.watered) {
            // Gentle rotation for watered plants
            this.mesh.rotation.y += 0.005;

            // Swaying animation
            if(this.type === 'flower' && this.petals) {
                this.petals.forEach((petal, i) => {
                    petal.position.y = 18 + Math.sin(Date.now() * 0.002 + i) * 0.5;
                    petal.rotation.z = Math.sin(Date.now() * 0.001 + i) * 0.1;
                });
            }
        }

        // Pulsing indicator
        if(this.indicator && !this.watered) {
            this.indicator.intensity = 3 + Math.sin(Date.now() * 0.01) * 1;
        }
    }
}

// ========================================
// INITIALIZATION & GAME MANAGEMENT
// ========================================

function initThreeJS() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.0003);

    camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 5000);
    camera.position.set(0, 200, 300);

    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('c'),
        antialias: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    setupLighting();
    createSky();
}

function setupLighting() {
    ambientLight = new THREE.HemisphereLight(0x87ceeb, 0x494949, 0.6);
    scene.add(ambientLight);

    sun = new THREE.DirectionalLight(0xffd4a3, 2);
    sun.position.set(500, 800, 500);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    scene.add(sun);
}

function createSky() {
    const skyGeo = new THREE.SphereGeometry(4000, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({
        color: 0x87ceeb,
        side: THREE.BackSide
    });
    sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);
}

function generateCity() {
    // Ground
    const groundGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
    const groundMat = new THREE.MeshPhongMaterial({
        color: 0x3a5f0b
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI/2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Lake
    const lakeGeo = new THREE.CircleGeometry(120, 32);
    const lakeMat = new THREE.MeshPhongMaterial({
        color: 0x006994,
        transparent: true,
        opacity: 0.7
    });
    lakeMesh = new THREE.Mesh(lakeGeo, lakeMat);
    lakeMesh.rotation.x = -Math.PI/2;
    lakeMesh.position.y = 0.5;
    scene.add(lakeMesh);

    // Buildings
    for(let i = 0; i < 20; i++) {
        const width = 50 + Math.random() * 80;
        const height = 60 + Math.random() * 150;
        const depth = 50 + Math.random() * 80;

        const buildingGeo = new THREE.BoxGeometry(width, height, depth);
        const buildingMat = new THREE.MeshPhongMaterial({
            color: new THREE.Color().setHSL(0.6, 0.1, 0.3)
        });

        const building = new THREE.Mesh(buildingGeo, buildingMat);

        let x, z;
        do {
            x = (Math.random() - 0.5) * (MAP_SIZE - 200);
            z = (Math.random() - 0.5) * (MAP_SIZE - 200);
        } while(Math.sqrt(x*x + z*z) < 200);

        building.position.set(x, height/2, z);
        building.castShadow = true;
        scene.add(building);
    }
}
// ========================================
// CORRECTION DU SYSTÈME DE MARQUEURS
// ========================================

// Remplacez la fonction generatePlants() par cette version corrigée :

function generatePlants() {
    // Nettoyer les anciennes plantes ET leurs marqueurs
    plants.forEach(plant => {
        if (plant.mesh) scene.remove(plant.mesh);
        if (plant.marker) scene.remove(plant.marker);
    });
    plants = [];

    const plantCount = 30;

    for(let i = 0; i < plantCount; i++) {
        const types = ['flower', 'tree', 'bush'];
        const type = types[Math.floor(Math.random() * types.length)];

        let x, z;
        let validPosition = false;
        let attempts = 0;

        while(!validPosition && attempts < 100) {
            x = (Math.random() - 0.5) * (MAP_SIZE - 200);
            z = (Math.random() - 0.5) * (MAP_SIZE - 200);

            // Éviter le lac central
            if(Math.sqrt(x*x + z*z) > 150) {
                validPosition = true;

                // Vérifier la distance avec les autres plantes
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
            attempts++;
        }

        if(validPosition) {
            const plant = new Plant(new THREE.Vector3(x, 0, z), type);
            plants.push(plant);

            // OPTIONNEL : Créer un marqueur rouge vertical (commentez si non désiré)
            /*
            const markerGeo = new THREE.CylinderGeometry(0.5, 0.5, 100, 8);
            const markerMat = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                transparent: true,
                opacity: 0.3
            });
            const marker = new THREE.Mesh(markerGeo, markerMat);
            marker.position.set(x, 50, z);
            scene.add(marker);
            plant.marker = marker;
            */
        }
    }

    stats.totalPlants = plants.length;
    document.getElementById('totalPlants').textContent = plants.length;

    console.log(`Generated ${plants.length} plants`);
}

// ========================================
// AMÉLIORATION DE LA CLASSE PLANT
// ========================================

// Remplacez la méthode water() dans la classe Plant par cette version améliorée :

Plant.prototype.water = function(amount) {
    if(this.watered) return 0;

    this.health = Math.min(100, this.health + amount);

    if(this.health >= 100 && !this.watered) {
        this.watered = true;

        // ===== EFFETS VISUELS DE COMPLETION =====

        // 1. Retirer le marqueur rouge s'il existe
        if(this.marker) {
            scene.remove(this.marker);
            this.marker = null;
        }

        // 2. Changer la lumière indicatrice en vert
        if(this.indicator) {
            this.indicator.color.setHex(0x00ff00);
            this.indicator.intensity = 4; // Plus brillant
        }

        // 3. Cacher l'icône d'eau
        if(this.waterIcon) {
            scene.remove(this.waterIcon);
            this.waterIcon = null;
        }

        // 4. Effet de lumière verte qui pulse
        const glowGeo = new THREE.SphereGeometry(25, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.6
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.copy(this.mesh.position);
        glow.position.y += 20;
        scene.add(glow);

        // Animation du glow
        let glowScale = 1;
        const animateGlow = () => {
            glowScale += 0.08;
            glow.scale.setScalar(glowScale);
            glow.material.opacity *= 0.92;

            if(glow.material.opacity > 0.01) {
                requestAnimationFrame(animateGlow);
            } else {
                scene.remove(glow);
            }
        };
        animateGlow();

        // 5. Particules de célébration
        for(let i = 0; i < 10; i++) {
            const particleGeo = new THREE.SphereGeometry(1, 8, 8);
            const particleMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(0.3, 1, 0.5 + Math.random() * 0.3)
            });
            const particle = new THREE.Mesh(particleGeo, particleMat);
            particle.position.copy(this.mesh.position);
            particle.position.y += 20;

            const angle = (i / 10) * Math.PI * 2;
            particle.velocity = new THREE.Vector3(
                Math.cos(angle) * 5,
                Math.random() * 10 + 5,
                Math.sin(angle) * 5
            );
            particle.life = 60;

            scene.add(particle);
            particles.push({
                mesh: particle,
                position: particle.position,
                velocity: particle.velocity,
                life: particle.life
            });
        }

        // 6. Changement de couleur de la plante
        this.updateCompletedAppearance();

        console.log(`✅ Plant watered! Type: ${this.type}, Points: ${this.pointValue}`);

        return this.pointValue;
    }

    this.updateAppearance();
    return 0;
};

// Nouvelle méthode pour l'apparence des plantes arrosées
Plant.prototype.updateCompletedAppearance = function() {
    if(this.type === 'flower' && this.petals) {
        this.petals.forEach((petal, i) => {
            // Couleurs vibrantes pour les fleurs arrosées
            petal.material.color.setHSL(0.3 + i * 0.02, 1, 0.6);
            petal.material.emissive = new THREE.Color(0x00ff00);
            petal.material.emissiveIntensity = 0.2;

            // Animation de croissance
            petal.scale.multiplyScalar(1.2);
        });
    } else if(this.type === 'tree' && this.foliageLayers) {
        this.foliageLayers.forEach((foliage, i) => {
            // Vert luxuriant pour les arbres
            foliage.material.color.setHSL(0.3, 0.9, 0.4);
            foliage.material.emissive = new THREE.Color(0x00ff00);
            foliage.material.emissiveIntensity = 0.1;

            // Croissance du feuillage
            foliage.scale.multiplyScalar(1.15);
        });
    } else if(this.type === 'bush' && this.bush) {
        // Vert vif pour les buissons
        this.bush.material.color.setHSL(0.3, 1, 0.4);
        this.bush.material.emissive = new THREE.Color(0x00ff00);
        this.bush.material.emissiveIntensity = 0.15;

        // Expansion du buisson
        this.bush.scale.multiplyScalar(1.3);
    }
};

// ========================================
// AMÉLIORATION DE LA BOUCLE D'ANIMATION
// ========================================

// Remplacez la partie de la fonction animate() qui gère les plantes :

function animateImproved() {
    requestAnimationFrame(animateImproved);

    // Update AI drones
    if(gameRunning && !gamePaused) {
        for(let drone of aiDrones) {
            drone.update();
        }

        // Update plants avec effets visuels améliorés
        plants.forEach(plant => {
            plant.update();

            // Animation continue pour les plantes arrosées
            if(plant.watered) {
                // Retirer le marqueur s'il existe encore
                if(plant.marker) {
                    scene.remove(plant.marker);
                    plant.marker = null;
                }

                // Rotation douce
                plant.mesh.rotation.y += 0.003;

                // Effet de respiration (scale pulse)
                const breathe = 1 + Math.sin(Date.now() * 0.001) * 0.02;
                plant.mesh.scale.setScalar(breathe);

                // Particules d'énergie occasionnelles
                if(Math.random() < 0.01) {
                    const sparkGeo = new THREE.SphereGeometry(0.5, 6, 6);
                    const sparkMat = new THREE.MeshBasicMaterial({
                        color: 0x00ff88,
                        transparent: true,
                        opacity: 0.8
                    });
                    const spark = new THREE.Mesh(sparkGeo, sparkMat);
                    spark.position.copy(plant.mesh.position);
                    spark.position.y += 25;
                    spark.position.x += (Math.random() - 0.5) * 10;
                    spark.position.z += (Math.random() - 0.5) * 10;

                    spark.velocity = new THREE.Vector3(0, 2, 0);
                    spark.life = 30;

                    scene.add(spark);
                    particles.push({
                        mesh: spark,
                        position: spark.position,
                        velocity: spark.velocity,
                        life: spark.life
                    });
                }
            } else {
                // Pour les plantes non arrosées, faire pulser l'indicateur
                if(plant.indicator) {
                    const pulse = 3 + Math.sin(Date.now() * 0.01) * 2;
                    plant.indicator.intensity = pulse;
                }
            }
        });

        // Check for completed mission
        if(stats.plantsWatered >= stats.totalPlants) {
            console.log('🎉 Mission complete! All plants watered.');

            // Effet de célébration finale
            if(!window.celebrationTriggered) {
                window.celebrationTriggered = true;
                celebrateMissionComplete();
            }

            endGame(true);
        }
    }

    // Le reste du code d'animation continue normalement...
    // (water drops, particles, etc.)
}

// ========================================
// EFFET DE CÉLÉBRATION
// ========================================

function celebrateMissionComplete() {
    // Feu d'artifice de particules
    for(let i = 0; i < 100; i++) {
        setTimeout(() => {
            const particleGeo = new THREE.SphereGeometry(2, 8, 8);
            const hue = Math.random();
            const particleMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(hue, 1, 0.5),
                transparent: true,
                opacity: 1
            });
            const particle = new THREE.Mesh(particleGeo, particleMat);

            // Position aléatoire au-dessus de la carte
            particle.position.set(
                (Math.random() - 0.5) * MAP_SIZE,
                200 + Math.random() * 100,
                (Math.random() - 0.5) * MAP_SIZE
            );

            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                Math.random() * 5 - 10,
                (Math.random() - 0.5) * 10
            );
            particle.life = 100;

            scene.add(particle);
            particles.push({
                mesh: particle,
                position: particle.position,
                velocity: particle.velocity,
                life: particle.life
            });
        }, i * 20);
    }

    // Flash de lumière
    const flash = new THREE.PointLight(0xffffff, 10, 1000);
    flash.position.set(0, 300, 0);
    scene.add(flash);

    let flashIntensity = 10;
    const animateFlash = () => {
        flashIntensity *= 0.9;
        flash.intensity = flashIntensity;
        if(flashIntensity > 0.1) {
            requestAnimationFrame(animateFlash);
        } else {
            scene.remove(flash);
        }
    };
    animateFlash();

    console.log('🎆 CELEBRATION! Mission accomplie avec succès!');
}

// ========================================
// INDICATEURS VISUELS AMÉLIORÉS
// ========================================

// Fonction pour créer un anneau au sol autour des plantes non arrosées
function createPlantRing(plant) {
    const ringGeo = new THREE.RingGeometry(15, 20, 32);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(plant.mesh.position);
    ring.position.y = 0.5;

    scene.add(ring);
    plant.ring = ring;

    // Animation du ring
    const animateRing = () => {
        if(!plant.watered && plant.ring) {
            ring.scale.setScalar(1 + Math.sin(Date.now() * 0.003) * 0.1);
            ring.material.opacity = 0.2 + Math.sin(Date.now() * 0.005) * 0.1;
            requestAnimationFrame(animateRing);
        } else if(plant.ring) {
            scene.remove(plant.ring);
            plant.ring = null;
        }
    };
    animateRing();
}

// Appliquer les anneaux à toutes les plantes au démarrage
function applyPlantRings() {
    plants.forEach(plant => {
        if(!plant.watered) {
            createPlantRing(plant);
        }
    });
}

function createAIDrones(count) {
    // Remove existing drones
    aiDrones.forEach(drone => scene.remove(drone.mesh));
    aiDrones = [];

    // Create new drones
    for(let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const radius = 100;
        const startPos = new THREE.Vector3(
            Math.cos(angle) * radius,
            80,
            Math.sin(angle) * radius
        );

        const drone = new AIDrone(i + 1, startPos);
        aiDrones.push(drone);
    }
}

function startNewGame() {
    gameRunning = true;
    gamePaused = false;
    stats.score = 0;
    stats.plantsWatered = 0;
    startTime = Date.now();
    remainingTime = gameTimeLimit;

    // Clear communications
    droneComm.assignedTargets.clear();
    droneComm.plantAssignments.clear();
    droneComm.messages = [];

    document.getElementById('gameOver').style.display = 'none';

    // Get drone count
    droneCount = parseInt(document.getElementById('droneCount').value);

    // Generate world
    generatePlants();
    createAIDrones(droneCount);

    updateHUD();
    showModeIndicator(`🚁 Mission lancée avec ${droneCount} drones!`);
}

function pauseGame() {
    if(!gameRunning) return;

    gamePaused = !gamePaused;
    if(gamePaused) {
        showModeIndicator("⏸️ PAUSE");
    } else {
        showModeIndicator("▶️ REPRISE");
        startTime = Date.now() - (gameTimeLimit - remainingTime);
    }
}

function endGame(success) {
    gameRunning = false;

    const gameOverDiv = document.getElementById('gameOver');
    const title = document.getElementById('gameOverTitle');

    if(success) {
        title.textContent = "🎉 MISSION RÉUSSIE!";
        title.style.color = "#00ff00";
    } else {
        title.textContent = "⏰ TEMPS ÉCOULÉ!";
        title.style.color = "#ff6666";
    }

    document.getElementById('finalScore').textContent = stats.score;
    document.getElementById('finalPlants').textContent =
        `${stats.plantsWatered}/${stats.totalPlants}`;

    const elapsed = gameTimeLimit - remainingTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    document.getElementById('finalTime').textContent =
        `${minutes}:${seconds.toString().padStart(2, '0')}`;

    document.getElementById('finalEfficiency').textContent =
        Math.round(stats.efficiency) + '%';

    let comparison = "";
    if(stats.score > stats.highScore) {
        comparison = "🏆 NOUVEAU RECORD!";
        stats.highScore = stats.score;
        localStorage.setItem('droneSquadHighScore', stats.highScore);
    } else {
        comparison = `Record: ${stats.highScore} points`;
    }

    document.getElementById('scoreComparison').textContent = comparison;
    gameOverDiv.style.display = 'block';
}

function updateHUD() {
    document.getElementById('activeDrones').textContent = aiDrones.length;
    document.getElementById('score').textContent = stats.score;
    document.getElementById('plantsWatered').textContent = stats.plantsWatered;
    document.getElementById('highScore').textContent = stats.highScore;

    // Calculate efficiency
    if(aiDrones.length > 0) {
        const totalDistance = aiDrones.reduce((sum, d) => sum + d.distanceTraveled, 0);
        const totalWatered = aiDrones.reduce((sum, d) => sum + d.plantsWatered, 0);
        stats.efficiency = totalWatered > 0 ? (totalWatered * 100) / (totalDistance / 100) : 0;
        document.getElementById('efficiency').textContent =
            Math.round(stats.efficiency);
    }

    // Mission status
    let status = "En cours...";
    if(stats.plantsWatered === stats.totalPlants) {
        status = "✅ Complété!";
    } else if(remainingTime < 60000) {
        status = "⚠️ Temps critique!";
    }
    document.getElementById('missionStatus').textContent = status;
}

function updateTimer() {
    if(!gameRunning || gamePaused) return;

    const elapsed = Date.now() - startTime;
    remainingTime = gameTimeLimit - elapsed;

    if(remainingTime <= 0) {
        remainingTime = 0;
        endGame(false);
    }

    // Check win condition
    if(stats.plantsWatered === stats.totalPlants && gameRunning) {
        endGame(true);
    }

    const totalSeconds = Math.ceil(remainingTime / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const timerElement = document.getElementById('timeRemaining');
    timerElement.textContent =
        `⏰ TEMPS: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    if(totalSeconds <= 30) {
        timerElement.classList.add('urgent');
    } else {
        timerElement.classList.remove('urgent');
    }
}

function updateAIStatus() {
    if(!aiDebugMode) return;

    const content = document.getElementById('aiStatusContent');
    content.innerHTML = '';

    for(let drone of aiDrones) {
        const status = drone.getStatus();
        const div = document.createElement('div');
        div.className = `ai-drone-status ${status.state.toLowerCase()}`;
        div.innerHTML = `
            <strong>Drone ${status.id}</strong><br>
            État: ${status.state}<br>
            Eau: ${Math.round(status.waterLevel)}%<br>
            Plantes: ${status.plantsWatered}<br>
            Cible: ${status.target !== null ? `Plante ${status.target}` : 'Aucune'}
        `;
        content.appendChild(div);
    }
}

function toggleCamera() {
    cameraMode = (cameraMode + 1) % 4;
    const modes = ['Vue libre', 'Suivi drone 1', 'Vue aérienne', 'Vue cinématique'];
    showModeIndicator(`📷 ${modes[cameraMode]}`);

    if(cameraMode === 1 && aiDrones.length > 0) {
        cameraTarget = aiDrones[0];
    } else {
        cameraTarget = null;
    }
}

function toggleAIDebug() {
    aiDebugMode = !aiDebugMode;
    const statusDiv = document.getElementById('aiStatus');
    statusDiv.classList.toggle('active', aiDebugMode);
    showModeIndicator(aiDebugMode ? "🧠 Debug IA activé" : "🧠 Debug IA désactivé");
}

function updateCamera() {
    switch(cameraMode) {
        case 0: // Free camera
            const targetPos = new THREE.Vector3(0, 100, 0);
            camera.position.lerp(new THREE.Vector3(
                Math.sin(mouseX * 0.005) * 400,
                200 + mouseY * 0.2,
                Math.cos(mouseX * 0.005) * 400
            ), 0.05);
            camera.lookAt(targetPos);
            break;

        case 1: // Follow drone
            if(cameraTarget && cameraTarget.mesh) {
                const offset = new THREE.Vector3(0, 80, 150);
                camera.position.lerp(
                    cameraTarget.mesh.position.clone().add(offset),
                    0.1
                );
                camera.lookAt(cameraTarget.mesh.position);
            }
            break;

        case 2: // Top view
            camera.position.lerp(new THREE.Vector3(0, 800, 100), 0.05);
            camera.lookAt(new THREE.Vector3(0, 0, 0));
            break;

        case 3: // Cinematic
            const time = Date.now() * 0.0005;
            camera.position.set(
                Math.sin(time) * 500,
                150 + Math.sin(time * 2) * 50,
                Math.cos(time) * 500
            );
            camera.lookAt(new THREE.Vector3(0, 50, 0));
            break;
    }
}

function updateRadar() {
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

    // Center reference
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(100, 100, 50, 0, Math.PI * 2);
    ctx.stroke();

    // Drones
    for(let drone of aiDrones) {
        const x = (drone.mesh.position.x / MAP_SIZE) * 200 + 100;
        const z = (drone.mesh.position.z / MAP_SIZE) * 200 + 100;

        ctx.fillStyle = drone.state === 'REFILLING' ? '#0088ff' : '#00ffff';
        ctx.beginPath();
        ctx.arc(x, z, 4, 0, Math.PI * 2);
        ctx.fill();

        // ID
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Arial';
        ctx.fillText(drone.id.toString(), x - 3, z - 6);
    }

    // Plants
    for(let plant of plants) {
        const x = (plant.mesh.position.x / MAP_SIZE) * 200 + 100;
        const z = (plant.mesh.position.z / MAP_SIZE) * 200 + 100;

        ctx.fillStyle = plant.watered ? '#00ff00' : '#ff0000';
        ctx.beginPath();
        ctx.arc(x, z, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Lake
    ctx.fillStyle = '#0066aa';
    ctx.beginPath();
    ctx.arc(100, 100, 12, 0, Math.PI * 2);
    ctx.fill();
}

function createWaterSplash(position, count = 20) {
    for(let i = 0; i < count; i++) {
        const particleGeo = new THREE.SphereGeometry(Math.random() * 1 + 0.5);
        const particleMat = new THREE.MeshPhongMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.9
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
    // Create 3D text sprite for score
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 256, 0);
    gradient.addColorStop(0, '#00ff88');
    gradient.addColorStop(1, '#00d4ff');

    ctx.fillStyle = gradient;
    ctx.font = 'bold 64px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(position);
    sprite.position.y += 30;
    sprite.scale.set(20, 10, 1);
    scene.add(sprite);

    // Animate floating up
    const startY = sprite.position.y;
    const startTime = Date.now();

    const animateScore = () => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / 2000;

        if (progress < 1) {
            sprite.position.y = startY + progress * 30;
            sprite.material.opacity = 1 - progress;
            sprite.scale.multiplyScalar(1 + progress * 0.02);
            requestAnimationFrame(animateScore);
        } else {
            scene.remove(sprite);
        }
    };

    animateScore();

    // Also create DOM popup for better visibility
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
// INPUT HANDLING
// ========================================

document.getElementById('droneCount').addEventListener('input', (e) => {
    document.getElementById('droneCountDisplay').textContent = e.target.value;
});

window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX - window.innerWidth / 2;
    mouseY = e.clientY - window.innerHeight / 2;
});

window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;

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

    // Update AI drones
    if(gameRunning && !gamePaused) {
        for(let drone of aiDrones) {
            drone.update();
        }

        // Update plants
        plants.forEach(plant => {
            plant.update();

            // Remove marker if plant is watered
            if(plant.watered && plant.marker) {
                scene.remove(plant.marker);
                plant.marker = null;
            }
        });

        // Check for completed mission
        if(stats.plantsWatered >= stats.totalPlants) {
            console.log('Mission complete! All plants watered.');
            endGame(true);
        }
    }

    // Update water drops with improved physics
    waterDrops = waterDrops.filter(drop => {
        if(gamePaused) return true;

        drop.position.add(drop.velocity);
        drop.velocity.y -= 0.3; // Gravity
        drop.velocity.x *= 0.98; // Air resistance
        drop.velocity.z *= 0.98;
        drop.life--;

        // Check if drop hits ground or plant
        if(drop.position.y <= 0) {
            // Check if near any plant
            for(let plant of plants) {
                if(!plant.watered) {
                    const dist = Math.sqrt(
                        Math.pow(drop.position.x - plant.mesh.position.x, 2) +
                        Math.pow(drop.position.z - plant.mesh.position.z, 2)
                    );
                    if(dist < 30) {
                        plant.water(1); // Small contribution from drops
                    }
                }
            }

            scene.remove(drop);
            return false;
        }

        if(drop.life <= 0) {
            scene.remove(drop);
            return false;
        }

        // Fade out
        const scale = drop.life / 30;
        drop.scale.setScalar(scale);
        if(drop.material) {
            drop.material.opacity = 0.9 * scale;
        }

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
                p.mesh.material.opacity = Math.max(0, p.life / 40);
            }

            if(p.life <= 0) {
                scene.remove(p.mesh);
                return false;
            }
        }
        return true;
    });

    // Update lighting
    if(sun) {
        const time = Date.now() * 0.00005;
        sun.intensity = 1.8 + Math.sin(time) * 0.2;
    }

    updateCamera();
    updateRadar();
    updateTimer();
    updateHUD();
    updateAIStatus();

    if(renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// ========================================
// INITIALIZATION (FIN)
// ========================================

window.addEventListener('DOMContentLoaded', () => {
    console.log('🚁 Initializing Drone Squad AI System...');

    try {
        // Initialize Three.js
        initThreeJS();
        console.log('✅ Three.js initialized');

        // Generate city
        generateCity();
        console.log('✅ City generated');

        // Start animation loop
        animate();
        console.log('✅ Animation started');

        // Show welcome message
        setTimeout(() => {
            showModeIndicator("🤖 Système IA Coopératif prêt!");
            console.log('Ready to start mission!');
            setTimeout(() => {
                showModeIndicator("🚁 Configurez le nombre de drones et lancez la mission!");
            }, 3000);
        }, 1000);

    } catch (error) {
        console.error('❌ Initialization error:', error);
    }
});

// Make functions globally accessible for HTML buttons
window.startNewGame = startNewGame;
window.pauseGame = pauseGame;
window.toggleCamera = toggleCamera;
window.toggleAIDebug = toggleAIDebug;

// ========================================
// DEBUG HELPERS
// ========================================

// Add keyboard shortcuts for debugging
window.addEventListener('keydown', (e) => {
    // Press 'D' for debug mode
    if(e.key === 'd' || e.key === 'D') {
        toggleAIDebug();
    }

    // Press 'R' to reset game
    if(e.key === 'r' || e.key === 'R') {
        if(confirm('Reset game?')) {
            location.reload();
        }
    }

    // Press 'W' to instantly water all plants (debug)
    if(e.key === 'w' || e.key === 'W') {
        if(aiDebugMode) {
            plants.forEach(plant => {
                if(!plant.watered) {
                    plant.health = 100;
                    plant.water(0);
                    stats.plantsWatered++;
                    stats.score += plant.pointValue;
                }
            });
            updateHUD();
            console.log('Debug: All plants watered instantly');
        }
    }
});

// Log game state periodically for debugging
setInterval(() => {
    if(gameRunning && aiDebugMode) {
        console.log('Game State:', {
            plantsWatered: stats.plantsWatered,
            totalPlants: stats.totalPlants,
            dronesActive: aiDrones.length,
            droneStates: aiDrones.map(d => ({
                id: d.id,
                state: d.state,
                water: Math.round(d.waterLevel)
            }))
        });
    }
}, 5000);

console.log('🎮 Drone Squad AI Game loaded successfully!');
console.log('📋 Instructions:');
console.log('  1. Select number of drones (1-10)');
console.log('  2. Click "Lancer Mission" to start');
console.log('  3. Press C to change camera view');
console.log('  4. Press D to toggle AI debug mode');
console.log('  5. Watch the drones cooperate to water all plants!');
// ========================================
// CONFIGURATION D'ARROSAGE PERSONNALISABLE
// ========================================

// Ajoutez ceci au début de votre fichier game-ai.js après les variables globales

// ========================================
// CONFIGURATION POUR ARROSAGE EN 1 SECONDE
// ========================================

// Remplacez la configuration WATERING_CONFIG dans votre fichier par celle-ci :

const WATERING_CONFIG = {
    // ⚡ CONFIGURATION POUR 1 SECONDE D'ARROSAGE ⚡

    // Temps entre chaque tick d'arrosage (20ms = 50 ticks par seconde)
    WATERING_INTERVAL: 20,       // 20ms entre chaque arrosage

    // Points de santé par tick (100 santé / 50 ticks = 2 points par tick)
    WATER_AMOUNT_PER_TICK: 2,    // 2 points × 50 ticks/sec = 100 points en 1 seconde

    // Consommation d'eau (50 ticks pour une plante = 2% par tick pour vider en 1 plante)
    WATER_CONSUMPTION: 0.4,      // 0.4% × 50 ticks = 20% du réservoir par plante

    // Distance et hauteur d'arrosage
    WATERING_DISTANCE: 40,       // Distance pour arroser
    WATERING_HEIGHT: 40,         // Altitude d'arrosage

    // Vitesse des drones (plus rapide pour compenser)
    DRONE_SPEED: 1.2,            // Vitesse de déplacement augmentée
    APPROACH_SPEED: 0.5,         // Approche plus rapide
    DESCENT_SPEED: 1.0,          // Descente plus rapide

    // Configuration des plantes
    PLANT_MAX_HEALTH: 100,       // Santé maximale
    PLANT_CRITICAL_HEALTH: 30,   // Santé critique
};

// ========================================
// MÉTHODE WATERTARGET OPTIMISÉE POUR 1 SECONDE
// ========================================

// Remplacez la méthode waterTarget dans la classe AIDrone :

AIDrone.prototype.waterTarget = function() {
    if (!this.target || this.target.watered) {
        this.state = 'SEARCHING';
        this.target = null;
        return;
    }

    const dist = this.mesh.position.distanceTo(this.target.mesh.position);

    // Trop loin, recalculer le chemin
    if (dist > WATERING_CONFIG.WATERING_DISTANCE * 1.5) {
        this.calculatePath(this.target.mesh.position);
        this.state = 'MOVING';
        return;
    }

    // S'approcher rapidement si nécessaire
    if (dist > WATERING_CONFIG.WATERING_DISTANCE * 0.75) {
        const direction = this.target.mesh.position.clone().sub(this.mesh.position);
        direction.y = 0;
        direction.normalize();
        this.velocity.add(direction.multiplyScalar(WATERING_CONFIG.APPROACH_SPEED));
    }

    // Descendre rapidement à la bonne hauteur
    const targetHeight = WATERING_CONFIG.WATERING_HEIGHT;
    if (this.mesh.position.y > targetHeight + 5) {
        this.velocity.y = -WATERING_CONFIG.DESCENT_SPEED;
    } else if (this.mesh.position.y < targetHeight - 5) {
        this.velocity.y = WATERING_CONFIG.DESCENT_SPEED * 0.5;
    }

    // Arroser quand en position
    const now = Date.now();
    const inRange = dist < WATERING_CONFIG.WATERING_DISTANCE;
    const atHeight = Math.abs(this.mesh.position.y - targetHeight) < 10;

    if (inRange && atHeight) {
        // Marquer le début de l'arrosage
        if (!this.wateringStartTime) {
            this.wateringStartTime = now;
            console.log(`🚁 Drone ${this.id} commence l'arrosage...`);

            // Effet visuel de début d'arrosage
            createWateringBeam(this.mesh.position, this.target.mesh.position);
        }

        // Vérifier l'intervalle d'arrosage (20ms)
        if (now - this.lastWater >= WATERING_CONFIG.WATERING_INTERVAL && this.waterLevel > 0) {
            // Créer les gouttes d'eau
            this.createWaterDrops();

            // Consommer l'eau du réservoir
            this.waterLevel -= WATERING_CONFIG.WATER_CONSUMPTION;
            this.lastWater = now;

            // Arroser la plante (2 points par tick)
            const points = this.target.water(WATERING_CONFIG.WATER_AMOUNT_PER_TICK);

            // Afficher la progression tous les 20%
            const progress = Math.floor(this.target.health / 20) * 20;
            if (this.target.health === progress && !this.target.watered) {
                console.log(`  💧 Drone ${this.id}: ${progress}% (${((now - this.wateringStartTime) / 1000).toFixed(1)}s)`);
            }

            // Vérifier si la plante est complètement arrosée
            if (this.target.watered) {
                const wateringDuration = now - this.wateringStartTime;
                console.log(`✅ Drone ${this.id} a terminé en ${(wateringDuration / 1000).toFixed(2)} secondes!`);

                this.plantsWatered++;
                stats.plantsWatered++;
                stats.score += this.target.pointValue;

                // Feedback visuel
                createWaterSplash(this.target.mesh.position, 30);
                showScorePopup(this.target.mesh.position, `+${this.target.pointValue}`);

                // Nettoyer
                droneComm.plantAssignments.delete(this.target);
                droneComm.assignedTargets.delete(this.id);

                // Broadcast
                this.broadcast({
                    type: 'PLANT_WATERED',
                    droneId: this.id,
                    plantId: plants.indexOf(this.target),
                    points: this.target.pointValue,
                    wateringTime: wateringDuration
                });

                // Reset
                this.target = null;
                this.state = 'SEARCHING';
                this.wateringStartTime = null;

                updateHUD();
            }
        }
    } else {
        // Reset le timer si on sort de portée
        this.wateringStartTime = null;
    }

    // Vérifier le niveau d'eau
    if (this.waterLevel <= 10) {
        console.log(`⚠️ Drone ${this.id} doit recharger (eau: ${this.waterLevel.toFixed(1)}%)`);
        this.state = 'REFILLING';
        this.target = null;
        this.wateringStartTime = null;
    }
};

// ========================================
// EFFET VISUEL DE RAYON D'ARROSAGE
// ========================================

function createWateringBeam(dronePos, plantPos) {
    // Créer un rayon lumineux entre le drone et la plante
    const distance = dronePos.distanceTo(plantPos);
    const beamGeo = new THREE.CylinderGeometry(0.5, 2, distance, 8);
    const beamMat = new THREE.MeshBasicMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.4
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);

    // Positionner et orienter le rayon
    beam.position.copy(dronePos);
    beam.position.y -= distance / 2;
    beam.lookAt(plantPos);
    beam.rotateX(Math.PI / 2);

    scene.add(beam);

    // Animation du rayon
    let pulseScale = 1;
    const animateBeam = () => {
        pulseScale = 1 + Math.sin(Date.now() * 0.01) * 0.3;
        beam.scale.set(pulseScale, 1, pulseScale);
        beam.material.opacity = 0.3 + Math.sin(Date.now() * 0.02) * 0.2;

        if (beam.parent) {
            requestAnimationFrame(animateBeam);
        }
    };
    animateBeam();

    // Retirer après 1.5 secondes
    setTimeout(() => {
        scene.remove(beam);
    }, 1500);
}

// ========================================
// AFFICHAGE DES STATISTIQUES EN TEMPS RÉEL
// ========================================

class RealTimeStats {
    constructor() {
        this.wateringEvents = [];
        this.currentWaterings = new Map(); // drone -> start time
    }

    startWatering(droneId) {
        this.currentWaterings.set(droneId, Date.now());
    }

    endWatering(droneId) {
        const startTime = this.currentWaterings.get(droneId);
        if (startTime) {
            const duration = Date.now() - startTime;
            this.wateringEvents.push({
                droneId,
                duration,
                timestamp: Date.now()
            });
            this.currentWaterings.delete(droneId);

            // Afficher les stats
            this.displayStats();
            return duration;
        }
        return 0;
    }

    displayStats() {
        if (this.wateringEvents.length === 0) return;

        const avgTime = this.wateringEvents.reduce((sum, e) => sum + e.duration, 0) / this.wateringEvents.length;
        const minTime = Math.min(...this.wateringEvents.map(e => e.duration));
        const maxTime = Math.max(...this.wateringEvents.map(e => e.duration));

        console.log('📊 === STATISTIQUES D\'ARROSAGE ===');
        console.log(`   Temps moyen: ${(avgTime / 1000).toFixed(2)}s`);
        console.log(`   Plus rapide: ${(minTime / 1000).toFixed(2)}s`);
        console.log(`   Plus lent: ${(maxTime / 1000).toFixed(2)}s`);
        console.log(`   Total arrosées: ${this.wateringEvents.length}`);
        console.log('================================');
    }
}

const realTimeStats = new RealTimeStats();

// ========================================
// PRESETS RAPIDES
// ========================================

const SPEED_PRESETS = {
    ULTRA_RAPIDE: {
        name: "⚡ Ultra Rapide (0.5 sec)",
        WATERING_INTERVAL: 10,      // 10ms
        WATER_AMOUNT_PER_TICK: 2,   // 100 ticks × 2 = 200 (mais plafonné à 100)
        WATER_CONSUMPTION: 0.2,
        description: "Arrosage en 0.5 seconde"
    },

    STANDARD: {
        name: "⏱️ Standard (1 sec)",
        WATERING_INTERVAL: 20,      // 20ms
        WATER_AMOUNT_PER_TICK: 2,   // 50 ticks × 2 = 100
        WATER_CONSUMPTION: 0.4,
        description: "Arrosage en 1 seconde exactement"
    },

    REALISTE: {
        name: "🌱 Réaliste (3 sec)",
        WATERING_INTERVAL: 30,      // 30ms
        WATER_AMOUNT_PER_TICK: 1,   // 100 ticks × 1 = 100
        WATER_CONSUMPTION: 0.33,
        description: "Arrosage en 3 secondes"
    },

    SIMULATION: {
        name: "🎮 Simulation (5 sec)",
        WATERING_INTERVAL: 50,      // 50ms
        WATER_AMOUNT_PER_TICK: 1,   // 100 ticks × 1 = 100
        WATER_CONSUMPTION: 0.5,
        description: "Arrosage en 5 secondes"
    }
};

// Fonction pour changer la vitesse d'arrosage
function setWateringSpeed(preset) {
    const settings = SPEED_PRESETS[preset];
    if (settings) {
        WATERING_CONFIG.WATERING_INTERVAL = settings.WATERING_INTERVAL;
        WATERING_CONFIG.WATER_AMOUNT_PER_TICK = settings.WATER_AMOUNT_PER_TICK;
        WATERING_CONFIG.WATER_CONSUMPTION = settings.WATER_CONSUMPTION;

        console.log(`⚙️ Vitesse changée: ${settings.name}`);
        console.log(`📊 ${settings.description}`);
        showModeIndicator(settings.name);
    }
}

// ========================================
// CALCULS DE TEMPS DE MISSION
// ========================================

function calculateMissionTime() {
    const wateringTimePerPlant = 1.0; // 1 seconde
    const avgTravelTime = 3.0; // 3 secondes moyenne entre plantes
    const refillTime = 5.0; // 5 secondes pour recharger

    const plantsPerDrone = Math.ceil(stats.totalPlants / aiDrones.length);
    const refillsNeeded = Math.floor(plantsPerDrone / 5); // 5 plantes par réservoir

    const totalWateringTime = plantsPerDrone * wateringTimePerPlant;
    const totalTravelTime = plantsPerDrone * avgTravelTime;
    const totalRefillTime = refillsNeeded * refillTime;

    const estimatedTime = totalWateringTime + totalTravelTime + totalRefillTime;

    console.log('⏱️ === ESTIMATION DE MISSION ===');
    console.log(`   Drones: ${aiDrones.length}`);
    console.log(`   Plantes par drone: ${plantsPerDrone}`);
    console.log(`   Temps d'arrosage: ${totalWateringTime}s`);
    console.log(`   Temps de déplacement: ${totalTravelTime}s`);
    console.log(`   Temps de recharge: ${totalRefillTime}s`);
    console.log(`   TEMPS TOTAL ESTIMÉ: ${estimatedTime.toFixed(0)}s (${(estimatedTime/60).toFixed(1)} min)`);
    console.log('================================');

    return estimatedTime;
}

// Appeler au début de la mission
function onMissionStart() {
    console.clear();
    console.log('🚁 === MISSION DÉMARRÉE ===');
    console.log(`Configuration: Arrosage en 1 seconde par plante`);
    console.log(`Nombre de drones: ${aiDrones.length}`);
    console.log(`Nombre de plantes: ${stats.totalPlants}`);
    calculateMissionTime();
    console.log('==========================');
}

// ========================================
// COMMANDES CONSOLE POUR DEBUG
// ========================================

// Ajouter ces commandes globales pour tester
window.testWateringSpeed = {
    ultraFast: () => setWateringSpeed('ULTRA_RAPIDE'),
    standard: () => setWateringSpeed('STANDARD'),
    realistic: () => setWateringSpeed('REALISTE'),
    simulation: () => setWateringSpeed('SIMULATION'),

    // Test direct
    test1Second: () => {
        console.log('🧪 Test: Configuration pour 1 seconde exactement');
        console.log('   Interval: 20ms');
        console.log('   Points par tick: 2');
        console.log('   Total ticks: 50');
        console.log('   Temps total: 1000ms');
    }
};

console.log('💡 Commandes disponibles:');
console.log('   window.testWateringSpeed.standard() - Arrosage 1 seconde');
console.log('   window.testWateringSpeed.ultraFast() - Arrosage 0.5 seconde');
console.log('   window.testWateringSpeed.realistic() - Arrosage 3 secondes');
console.log('   window.testWateringSpeed.simulation() - Arrosage 5 secondes');

// Remplacez la méthode waterTarget() dans la classe AIDrone par cette version :

AIDrone.prototype.waterTarget = function() {
    if (!this.target || this.target.watered) {
        this.state = 'SEARCHING';
        this.target = null;
        return;
    }

    const dist = this.mesh.position.distanceTo(this.target.mesh.position);

    // Trop loin, recalculer le chemin
    if (dist > WATERING_CONFIG.WATERING_DISTANCE * 1.5) {
        this.calculatePath(this.target.mesh.position);
        this.state = 'MOVING';
        return;
    }

    // S'approcher si nécessaire
    if (dist > WATERING_CONFIG.WATERING_DISTANCE * 0.75) {
        const direction = this.target.mesh.position.clone().sub(this.mesh.position);
        direction.y = 0;
        direction.normalize();
        this.velocity.add(direction.multiplyScalar(WATERING_CONFIG.APPROACH_SPEED));
    }

    // Descendre à la bonne hauteur
    const targetHeight = WATERING_CONFIG.WATERING_HEIGHT;
    if (this.mesh.position.y > targetHeight + 5) {
        this.velocity.y = -WATERING_CONFIG.DESCENT_SPEED;
    } else if (this.mesh.position.y < targetHeight - 5) {
        this.velocity.y = WATERING_CONFIG.DESCENT_SPEED * 0.5;
    }

    // Arroser quand en position
    const now = Date.now();
    const inRange = dist < WATERING_CONFIG.WATERING_DISTANCE;
    const atHeight = Math.abs(this.mesh.position.y - targetHeight) < 10;

    if (inRange && atHeight) {
        // Vérifier l'intervalle d'arrosage
        if (now - this.lastWater > WATERING_CONFIG.WATERING_INTERVAL && this.waterLevel > 0) {
            // Créer les gouttes d'eau
            this.createWaterDrops();

            // Consommer l'eau du réservoir
            this.waterLevel -= WATERING_CONFIG.WATER_CONSUMPTION;
            this.lastWater = now;

            // Arroser la plante
            const points = this.target.water(WATERING_CONFIG.WATER_AMOUNT_PER_TICK);

            // Afficher la progression (optionnel)
            if (this.target.health % 20 === 0 && !this.target.watered) {
                console.log(`Drone ${this.id}: Arrosage ${this.target.health}%`);
            }

            // Vérifier si la plante est complètement arrosée
            if (this.target.watered) {
                this.plantsWatered++;
                stats.plantsWatered++;
                stats.score += this.target.pointValue;

                // Feedback visuel
                createWaterSplash(this.target.mesh.position, 30);
                showScorePopup(this.target.mesh.position, `+${this.target.pointValue}`);

                // Calculer le temps d'arrosage
                const wateringTime = (WATERING_CONFIG.PLANT_MAX_HEALTH / WATERING_CONFIG.WATER_AMOUNT_PER_TICK) * WATERING_CONFIG.WATERING_INTERVAL;
                console.log(`✅ Drone ${this.id} a terminé! Temps d'arrosage: ${(wateringTime/1000).toFixed(1)}s`);

                // Nettoyer l'assignation
                droneComm.plantAssignments.delete(this.target);
                droneComm.assignedTargets.delete(this.id);

                // Broadcast
                this.broadcast({
                    type: 'PLANT_WATERED',
                    droneId: this.id,
                    plantId: plants.indexOf(this.target),
                    points: this.target.pointValue,
                    wateringTime: wateringTime
                });

                this.target = null;
                this.state = 'SEARCHING';

                updateHUD();
            }
        }
    }

    // Vérifier le niveau d'eau
    if (this.waterLevel <= 10) {
        console.log(`⚠️ Drone ${this.id} doit recharger (eau: ${this.waterLevel.toFixed(1)}%)`);
        this.state = 'REFILLING';
        this.target = null;
    }
};

// ========================================
// PRESETS DE DIFFICULTÉ
// ========================================

const DIFFICULTY_PRESETS = {
    FACILE: {
        name: "Facile - Arrosage rapide",
        WATERING_INTERVAL: 30,
        WATER_AMOUNT_PER_TICK: 10,
        WATER_CONSUMPTION: 0.3,
        DRONE_SPEED: 1.0,
        description: "0.3 secondes par plante"
    },

    NORMAL: {
        name: "Normal - Équilibré",
        WATERING_INTERVAL: 50,
        WATER_AMOUNT_PER_TICK: 5,
        WATER_CONSUMPTION: 0.5,
        DRONE_SPEED: 0.8,
        description: "1 seconde par plante"
    },

    REALISTE: {
        name: "Réaliste - Simulation",
        WATERING_INTERVAL: 100,
        WATER_AMOUNT_PER_TICK: 2,
        WATER_CONSUMPTION: 0.4,
        DRONE_SPEED: 0.6,
        description: "5 secondes par plante"
    },

    DIFFICILE: {
        name: "Difficile - Challenge",
        WATERING_INTERVAL: 150,
        WATER_AMOUNT_PER_TICK: 1,
        WATER_CONSUMPTION: 0.6,
        DRONE_SPEED: 0.5,
        description: "15 secondes par plante"
    }
};

// Fonction pour changer la difficulté
function setDifficulty(preset) {
    const settings = DIFFICULTY_PRESETS[preset];
    if (settings) {
        Object.keys(settings).forEach(key => {
            if (WATERING_CONFIG[key] !== undefined) {
                WATERING_CONFIG[key] = settings[key];
            }
        });
        console.log(`⚙️ Difficulté changée: ${settings.name}`);
        console.log(`📊 ${settings.description}`);
        showModeIndicator(`Difficulté: ${settings.name}`);
    }
}

// ========================================
// STATISTIQUES D'ARROSAGE
// ========================================

class WateringStats {
    constructor() {
        this.wateringTimes = [];
        this.startTimes = new Map();
    }

    startWatering(droneId, plantId) {
        const key = `${droneId}-${plantId}`;
        this.startTimes.set(key, Date.now());
    }

    endWatering(droneId, plantId) {
        const key = `${droneId}-${plantId}`;
        const startTime = this.startTimes.get(key);
        if (startTime) {
            const duration = Date.now() - startTime;
            this.wateringTimes.push({
                droneId,
                plantId,
                duration,
                timestamp: Date.now()
            });
            this.startTimes.delete(key);
            return duration;
        }
        return 0;
    }

    getAverageTime() {
        if (this.wateringTimes.length === 0) return 0;
        const total = this.wateringTimes.reduce((sum, t) => sum + t.duration, 0);
        return total / this.wateringTimes.length;
    }

    getReport() {
        return {
            totalPlants: this.wateringTimes.length,
            averageTime: (this.getAverageTime() / 1000).toFixed(1),
            fastestTime: Math.min(...this.wateringTimes.map(t => t.duration)) / 1000,
            slowestTime: Math.max(...this.wateringTimes.map(t => t.duration)) / 1000,
            byDrone: this.getDroneStats()
        };
    }

    getDroneStats() {
        const stats = {};
        for (let entry of this.wateringTimes) {
            if (!stats[entry.droneId]) {
                stats[entry.droneId] = {
                    count: 0,
                    totalTime: 0
                };
            }
            stats[entry.droneId].count++;
            stats[entry.droneId].totalTime += entry.duration;
        }
        return stats;
    }
}

const wateringStats = new WateringStats();

// ========================================
// AJOUT AU HUD
// ========================================

// Ajouter ceci dans updateHUD() pour afficher les stats
function updateHUDWithStats() {
    // Appel normal
    updateHUD();

    // Ajouter les statistiques d'arrosage
    if (wateringStats.wateringTimes.length > 0) {
        const avgTime = wateringStats.getAverageTime() / 1000;
        const timePerPlant = avgTime.toFixed(1);

        // Estimation du temps restant
        const plantsLeft = stats.totalPlants - stats.plantsWatered;
        const estimatedTime = (plantsLeft * avgTime) / aiDrones.length;

        console.log(`📊 Temps moyen par plante: ${timePerPlant}s`);
        console.log(`⏱️ Temps estimé restant: ${estimatedTime.toFixed(0)}s`);
    }
}