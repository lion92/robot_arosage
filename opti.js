/**
 * ========================================
 * SYSTÈME DE COOPÉRATION AVANCÉ POUR DRONES
 * ========================================
 *
 * Ce module implémente un système de coopération intelligent pour une flotte de drones agricoles.
 * Optimisé pour maximiser l'efficacité et minimiser les conflits.
 */

class DroneCooperationSystem {
    constructor(config = {}) {
        // Configuration par défaut
        this.config = {
            maxDrones: 10,
            fieldWidth: 600,
            fieldHeight: 600,
            sectorSize: 100,
            communicationRange: 150,
            updateInterval: 100, // ms
            ...config
        };

        // État du système
        this.drones = new Map();
        this.tasks = new Map();
        this.sectors = new Map();
        this.assignments = new Map();
        this.completedTasks = new Set();

        // Métriques de performance
        this.metrics = {
            totalAssignments: 0,
            conflicts: 0,
            rebalances: 0,
            efficiency: 0,
            averageResponseTime: 0
        };

        // Initialiser les secteurs
        this.initializeSectors();
    }

    /**
     * Divise le champ en secteurs pour une meilleure organisation
     */
    initializeSectors() {
        const cols = Math.ceil(this.config.fieldWidth / this.config.sectorSize);
        const rows = Math.ceil(this.config.fieldHeight / this.config.sectorSize);

        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                const sectorId = `${i}-${j}`;
                this.sectors.set(sectorId, {
                    id: sectorId,
                    x: j * this.config.sectorSize,
                    y: i * this.config.sectorSize,
                    width: this.config.sectorSize,
                    height: this.config.sectorSize,
                    tasks: new Set(),
                    assignedDrones: new Set(),
                    priority: 1,
                    completed: false
                });
            }
        }
    }

    /**
     * Enregistre un nouveau drone dans le système
     */
    registerDrone(droneId, initialPosition, capabilities = {}) {
        const drone = {
            id: droneId,
            position: initialPosition,
            state: 'IDLE',
            capabilities: {
                speed: 2.0,
                waterCapacity: 100,
                range: 500,
                efficiency: 1.0,
                ...capabilities
            },
            currentTask: null,
            currentSector: null,
            waterLevel: 100,
            battery: 100,
            tasksCompleted: 0,
            totalDistance: 0,
            lastUpdate: Date.now(),
            nearbyDrones: new Set(),
            communicationBuffer: []
        };

        this.drones.set(droneId, drone);
        this.assignments.set(droneId, []);

        // Assigner au secteur initial
        const sector = this.getSectorForPosition(initialPosition);
        if (sector) {
            drone.currentSector = sector.id;
            sector.assignedDrones.add(droneId);
        }

        console.log(`✅ Drone ${droneId} enregistré avec succès`);
        return drone;
    }

    /**
     * Enregistre une nouvelle tâche (plante à arroser)
     */
    registerTask(taskId, position, priority = 1, requirements = {}) {
        const task = {
            id: taskId,
            position: position,
            priority: priority,
            requirements: {
                waterNeeded: 10,
                timeEstimate: 1000,
                ...requirements
            },
            status: 'PENDING',
            assignedDrone: null,
            createdAt: Date.now(),
            startedAt: null,
            completedAt: null
        };

        this.tasks.set(taskId, task);

        // Ajouter la tâche au secteur approprié
        const sector = this.getSectorForPosition(position);
        if (sector) {
            sector.tasks.add(taskId);
        }

        return task;
    }

    /**
     * Algorithme principal d'attribution des tâches
     */
    assignTasks() {
        const startTime = Date.now();
        const availableDrones = this.getAvailableDrones();
        const pendingTasks = this.getPendingTasks();

        if (availableDrones.length === 0 || pendingTasks.length === 0) {
            return [];
        }

        // Utiliser l'algorithme hongrois pour l'attribution optimale
        const assignments = this.hungarianAlgorithm(availableDrones, pendingTasks);

        // Appliquer les assignations
        assignments.forEach(({ droneId, taskId }) => {
            this.assignTaskToDrone(droneId, taskId);
        });

        // Mettre à jour les métriques
        this.metrics.totalAssignments += assignments.length;
        this.metrics.averageResponseTime =
            (this.metrics.averageResponseTime + (Date.now() - startTime)) / 2;

        return assignments;
    }

    /**
     * Algorithme hongrois pour l'attribution optimale des tâches
     */
    hungarianAlgorithm(drones, tasks) {
        const n = Math.min(drones.length, tasks.length);
        if (n === 0) return [];

        // Créer la matrice de coûts
        const costMatrix = this.createCostMatrix(drones, tasks);

        // Résoudre le problème d'affectation
        const assignments = this.solveMunkres(costMatrix, n);

        // Convertir en paires drone-tâche
        return assignments.map(([i, j]) => ({
            droneId: drones[i].id,
            taskId: tasks[j].id
        }));
    }

    /**
     * Crée une matrice de coûts pour l'algorithme hongrois
     */
    createCostMatrix(drones, tasks) {
        const matrix = [];

        for (let drone of drones) {
            const row = [];
            for (let task of tasks) {
                row.push(this.calculateCost(drone, task));
            }
            matrix.push(row);
        }

        return matrix;
    }

    /**
     * Calcule le coût pour qu'un drone effectue une tâche
     */
    calculateCost(drone, task) {
        // Distance
        const distance = this.calculateDistance(drone.position, task.position);

        // Priorité de la tâche (inverse pour que haute priorité = faible coût)
        const priorityCost = 1 / task.priority;

        // Capacité du drone
        const capacityCost = drone.waterLevel < task.requirements.waterNeeded ? 1000 : 0;

        // Charge de travail du secteur
        const sectorLoad = this.getSectorLoad(task.position);

        // Efficacité du drone
        const efficiencyCost = 1 / drone.capabilities.efficiency;

        // Coût total pondéré
        return (distance * 0.4) +
            (priorityCost * 100 * 0.3) +
            (capacityCost * 0.2) +
            (sectorLoad * 0.05) +
            (efficiencyCost * 50 * 0.05);
    }

    /**
     * Résout le problème d'affectation avec l'algorithme de Munkres
     */
    solveMunkres(costMatrix, n) {
        // Implémentation simplifiée de Munkres
        // Pour une vraie implémentation, utilisez une bibliothèque comme munkres-js

        const assignments = [];
        const usedRows = new Set();
        const usedCols = new Set();

        // Approche gloutonne simplifiée
        for (let iter = 0; iter < n; iter++) {
            let minCost = Infinity;
            let bestI = -1, bestJ = -1;

            for (let i = 0; i < costMatrix.length; i++) {
                if (usedRows.has(i)) continue;

                for (let j = 0; j < costMatrix[i].length && j < n; j++) {
                    if (usedCols.has(j)) continue;

                    if (costMatrix[i][j] < minCost) {
                        minCost = costMatrix[i][j];
                        bestI = i;
                        bestJ = j;
                    }
                }
            }

            if (bestI !== -1 && bestJ !== -1) {
                assignments.push([bestI, bestJ]);
                usedRows.add(bestI);
                usedCols.add(bestJ);
            }
        }

        return assignments;
    }

    /**
     * Assigne une tâche spécifique à un drone
     */
    assignTaskToDrone(droneId, taskId) {
        const drone = this.drones.get(droneId);
        const task = this.tasks.get(taskId);

        if (!drone || !task) return false;

        // Vérifier les conflits
        if (task.assignedDrone && task.assignedDrone !== droneId) {
            this.metrics.conflicts++;
            this.resolveConflict(task.assignedDrone, droneId, taskId);
            return false;
        }

        // Effectuer l'assignation
        drone.currentTask = taskId;
        drone.state = 'ASSIGNED';
        task.assignedDrone = droneId;
        task.status = 'ASSIGNED';

        // Ajouter à l'historique
        this.assignments.get(droneId).push({
            taskId: taskId,
            timestamp: Date.now()
        });

        // Notifier les drones voisins
        this.broadcastAssignment(droneId, taskId);

        console.log(`📋 Tâche ${taskId} assignée au drone ${droneId}`);
        return true;
    }

    /**
     * Résout un conflit d'attribution entre deux drones
     */
    resolveConflict(currentDroneId, newDroneId, taskId) {
        const currentDrone = this.drones.get(currentDroneId);
        const newDrone = this.drones.get(newDroneId);
        const task = this.tasks.get(taskId);

        if (!currentDrone || !newDrone || !task) return;

        // Calculer qui est le plus adapté
        const currentCost = this.calculateCost(currentDrone, task);
        const newCost = this.calculateCost(newDrone, task);

        if (newCost < currentCost * 0.8) { // Seuil de 20% pour éviter les changements fréquents
            // Réassigner au nouveau drone
            currentDrone.currentTask = null;
            currentDrone.state = 'IDLE';

            newDrone.currentTask = taskId;
            newDrone.state = 'ASSIGNED';
            task.assignedDrone = newDroneId;

            console.log(`⚠️ Conflit résolu: Tâche ${taskId} réassignée de ${currentDroneId} à ${newDroneId}`);

            // Trouver une nouvelle tâche pour l'ancien drone
            this.findAlternativeTask(currentDroneId);
        }
    }

    /**
     * Trouve une tâche alternative pour un drone
     */
    findAlternativeTask(droneId) {
        const drone = this.drones.get(droneId);
        if (!drone) return;

        const pendingTasks = this.getPendingTasks();
        let bestTask = null;
        let minCost = Infinity;

        for (let task of pendingTasks) {
            const cost = this.calculateCost(drone, task);
            if (cost < minCost) {
                minCost = cost;
                bestTask = task;
            }
        }

        if (bestTask) {
            this.assignTaskToDrone(droneId, bestTask.id);
        }
    }

    /**
     * Met à jour la position d'un drone et gère la communication
     */
    updateDronePosition(droneId, newPosition) {
        const drone = this.drones.get(droneId);
        if (!drone) return;

        // Calculer la distance parcourue
        const distance = this.calculateDistance(drone.position, newPosition);
        drone.totalDistance += distance;

        // Mettre à jour la position
        drone.position = newPosition;
        drone.lastUpdate = Date.now();

        // Mettre à jour le secteur
        const oldSector = this.sectors.get(drone.currentSector);
        const newSector = this.getSectorForPosition(newPosition);

        if (oldSector && newSector && oldSector.id !== newSector.id) {
            oldSector.assignedDrones.delete(droneId);
            newSector.assignedDrones.add(droneId);
            drone.currentSector = newSector.id;
        }

        // Mettre à jour les drones voisins
        this.updateNearbyDrones(droneId);

        // Vérifier si proche de la tâche
        if (drone.currentTask) {
            const task = this.tasks.get(drone.currentTask);
            if (task && this.calculateDistance(newPosition, task.position) < 30) {
                drone.state = 'WORKING';
                if (!task.startedAt) {
                    task.startedAt = Date.now();
                }
            }
        }
    }

    /**
     * Met à jour la liste des drones voisins pour la communication
     */
    updateNearbyDrones(droneId) {
        const drone = this.drones.get(droneId);
        if (!drone) return;

        drone.nearbyDrones.clear();

        for (let [otherId, otherDrone] of this.drones) {
            if (otherId === droneId) continue;

            const distance = this.calculateDistance(drone.position, otherDrone.position);
            if (distance <= this.config.communicationRange) {
                drone.nearbyDrones.add(otherId);

                // Communication bidirectionnelle
                otherDrone.nearbyDrones.add(droneId);
            }
        }
    }

    /**
     * Diffuse une information aux drones voisins
     */
    broadcastAssignment(droneId, taskId) {
        const drone = this.drones.get(droneId);
        if (!drone) return;

        const message = {
            type: 'ASSIGNMENT',
            from: droneId,
            taskId: taskId,
            timestamp: Date.now()
        };

        for (let nearbyId of drone.nearbyDrones) {
            const nearbyDrone = this.drones.get(nearbyId);
            if (nearbyDrone) {
                nearbyDrone.communicationBuffer.push(message);
            }
        }
    }

    /**
     * Marque une tâche comme complétée
     */
    completeTask(droneId, taskId) {
        const drone = this.drones.get(droneId);
        const task = this.tasks.get(taskId);

        if (!drone || !task) return false;

        // Mettre à jour la tâche
        task.status = 'COMPLETED';
        task.completedAt = Date.now();
        this.completedTasks.add(taskId);

        // Mettre à jour le drone
        drone.currentTask = null;
        drone.state = 'IDLE';
        drone.tasksCompleted++;
        drone.waterLevel -= task.requirements.waterNeeded;

        // Retirer la tâche du secteur
        const sector = this.getSectorForPosition(task.position);
        if (sector) {
            sector.tasks.delete(taskId);

            // Vérifier si le secteur est complété
            if (sector.tasks.size === 0) {
                sector.completed = true;
                this.optimizeSectorAllocation();
            }
        }

        // Calculer l'efficacité
        this.updateEfficiency();

        console.log(`✅ Tâche ${taskId} complétée par drone ${droneId}`);

        // Chercher une nouvelle tâche
        this.findAlternativeTask(droneId);

        return true;
    }

    /**
     * Optimise l'allocation des drones entre les secteurs
     */
    optimizeSectorAllocation() {
        const incompleteSectors = Array.from(this.sectors.values())
            .filter(s => !s.completed)
            .sort((a, b) => b.tasks.size - a.tasks.size);

        const idleDrones = Array.from(this.drones.values())
            .filter(d => d.state === 'IDLE');

        // Répartir les drones idle sur les secteurs incomplets
        for (let i = 0; i < idleDrones.length && i < incompleteSectors.length; i++) {
            const drone = idleDrones[i];
            const sector = incompleteSectors[i];

            // Déplacer le drone vers le secteur
            const targetPosition = {
                x: sector.x + sector.width / 2,
                y: sector.y + sector.height / 2
            };

            console.log(`🔄 Redirection du drone ${drone.id} vers secteur ${sector.id}`);

            // Trouver la tâche la plus proche dans ce secteur
            let closestTask = null;
            let minDistance = Infinity;

            for (let taskId of sector.tasks) {
                const task = this.tasks.get(taskId);
                if (task && task.status === 'PENDING') {
                    const dist = this.calculateDistance(targetPosition, task.position);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestTask = task;
                    }
                }
            }

            if (closestTask) {
                this.assignTaskToDrone(drone.id, closestTask.id);
            }
        }

        this.metrics.rebalances++;
    }

    /**
     * Stratégie de formation en V pour déplacement groupé
     */
    formVFormation(leaderDroneId, followerDroneIds) {
        const leader = this.drones.get(leaderDroneId);
        if (!leader) return;

        const formations = [];
        const spacing = 30;
        const angle = Math.PI / 6; // 30 degrés

        followerDroneIds.forEach((followerId, index) => {
            const follower = this.drones.get(followerId);
            if (!follower) return;

            // Calculer la position en formation
            const side = index % 2 === 0 ? 1 : -1;
            const row = Math.floor(index / 2) + 1;

            const offsetX = side * row * spacing * Math.sin(angle);
            const offsetY = -row * spacing * Math.cos(angle);

            const targetPosition = {
                x: leader.position.x + offsetX,
                y: leader.position.y + offsetY
            };

            formations.push({
                droneId: followerId,
                targetPosition: targetPosition
            });
        });

        return formations;
    }

    /**
     * Stratégie de balayage en ligne pour couvrir une zone
     */
    sweepLineStrategy(droneIds, area) {
        const strategies = [];
        const lineSpacing = area.width / droneIds.length;

        droneIds.forEach((droneId, index) => {
            const drone = this.drones.get(droneId);
            if (!drone) return;

            const startX = area.x + (index + 0.5) * lineSpacing;
            const path = [];

            // Créer un chemin en zigzag
            for (let y = area.y; y <= area.y + area.height; y += 50) {
                const x = (Math.floor((y - area.y) / 100) % 2 === 0)
                    ? startX
                    : startX + lineSpacing * 0.8;

                path.push({ x, y });
            }

            strategies.push({
                droneId: droneId,
                path: path,
                estimatedTime: path.length * 1000 / drone.capabilities.speed
            });
        });

        return strategies;
    }

    /**
     * Calcule l'efficacité globale du système
     */
    updateEfficiency() {
        const totalTasks = this.tasks.size;
        const completedTasks = this.completedTasks.size;

        if (totalTasks === 0) {
            this.metrics.efficiency = 0;
            return;
        }

        // Efficacité basée sur le taux de complétion
        const completionRate = completedTasks / totalTasks;

        // Efficacité basée sur l'utilisation des drones
        const activeDrones = Array.from(this.drones.values())
            .filter(d => d.state !== 'IDLE').length;
        const utilizationRate = this.drones.size > 0
            ? activeDrones / this.drones.size
            : 0;

        // Efficacité basée sur les conflits
        const conflictPenalty = Math.max(0, 1 - (this.metrics.conflicts / totalTasks));

        // Efficacité combinée
        this.metrics.efficiency =
            (completionRate * 0.5 + utilizationRate * 0.3 + conflictPenalty * 0.2) * 100;

        return this.metrics.efficiency;
    }

    /**
     * Prédit le temps restant pour compléter toutes les tâches
     */
    predictCompletionTime() {
        const pendingTasks = this.getPendingTasks();
        const activeDrones = Array.from(this.drones.values())
            .filter(d => d.state !== 'IDLE');

        if (activeDrones.length === 0) return Infinity;

        // Calculer le taux moyen de complétion
        const averageTasksPerDrone = activeDrones.reduce((sum, d) =>
            sum + d.tasksCompleted, 0) / activeDrones.length;

        const averageTimePerTask = this.getAverageTaskTime();

        // Estimation simple
        const tasksPerDrone = pendingTasks.length / activeDrones.length;
        const estimatedTime = tasksPerDrone * averageTimePerTask;

        return estimatedTime;
    }

    /**
     * Obtient le temps moyen pour compléter une tâche
     */
    getAverageTaskTime() {
        const completedTasksList = Array.from(this.completedTasks)
            .map(id => this.tasks.get(id))
            .filter(t => t && t.completedAt && t.startedAt);

        if (completedTasksList.length === 0) return 5000; // Estimation par défaut

        const totalTime = completedTasksList.reduce((sum, task) =>
            sum + (task.completedAt - task.startedAt), 0);

        return totalTime / completedTasksList.length;
    }

    /**
     * Optimise les routes des drones avec l'algorithme du voyageur de commerce
     */
    optimizeRoutes(droneId) {
        const drone = this.drones.get(droneId);
        if (!drone) return null;

        // Obtenir les tâches du secteur actuel
        const sector = this.sectors.get(drone.currentSector);
        if (!sector) return null;

        const tasks = Array.from(sector.tasks)
            .map(id => this.tasks.get(id))
            .filter(t => t && t.status === 'PENDING');

        if (tasks.length <= 1) return tasks;

        // Algorithme du plus proche voisin (simplification du TSP)
        const route = [];
        let currentPos = drone.position;
        const remainingTasks = [...tasks];

        while (remainingTasks.length > 0) {
            let nearestTask = null;
            let minDistance = Infinity;
            let nearestIndex = -1;

            for (let i = 0; i < remainingTasks.length; i++) {
                const task = remainingTasks[i];
                const distance = this.calculateDistance(currentPos, task.position);

                if (distance < minDistance) {
                    minDistance = distance;
                    nearestTask = task;
                    nearestIndex = i;
                }
            }

            if (nearestTask) {
                route.push(nearestTask);
                currentPos = nearestTask.position;
                remainingTasks.splice(nearestIndex, 1);
            }
        }

        return route;
    }

    // ========== MÉTHODES UTILITAIRES ==========

    /**
     * Calcule la distance entre deux positions
     */
    calculateDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Obtient le secteur correspondant à une position
     */
    getSectorForPosition(position) {
        const col = Math.floor(position.x / this.config.sectorSize);
        const row = Math.floor(position.y / this.config.sectorSize);
        const sectorId = `${row}-${col}`;
        return this.sectors.get(sectorId);
    }

    /**
     * Obtient la charge de travail d'un secteur
     */
    getSectorLoad(position) {
        const sector = this.getSectorForPosition(position);
        if (!sector) return 0;

        const taskCount = sector.tasks.size;
        const droneCount = sector.assignedDrones.size;

        return droneCount > 0 ? taskCount / droneCount : taskCount;
    }

    /**
     * Obtient les drones disponibles
     */
    getAvailableDrones() {
        return Array.from(this.drones.values())
            .filter(d => d.state === 'IDLE' && d.waterLevel >= 20);
    }

    /**
     * Obtient les tâches en attente
     */
    getPendingTasks() {
        return Array.from(this.tasks.values())
            .filter(t => t.status === 'PENDING')
            .sort((a, b) => b.priority - a.priority);
    }

    /**
     * Exporte les métriques du système
     */
    exportMetrics() {
        return {
            ...this.metrics,
            totalDrones: this.drones.size,
            totalTasks: this.tasks.size,
            completedTasks: this.completedTasks.size,
            pendingTasks: this.getPendingTasks().length,
            activeDrones: Array.from(this.drones.values())
                .filter(d => d.state !== 'IDLE').length,
            averageTaskTime: this.getAverageTaskTime(),
            estimatedCompletionTime: this.predictCompletionTime()
        };
    }

    /**
     * Réinitialise le système
     */
    reset() {
        this.drones.clear();
        this.tasks.clear();
        this.assignments.clear();
        this.completedTasks.clear();
        this.initializeSectors();

        this.metrics = {
            totalAssignments: 0,
            conflicts: 0,
            rebalances: 0,
            efficiency: 0,
            averageResponseTime: 0
        };

        console.log('🔄 Système de coopération réinitialisé');
    }
}

// ========== EXEMPLE D'UTILISATION ==========

// Créer une instance du système
const cooperationSystem = new DroneCooperationSystem({
    fieldWidth: 800,
    fieldHeight: 800,
    sectorSize: 100,
    communicationRange: 200
});

// Enregistrer des drones
for (let i = 1; i <= 5; i++) {
    cooperationSystem.registerDrone(`drone-${i}`, {
        x: Math.random() * 800,
        y: Math.random() * 800
    }, {
        speed: 2 + Math.random(),
        efficiency: 0.8 + Math.random() * 0.2
    });
}

// Enregistrer des tâches (plantes à arroser)
for (let i = 1; i <= 50; i++) {
    cooperationSystem.registerTask(`plant-${i}`, {
        x: Math.random() * 800,
        y: Math.random() * 800
    }, Math.random() * 3 + 1); // Priorité aléatoire
}

// Boucle de simulation
setInterval(() => {
    // Assigner les tâches
    cooperationSystem.assignTasks();

    // Simuler le mouvement des drones
    for (let [droneId, drone] of cooperationSystem.drones) {
        if (drone.currentTask) {
            const task = cooperationSystem.tasks.get(drone.currentTask);
            if (task) {
                // Déplacer vers la tâche
                const dx = task.position.x - drone.position.x;
                const dy = task.position.y - drone.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 5) {
                    // Se déplacer
                    const moveX = (dx / distance) * drone.capabilities.speed;
                    const moveY = (dy / distance) * drone.capabilities.speed;

                    cooperationSystem.updateDronePosition(droneId, {
                        x: drone.position.x + moveX,
                        y: drone.position.y + moveY
                    });
                } else {
                    // Arrivé à destination, compléter la tâche
                    cooperationSystem.completeTask(droneId, drone.currentTask);
                }
            }
        }
    }

    // Afficher les métriques
    const metrics = cooperationSystem.exportMetrics();
    console.log(`📊 Efficacité: ${metrics.efficiency.toFixed(1)}% | Tâches: ${metrics.completedTasks}/${metrics.totalTasks}`);

}, 100);

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DroneCooperationSystem;
}