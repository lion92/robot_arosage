// ==========================================
// enhanced.js - AMÉLIORATIONS DU JEU TACTICAL DRONE
// ==========================================

// Configuration des améliorations
const ENHANCED_CONFIG = {
    BUILDING_COUNT: 25,  // Augmenté à 25 comme demandé
    SPECIAL_ABILITIES: true,
    WEATHER_EFFECTS: true,
    ADVANCED_AI: true,
    SCORE_SYSTEM: true
};

// Système de score
let gameScore = {
    points: 0,
    combo: 0,
    maxCombo: 0,
    multiplier: 1,
    buildingsDestroyed: 0,
    missilesFired: 0,
    hits: 0,
    accuracy: 0
};

// ==========================================
// OVERRIDE DE LA GÉNÉRATION DE VILLE - 25 BÂTIMENTS
// ==========================================

// Remplacer la fonction generateCity pour avoir 25 bâtiments
const originalGenerateCity = window.generateCity;
window.generateCity = function() {
    buildings = [];
    const blockSize = 100;
    const buildingCount = ENHANCED_CONFIG.BUILDING_COUNT; // 25 bâtiments

    for (let i = 0; i < buildingCount; i++) {
        let x, z;

        // Distribution améliorée des bâtiments
        do {
            x = (Math.random() - 0.5) * CONFIG.CITY_SIZE * 0.9;
            z = (Math.random() - 0.5) * CONFIG.CITY_SIZE * 0.9;
        } while (Math.abs(x) < 80 && Math.abs(z) < 80);

        // Aligner sur la grille
        x = Math.round(x / blockSize) * blockSize + (Math.random() - 0.5) * 30;
        z = Math.round(z / blockSize) * blockSize + (Math.random() - 0.5) * 30;

        const width = 25 + Math.random() * 25;
        const height = 40 + Math.random() * 120;
        const depth = 25 + Math.random() * 25;

        buildings.push(new Building(x, z, width, height, depth));
    }

    // Ajouter des bâtiments spéciaux
    addSpecialBuildings();

    document.getElementById('totalTargets').textContent = buildingCount;
    updateStats();
};

// ==========================================
// BÂTIMENTS SPÉCIAUX
// ==========================================

function addSpecialBuildings() {
    // Ajouter 3 bâtiments blindés (plus résistants)
    for (let i = 0; i < 3 && i < buildings.length; i++) {
        const building = buildings[i];
        building.health = 200;
        building.maxHealth = 200;
        building.isArmored = true;

        // Changer la couleur pour indiquer qu'il est blindé
        if (building.mesh) {
            building.mesh.material.color.setHex(0x333333);
            building.mesh.material.metalness = 0.8;
        }
    }
}

// ==========================================
// SYSTÈME DE COMBO ET SCORE
// ==========================================

// Override de la fonction takeDamage pour ajouter le système de score
const originalBuildingPrototype = Building.prototype.takeDamage;
Building.prototype.takeDamage = function(damage, attacker) {
    if (this.destroyed) return;

    // Calcul du score
    gameScore.points += Math.floor(damage * gameScore.multiplier);
    gameScore.combo++;

    // Mise à jour du multiplicateur
    if (gameScore.combo > 0 && gameScore.combo % 5 === 0) {
        gameScore.multiplier = Math.min(gameScore.multiplier + 0.5, 5);
        showComboNotification();
    }

    // Reset combo timer
    clearTimeout(window.comboResetTimer);
    window.comboResetTimer = setTimeout(() => {
        gameScore.combo = 0;
        gameScore.multiplier = 1;
    }, 3000);

    // Appeler la fonction originale
    originalBuildingPrototype.call(this, damage, attacker);

    // Mise à jour de l'affichage du score
    updateScoreDisplay();
};

// ==========================================
// CAPACITÉS SPÉCIALES
// ==========================================

// Ajouter un bouton pour l'attaque ultime
function addUltimateButton() {
    const controls = document.getElementById('tacticalControls');
    if (controls && !document.getElementById('ultimateBtn')) {
        const ultimateBtn = document.createElement('button');
        ultimateBtn.id = 'ultimateBtn';
        ultimateBtn.className = 'tactical-btn';
        ultimateBtn.style.background = 'linear-gradient(135deg, #9C27B0, #673AB7)';
        ultimateBtn.textContent = '💥 FRAPPE ORBITALE';
        ultimateBtn.onclick = executeOrbitalStrike;
        controls.appendChild(ultimateBtn);
    }
}

// Frappe orbitale
let orbitalStrikeReady = true;
function executeOrbitalStrike() {
    if (!orbitalStrikeReady) {
        showAlert("Frappe orbitale en recharge!");
        return;
    }

    orbitalStrikeReady = false;
    showAlert("FRAPPE ORBITALE LANCÉE!");

    // Effet visuel spectaculaire
    const targetBuildings = buildings.filter(b => !b.destroyed).slice(0, 5);

    targetBuildings.forEach((building, index) => {
        setTimeout(() => {
            // Rayon laser depuis le ciel
            const laserGeometry = new THREE.CylinderGeometry(2, 5, 500);
            const laserMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.8
            });
            const laser = new THREE.Mesh(laserGeometry, laserMaterial);
            laser.position.copy(building.position);
            laser.position.y = 250;
            scene.add(laser);

            // Animation du laser
            let laserIntensity = 0;
            const laserAnimation = setInterval(() => {
                laserIntensity += 0.1;
                laser.material.opacity = Math.sin(laserIntensity) * 0.8 + 0.2;
                laser.scale.x = 1 + Math.sin(laserIntensity) * 0.3;
                laser.scale.z = 1 + Math.sin(laserIntensity) * 0.3;

                if (laserIntensity > Math.PI) {
                    building.takeDamage(1000, null);
                    scene.remove(laser);
                    clearInterval(laserAnimation);
                }
            }, 30);
        }, index * 200);
    });

    // Cooldown de 60 secondes
    setTimeout(() => {
        orbitalStrikeReady = true;
        showAlert("Frappe orbitale prête!");
    }, 60000);
}

// ==========================================
// EFFETS MÉTÉO
// ==========================================

function createWeatherEffects() {
    if (!ENHANCED_CONFIG.WEATHER_EFFECTS) return;

    // Particules de pluie
    const rainGeometry = new THREE.BufferGeometry();
    const rainCount = 1000;
    const positions = new Float32Array(rainCount * 3);

    for (let i = 0; i < rainCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * CONFIG.CITY_SIZE;
        positions[i + 1] = Math.random() * 500;
        positions[i + 2] = (Math.random() - 0.5) * CONFIG.CITY_SIZE;
    }

    rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const rainMaterial = new THREE.PointsMaterial({
        color: 0xaaaaaa,
        size: 2,
        transparent: true,
        opacity: 0.6
    });

    const rain = new THREE.Points(rainGeometry, rainMaterial);
    scene.add(rain);

    // Animation de la pluie
    function animateRain() {
        const positions = rain.geometry.attributes.position.array;
        for (let i = 1; i < positions.length; i += 3) {
            positions[i] -= 5;
            if (positions[i] < 0) {
                positions[i] = 500;
            }
        }
        rain.geometry.attributes.position.needsUpdate = true;
        requestAnimationFrame(animateRain);
    }

    // Activer/désactiver selon le temps
    if (Math.random() > 0.7) {
        animateRain();
    }
}

// ==========================================
// IA AMÉLIORÉE POUR LES DRONES
// ==========================================

// Override de la fonction searchTarget pour une IA plus intelligente
const originalSearchTarget = Drone.prototype.searchTarget;
Drone.prototype.searchTarget = function() {
    if (!ENHANCED_CONFIG.ADVANCED_AI) {
        originalSearchTarget.call(this);
        return;
    }

    const availableTargets = buildings.filter(b =>
        !b.destroyed && b.targetedBy.length < 2
    );

    if (availableTargets.length > 0) {
        // Ciblage intelligent basé sur plusieurs facteurs
        let bestTarget = null;
        let bestScore = -Infinity;

        availableTargets.forEach(building => {
            const distance = this.position.distanceTo(building.position);
            const healthRatio = building.health / building.maxHealth;

            // Prioriser les bâtiments endommagés et proches
            let score = 0;
            score -= distance * 0.5; // Pénalité de distance
            score += (1 - healthRatio) * 100; // Bonus pour bâtiments endommagés
            score -= building.targetedBy.length * 50; // Pénalité si déjà ciblé

            if (building.isArmored) {
                score -= 25; // Pénalité pour bâtiments blindés
            }

            if (score > bestScore) {
                bestScore = score;
                bestTarget = building;
            }
        });

        if (bestTarget) {
            this.target = bestTarget;
            this.target.targetedBy.push(this);
            this.state = 'TARGETING';
        }
    } else {
        this.state = 'SEARCHING';
    }
};

// ==========================================
// INTERFACE UTILISATEUR AMÉLIORÉE
// ==========================================

// Ajouter un panneau de score
function addScorePanel() {
    if (document.getElementById('scorePanel')) return;

    const scorePanel = document.createElement('div');
    scorePanel.id = 'scorePanel';
    scorePanel.style.cssText = `
        position: fixed;
        top: 20px;
        right: 340px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 15px;
        border-radius: 10px;
        border: 1px solid rgba(255, 193, 7, 0.5);
        min-width: 150px;
        box-shadow: 0 0 20px rgba(255, 193, 7, 0.3);
    `;

    scorePanel.innerHTML = `
        <h3 style="color: #FFC107; margin-bottom: 10px;">📊 SCORE</h3>
        <div class="stat-line">
            <span>Points:</span>
            <span id="scorePoints" style="color: #FFC107;">0</span>
        </div>
        <div class="stat-line">
            <span>Combo:</span>
            <span id="scoreCombo" style="color: #FF5722;">x0</span>
        </div>
        <div class="stat-line">
            <span>Multi:</span>
            <span id="scoreMultiplier" style="color: #4CAF50;">x1</span>
        </div>
    `;

    document.body.appendChild(scorePanel);
}

// Mise à jour de l'affichage du score
function updateScoreDisplay() {
    const pointsEl = document.getElementById('scorePoints');
    const comboEl = document.getElementById('scoreCombo');
    const multiEl = document.getElementById('scoreMultiplier');

    if (pointsEl) pointsEl.textContent = gameScore.points.toLocaleString();
    if (comboEl) comboEl.textContent = `x${gameScore.combo}`;
    if (multiEl) multiEl.textContent = `x${gameScore.multiplier.toFixed(1)}`;
}

// Notification de combo
function showComboNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0);
        background: linear-gradient(135deg, #FFC107, #FF5722);
        color: white;
        padding: 20px 40px;
        border-radius: 10px;
        font-size: 32px;
        font-weight: bold;
        z-index: 1001;
        animation: comboPopup 0.5s ease-out forwards;
    `;

    notification.textContent = `COMBO x${gameScore.combo}!`;
    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 2000);
}

// ==========================================
// EFFETS VISUELS AMÉLIORÉS
// ==========================================

// Override createExplosion pour des explosions plus spectaculaires
const originalCreateExplosion = window.createExplosion;
window.createExplosion = function(position) {
    // Explosion originale
    originalCreateExplosion(position);

    // Ajouter des effets supplémentaires
    // Onde de choc étendue
    const shockwaveGeometry = new THREE.RingGeometry(1, 2, 32);
    const shockwaveMaterial = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
    });

    for (let i = 0; i < 3; i++) {
        const shockwave = new THREE.Mesh(shockwaveGeometry, shockwaveMaterial);
        shockwave.position.copy(position);
        shockwave.rotation.x = -Math.PI / 2;
        scene.add(shockwave);

        // Animation décalée
        setTimeout(() => {
            const animateShockwave = () => {
                shockwave.scale.x += 0.8;
                shockwave.scale.y += 0.8;
                shockwave.material.opacity -= 0.03;

                if (shockwave.material.opacity > 0) {
                    requestAnimationFrame(animateShockwave);
                } else {
                    scene.remove(shockwave);
                }
            };
            animateShockwave();
        }, i * 100);
    }

    // Flash lumineux
    const flash = new THREE.PointLight(0xffaa00, 10, 200);
    flash.position.copy(position);
    scene.add(flash);

    let flashIntensity = 10;
    const flashAnimation = setInterval(() => {
        flashIntensity *= 0.9;
        flash.intensity = flashIntensity;

        if (flashIntensity < 0.1) {
            scene.remove(flash);
            clearInterval(flashAnimation);
        }
    }, 30);
};

// ==========================================
// CONTRÔLES CLAVIER AMÉLIORÉS
// ==========================================

document.addEventListener('keydown', (e) => {
    switch(e.key.toLowerCase()) {
        case 'u':
            executeOrbitalStrike();
            break;
        case 'p':
            togglePause();
            break;
        case 'm':
            toggleMinimap();
            break;
        case 'escape':
            showPauseMenu();
            break;
    }
});

// Système de pause
let isPaused = false;
function togglePause() {
    isPaused = !isPaused;
    gameRunning = !isPaused;

    if (isPaused) {
        showPauseMenu();
    } else {
        hidePauseMenu();
    }
}

function showPauseMenu() {
    if (document.getElementById('pauseMenu')) return;

    const pauseMenu = document.createElement('div');
    pauseMenu.id = 'pauseMenu';
    pauseMenu.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    `;

    pauseMenu.innerHTML = `
        <h1 style="color: #ff5722; font-size: 48px; margin-bottom: 30px;">PAUSE</h1>
        <button onclick="togglePause()" style="
            margin: 10px;
            padding: 15px 40px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 18px;
            font-weight: bold;
        ">REPRENDRE</button>
        <button onclick="location.reload()" style="
            margin: 10px;
            padding: 15px 40px;
            background: #ff5722;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 18px;
            font-weight: bold;
        ">RECOMMENCER</button>
    `;

    document.body.appendChild(pauseMenu);
}

function hidePauseMenu() {
    const pauseMenu = document.getElementById('pauseMenu');
    if (pauseMenu) pauseMenu.remove();
}

// Minimap toggle
function toggleMinimap() {
    if (!document.getElementById('minimap')) {
        createMinimap();
    } else {
        const minimap = document.getElementById('minimap');
        minimap.style.display = minimap.style.display === 'none' ? 'block' : 'none';
    }
}

function createMinimap() {
    const minimap = document.createElement('canvas');
    minimap.id = 'minimap';
    minimap.width = 200;
    minimap.height = 200;
    minimap.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        border: 2px solid #ff5722;
        border-radius: 10px;
        background: rgba(0, 0, 0, 0.8);
    `;
    document.body.appendChild(minimap);

    // Mettre à jour la minimap
    updateMinimap();
}

function updateMinimap() {
    const minimap = document.getElementById('minimap');
    if (!minimap) return;

    const ctx = minimap.getContext('2d');
    ctx.clearRect(0, 0, 200, 200);

    // Fond
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, 200, 200);

    // Échelle
    const scale = 200 / CONFIG.CITY_SIZE;

    // Dessiner les bâtiments
    buildings.forEach(building => {
        if (!building.destroyed) {
            ctx.fillStyle = building.isArmored ? '#666' : '#999';
            const x = (building.position.x + CONFIG.CITY_SIZE/2) * scale;
            const z = (building.position.z + CONFIG.CITY_SIZE/2) * scale;
            ctx.fillRect(x - 3, z - 3, 6, 6);
        }
    });

    // Dessiner les drones
    drones.forEach(drone => {
        ctx.fillStyle = '#ff5722';
        const x = (drone.position.x + CONFIG.CITY_SIZE/2) * scale;
        const z = (drone.position.z + CONFIG.CITY_SIZE/2) * scale;
        ctx.beginPath();
        ctx.arc(x, z, 3, 0, Math.PI * 2);
        ctx.fill();
    });

    // Base
    ctx.fillStyle = '#2196F3';
    ctx.beginPath();
    ctx.arc(100, 100, 8, 0, Math.PI * 2);
    ctx.fill();

    // Mettre à jour régulièrement
    if (gameRunning) {
        requestAnimationFrame(updateMinimap);
    }
}

// ==========================================
// ANIMATIONS CSS SUPPLÉMENTAIRES
// ==========================================

const enhancedStyles = document.createElement('style');
enhancedStyles.textContent = `
    @keyframes comboPopup {
        0% {
            transform: translate(-50%, -50%) scale(0) rotate(0deg);
            opacity: 0;
        }
        50% {
            transform: translate(-50%, -50%) scale(1.2) rotate(5deg);
            opacity: 1;
        }
        100% {
            transform: translate(-50%, -50%) scale(1) rotate(0deg);
            opacity: 1;
        }
    }
    
    .stat-line {
        transition: all 0.3s ease;
    }
    
    .stat-line:hover {
        background: rgba(255, 255, 255, 0.1) !important;
        transform: translateX(5px);
    }
    
    #scorePanel .stat-line span:last-child {
        font-weight: bold;
        text-shadow: 0 0 5px currentColor;
    }
    
    @keyframes pulseGlow {
        0%, 100% { box-shadow: 0 0 20px rgba(255, 87, 34, 0.3); }
        50% { box-shadow: 0 0 40px rgba(255, 87, 34, 0.6); }
    }
    
    #ultimateBtn {
        animation: pulseGlow 2s infinite;
    }
`;
document.head.appendChild(enhancedStyles);

// ==========================================
// INITIALISATION AU CHARGEMENT
// ==========================================

window.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Enhanced Mode Activé!');
    console.log('📊 25 bâtiments configurés');
    console.log('💥 Capacités spéciales disponibles');

    // Ajouter les éléments d'interface
    setTimeout(() => {
        addScorePanel();
        addUltimateButton();
        createWeatherEffects();
    }, 1000);
});

// Override de checkVictory pour ajouter le score final
const originalCheckVictory = window.checkVictory;
window.checkVictory = function() {
    const destroyed = buildings.filter(b => b.destroyed).length;
    const total = buildings.length;

    if (destroyed === total) {
        // Bonus de victoire
        gameScore.points += 10000;
        gameScore.maxCombo = Math.max(gameScore.maxCombo, gameScore.combo);

        // Calculer la précision
        if (gameScore.missilesFired > 0) {
            gameScore.accuracy = Math.round((gameScore.hits / gameScore.missilesFired) * 100);
        }

        // Afficher le score final
        showFinalScore();
    }

    // Appeler la fonction originale
    originalCheckVictory();
};

// Affichage du score final
function showFinalScore() {
    const finalScoreDiv = document.createElement('div');
    finalScoreDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #1a1a2e, #16213e);
        padding: 40px;
        border-radius: 20px;
        border: 3px solid #ff5722;
        color: white;
        text-align: center;
        z-index: 10000;
        min-width: 400px;
        box-shadow: 0 0 50px rgba(255, 87, 34, 0.5);
    `;

    finalScoreDiv.innerHTML = `
        <h1 style="color: #4CAF50; font-size: 36px; margin-bottom: 20px;">VICTOIRE!</h1>
        <h2 style="color: #FFC107; font-size: 28px; margin-bottom: 30px;">Score Final: ${gameScore.points.toLocaleString()}</h2>
        <div style="text-align: left; margin: 20px 0;">
            <p>🎯 Précision: ${gameScore.accuracy}%</p>
            <p>🔥 Combo Maximum: x${gameScore.maxCombo}</p>
            <p>💥 Bâtiments Détruits: ${buildings.length}/${ENHANCED_CONFIG.BUILDING_COUNT}</p>
        </div>
        <button onclick="location.reload()" style="
            margin-top: 20px;
            padding: 15px 40px;
            background: linear-gradient(135deg, #ff5722, #f44336);
            color: white;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-size: 18px;
            font-weight: bold;
        ">NOUVELLE MISSION</button>
    `;

    document.body.appendChild(finalScoreDiv);
}

console.log('✅ Enhanced.js chargé avec succès!');