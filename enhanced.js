// ==========================================
// enhancedGame.js - FONCTIONNALITÉS AVANCÉES
// ==========================================

// Affichage des meilleurs scores
function showHighScores() {
    const scores = JSON.parse(localStorage.getItem('tacticalDroneScores') || '[]');

    if (scores.length === 0) {
        alert('Aucun score enregistré pour le moment!');
        return;
    }

    let scoreHTML = '<h2 style="color: #ff5722;">🏆 MEILLEURS SCORES</h2>';
    scoreHTML += '<ol style="color: white; font-size: 18px;">';

    scores.forEach((score, index) => {
        const date = new Date(score.date).toLocaleDateString('fr-FR');
        const minutes = Math.floor(score.time / 60000);
        const seconds = Math.floor((score.time % 60000) / 1000);

        scoreHTML += `
            <li style="margin: 10px 0;">
                <strong>${score.score.toLocaleString()}</strong> points
                <br>
                <small>Difficulté: ${score.difficulty} | Temps: ${minutes}:${seconds.toString().padStart(2, '0')} | ${date}</small>
            </li>
        `;
    });

    scoreHTML += '</ol>';

    // Créer un modal pour afficher les scores
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #1a1a2e, #16213e);
        padding: 30px;
        border-radius: 15px;
        border: 2px solid #ff5722;
        z-index: 10001;
        max-height: 80vh;
        overflow-y: auto;
        min-width: 400px;
        box-shadow: 0 0 30px rgba(255, 87, 34, 0.5);
    `;

    modal.innerHTML = scoreHTML + `
        <button onclick="this.parentElement.remove()" style="
            margin-top: 20px;
            padding: 10px 30px;
            background: #ff5722;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
        ">FERMER</button>
    `;

    document.body.appendChild(modal);
}

// Système de paramètres
function showSettings() {
    const settingsHTML = `
        <div id="settingsModal" style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            padding: 30px;
            border-radius: 15px;
            border: 2px solid #ff5722;
            z-index: 10001;
            color: white;
            min-width: 400px;
            box-shadow: 0 0 30px rgba(255, 87, 34, 0.5);
        ">
            <h2 style="color: #ff5722; margin-bottom: 20px;">⚙️ PARAMÈTRES</h2>
            
            <div style="margin: 15px 0;">
                <label>Volume des effets sonores:</label>
                <input type="range" id="sfxVolume" min="0" max="100" value="50" 
                       style="width: 100%; margin-top: 5px;">
            </div>
            
            <div style="margin: 15px 0;">
                <label>Qualité graphique:</label>
                <select id="graphicsQuality" style="
                    width: 100%;
                    padding: 5px;
                    margin-top: 5px;
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    border: 1px solid #ff5722;
                    border-radius: 5px;
                ">
                    <option value="low">Basse</option>
                    <option value="medium" selected>Moyenne</option>
                    <option value="high">Haute</option>
                    <option value="ultra">Ultra</option>
                </select>
            </div>
            
            <div style="margin: 15px 0;">
                <label>
                    <input type="checkbox" id="particlesEnabled" checked>
                    Effets de particules
                </label>
            </div>
            
            <div style="margin: 15px 0;">
                <label>
                    <input type="checkbox" id="weatherEnabled" checked>
                    Effets météo
                </label>
            </div>
            
            <div style="margin: 15px 0;">
                <label>
                    <input type="checkbox" id="shadowsEnabled" checked>
                    Ombres dynamiques
                </label>
            </div>
            
            <div style="margin-top: 25px; display: flex; gap: 10px; justify-content: center;">
                <button onclick="saveSettings()" style="
                    padding: 10px 30px;
                    background: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                ">SAUVEGARDER</button>
                
                <button onclick="document.getElementById('settingsModal').remove()" style="
                    padding: 10px 30px;
                    background: #ff5722;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                ">ANNULER</button>
            </div>
        </div>
    `;

    const modal = document.createElement('div');
    modal.innerHTML = settingsHTML;
    document.body.appendChild(modal.firstElementChild);

    // Charger les paramètres sauvegardés
    loadSettings();
}

function saveSettings() {
    const settings = {
        sfxVolume: document.getElementById('sfxVolume').value,
        graphicsQuality: document.getElementById('graphicsQuality').value,
        particlesEnabled: document.getElementById('particlesEnabled').checked,
        weatherEnabled: document.getElementById('weatherEnabled').checked,
        shadowsEnabled: document.getElementById('shadowsEnabled').checked
    };

    localStorage.setItem('tacticalDroneSettings', JSON.stringify(settings));
    applySettings(settings);
    document.getElementById('settingsModal').remove();

    // Notification de sauvegarde
    showNotification('Paramètres sauvegardés!', 'success');
}

function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('tacticalDroneSettings') || '{}');

    if (document.getElementById('sfxVolume')) {
        document.getElementById('sfxVolume').value = settings.sfxVolume || 50;
    }
    if (document.getElementById('graphicsQuality')) {
        document.getElementById('graphicsQuality').value = settings.graphicsQuality || 'medium';
    }
    if (document.getElementById('particlesEnabled')) {
        document.getElementById('particlesEnabled').checked = settings.particlesEnabled !== false;
    }
    if (document.getElementById('weatherEnabled')) {
        document.getElementById('weatherEnabled').checked = settings.weatherEnabled !== false;
    }
    if (document.getElementById('shadowsEnabled')) {
        document.getElementById('shadowsEnabled').checked = settings.shadowsEnabled !== false;
    }
}

function applySettings(settings) {
    // Appliquer les paramètres graphiques
    if (typeof renderer !== 'undefined') {
        renderer.shadowMap.enabled = settings.shadowsEnabled !== false;

        // Qualité graphique
        switch(settings.graphicsQuality) {
            case 'low':
                renderer.setPixelRatio(0.5);
                break;
            case 'medium':
                renderer.setPixelRatio(1);
                break;
            case 'high':
                renderer.setPixelRatio(window.devicePixelRatio);
                break;
            case 'ultra':
                renderer.setPixelRatio(window.devicePixelRatio * 1.5);
                break;
        }
    }

    // Effets météo
    const weatherOverlay = document.querySelector('.weather-overlay');
    if (weatherOverlay) {
        weatherOverlay.style.display = settings.weatherEnabled !== false ? 'block' : 'none';
    }
}

// Système de notifications
function showNotification(message, type = 'info') {
    const colors = {
        info: '#2196F3',
        success: '#4CAF50',
        warning: '#FFC107',
        error: '#f44336'
    };

    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: ${colors[type]};
        color: white;
        padding: 20px 40px;
        border-radius: 10px;
        font-size: 18px;
        font-weight: bold;
        z-index: 10002;
        animation: notificationPulse 0.5s ease-out;
        box-shadow: 0 0 30px rgba(0, 0, 0, 0.5);
    `;

    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'notificationFade 0.5s ease-out forwards';
        setTimeout(() => notification.remove(), 500);
    }, 2000);
}

// Animations CSS supplémentaires
const additionalStyles = document.createElement('style');
additionalStyles.textContent = `
    @keyframes notificationPulse {
        0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
        50% { transform: translate(-50%, -50%) scale(1.1); }
        100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    }
    
    @keyframes notificationFade {
        from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        to { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
    }
    
    .achievement {
        position: fixed;
        top: 20px;
        right: -400px;
        background: linear-gradient(135deg, #FFD700, #FFA500);
        color: #333;
        padding: 15px 25px;
        border-radius: 10px;
        font-weight: bold;
        z-index: 10003;
        transition: right 0.5s ease-out;
        box-shadow: 0 0 20px rgba(255, 215, 0, 0.6);
    }
    
    .achievement.show {
        right: 20px;
    }
    
    .achievement-icon {
        font-size: 24px;
        margin-right: 10px;
    }
`;
document.head.appendChild(additionalStyles);

// Système d'achievements
const achievements = {
    firstBlood: { name: "Premier Sang", icon: "🎯", unlocked: false },
    comboMaster: { name: "Maître du Combo", icon: "⚡", unlocked: false, requirement: 10 },
    speedDemon: { name: "Démon de Vitesse", icon: "🏃", unlocked: false },
    perfectionist: { name: "Perfectionniste", icon: "💯", unlocked: false },
    destroyer: { name: "Destructeur", icon: "💥", unlocked: false }
};

function checkAchievements() {
    // Premier sang
    if (!achievements.firstBlood.unlocked && buildings.some(b => b.destroyed)) {
        unlockAchievement('firstBlood');
    }

    // Maître du combo
    if (!achievements.comboMaster.unlocked && combo >= 10) {
        unlockAchievement('comboMaster');
    }

    // Destructeur - tous les bâtiments détruits
    if (!achievements.destroyer.unlocked && buildings.every(b => b.destroyed)) {
        unlockAchievement('destroyer');
    }
}

function unlockAchievement(achievementId) {
    const achievement = achievements[achievementId];
    if (achievement.unlocked) return;

    achievement.unlocked = true;

    const achievementDiv = document.createElement('div');
    achievementDiv.className = 'achievement';
    achievementDiv.innerHTML = `
        <span class="achievement-icon">${achievement.icon}</span>
        <span>Achievement Débloqué!</span><br>
        <strong>${achievement.name}</strong>
    `;

    document.body.appendChild(achievementDiv);

    setTimeout(() => {
        achievementDiv.classList.add('show');
    }, 100);

    setTimeout(() => {
        achievementDiv.classList.remove('show');
        setTimeout(() => achievementDiv.remove(), 500);
    }, 3000);

    // Bonus de score
    score += 1000;

    // Sauvegarder les achievements
    localStorage.setItem('tacticalDroneAchievements', JSON.stringify(achievements));
}

// Contrôles clavier améliorés
document.addEventListener('keydown', (e) => {
    if (!gameRunning) return;

    switch(e.key.toLowerCase()) {
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
            const droneIndex = parseInt(e.key) - 1;
            if (drones[droneIndex]) {
                selectDrone(droneIndex);
            }
            break;

        case 'q':
            setFormation('diamond');
            break;

        case 'w':
            setFormation('line');
            break;

        case 'e':
            setFormation('circle');
            break;

        case ' ':
        case 'space':
            e.preventDefault();
            executeCoordinatedStrike();
            break;

        case 'r':
            spawnReinforcements();
            break;

        case 'u':
            if (ultimateReady) {
                activateUltimate();
            }
            break;

        case 'escape':
            togglePause();
            break;

        case 'tab':
            e.preventDefault();
            toggleMinimap();
            break;

        case 'm':
            toggleMusic();
            break;

        case 'h':
            showHelp();
            break;
    }
});

// Sélection de drone
function selectDrone(index) {
    if (drones[index]) {
        // Effet visuel de sélection
        drones.forEach((drone, i) => {
            if (drone.mesh) {
                drone.mesh.scale.set(i === index ? 1.2 : 1, i === index ? 1.2 : 1, i === index ? 1.2 : 1);
            }
        });

        // Suivre le drone sélectionné avec la caméra
        const selectedDrone = drones[index];
        if (mainCamera && selectedDrone.position) {
            const offset = new THREE.Vector3(100, 100, 100);
            mainCamera.position.lerp(
                selectedDrone.position.clone().add(offset),
                0.1
            );
            mainCamera.lookAt(selectedDrone.position);
        }

        showNotification(`Drone ${index + 1} sélectionné`, 'info');
    }
}

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
        <button onclick="restartMission()" style="
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
        <button onclick="quitToMenu()" style="
            margin: 10px;
            padding: 15px 40px;
            background: #9C27B0;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 18px;
            font-weight: bold;
        ">MENU PRINCIPAL</button>
    `;

    document.body.appendChild(pauseMenu);
}

function hidePauseMenu() {
    const pauseMenu = document.getElementById('pauseMenu');
    if (pauseMenu) {
        pauseMenu.remove();
    }

    if (gameRunning) {
        animate();
    }
}

function restartMission() {
    hidePauseMenu();
    location.reload(); // Simple reload pour recommencer
}

function quitToMenu() {
    hidePauseMenu();
    gameRunning = false;
    document.getElementById('hud').style.display = 'none';
    document.getElementById('tacticalControls').style.display = 'none';
    document.getElementById('mainMenu').style.display = 'flex';

    // Nettoyer la scène
    if (scene) {
        while(scene.children.length > 0) {
            scene.remove(scene.children[0]);
        }
    }
}

// Toggle minimap
function toggleMinimap() {
    const minimap = document.getElementById('minimap');
    if (minimap) {
        minimap.style.display = minimap.style.display === 'none' ? 'block' : 'none';
    }
}

// Musique (placeholder)
let musicEnabled = true;

function toggleMusic() {
    musicEnabled = !musicEnabled;
    showNotification(musicEnabled ? 'Musique activée' : 'Musique désactivée', 'info');
    // Ici vous pourriez ajouter la gestion audio réelle
}

// Aide
function showHelp() {
    const helpHTML = `
        <div style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            padding: 30px;
            border-radius: 15px;
            border: 2px solid #ff5722;
            z-index: 10001;
            color: white;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 0 30px rgba(255, 87, 34, 0.5);
        ">
            <h2 style="color: #ff5722; margin-bottom: 20px;">📖 AIDE & CONTRÔLES</h2>
            
            <div style="margin-bottom: 20px;">
                <h3 style="color: #FFC107;">Contrôles Clavier:</h3>
                <ul style="list-style: none; padding: 0;">
                    <li>1-6 : Sélectionner un drone</li>
                    <li>Q : Formation Diamant</li>
                    <li>W : Formation Ligne</li>
                    <li>E : Formation Cercle</li>
                    <li>ESPACE : Frappe Coordonnée</li>
                    <li>R : Appeler des Renforts</li>
                    <li>U : Activer l'Ultimate</li>
                    <li>TAB : Afficher/Masquer Minimap</li>
                    <li>ESC : Pause</li>
                    <li>M : Musique On/Off</li>
                    <li>H : Afficher cette aide</li>
                </ul>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h3 style="color: #FFC107;">Objectifs:</h3>
                <ul>
                    <li>Détruire tous les bâtiments ennemis</li>
                    <li>Maximiser votre score avec des combos</li>
                    <li>Utiliser les formations tactiques</li>
                    <li>Collecter les power-ups</li>
                </ul>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h3 style="color: #FFC107;">Types de Bâtiments:</h3>
                <ul>
                    <li>🏢 Normal : 100 HP</li>
                    <li>🏛️ Blindé : 200 HP (gris foncé)</li>
                    <li>🛡️ Bouclier : 150 HP (bleu)</li>
                </ul>
            </div>
            
            <button onclick="this.parentElement.remove()" style="
                margin-top: 20px;
                padding: 10px 30px;
                background: #ff5722;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
            ">FERMER</button>
        </div>
    `;

    const helpDiv = document.createElement('div');
    helpDiv.innerHTML = helpHTML;
    document.body.appendChild(helpDiv.firstElementChild);
}

// Initialisation au chargement
window.addEventListener('DOMContentLoaded', () => {
    // Masquer l'écran de chargement après 2 secondes
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                document.getElementById('mainMenu').style.display = 'flex';
            }, 1000);
        }
    }, 2000);

    // Charger les achievements sauvegardés
    const savedAchievements = localStorage.getItem('tacticalDroneAchievements');
    if (savedAchievements) {
        Object.assign(achievements, JSON.parse(savedAchievements));
    }

    // Charger et appliquer les paramètres
    const savedSettings = localStorage.getItem('tacticalDroneSettings');
    if (savedSettings) {
        applySettings(JSON.parse(savedSettings));
    }

    console.log('🚁 TacticalDrone Enhanced - Système chargé');
    console.log('📌 Appuyez sur H en jeu pour l\'aide');
});

// Export des fonctions pour utilisation globale
window.enhancedGame = {
    showHighScores,
    showSettings,
    saveSettings,
    loadSettings,
    applySettings,
    showNotification,
    checkAchievements,
    unlockAchievement,
    selectDrone,
    togglePause,
    toggleMinimap,
    toggleMusic,
    showHelp,
    restartMission,
    quitToMenu
};

console.log('✅ Enhanced Game Scripts Loaded');