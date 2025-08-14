// ==========================================
// gameRapport.js - SYSTÈME DE RAPPORT DE MISSION
// ==========================================

// Configuration pour 25 immeubles
const TOTAL_BUILDINGS = 25;

// Variables pour les statistiques de combat
let combatStats = {
    totalMissilesFired: 0,
    totalHits: 0,
    totalDamageDealt: 0,
    buildingsDestroyed: [],
    dronePerformance: {},
    formations: {
        diamond: 0,
        line: 0,
        circle: 0,
        free: 0
    },
    coordinatedStrikes: 0,
    missionComplete: false
};

let missionEndTime = null;

// Mise à jour de la configuration dans le fichier principal
window.addEventListener('DOMContentLoaded', () => {
    // Mettre à jour le compteur total d'immeubles
    const totalTargetsElement = document.getElementById('totalTargets');
    if (totalTargetsElement) {
        totalTargetsElement.textContent = TOTAL_BUILDINGS;
    }

    // Ajouter le bouton de rapport au panneau de contrôle
    const tacticalControls = document.getElementById('tacticalControls');
    if (tacticalControls) {
        const reportBtn = document.createElement('button');
        reportBtn.className = 'tactical-btn success';
        reportBtn.style.display = 'none';
        reportBtn.id = 'reportBtn';
        reportBtn.textContent = '📊 Rapport Mission';
        reportBtn.onclick = generateReport;
        tacticalControls.appendChild(reportBtn);
    }

    // Ajouter le modal de rapport au body
    const reportModal = document.createElement('div');
    reportModal.id = 'reportModal';
    reportModal.style.cssText = `
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        z-index: 2000;
        justify-content: center;
        align-items: center;
    `;

    reportModal.innerHTML = `
        <div id="reportContent" style="
            background: white;
            padding: 40px;
            border-radius: 10px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            color: #333;
        ">
            <h2 style="color: #ff5722; margin-bottom: 20px; text-align: center; font-size: 28px;">
                📋 RAPPORT DE MISSION
            </h2>
            <div id="reportBody"></div>
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                <button onclick="downloadPDF()" style="
                    padding: 12px 24px;
                    background: #ff5722;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                ">📥 Télécharger PDF</button>
                <button onclick="closeReport()" style="
                    padding: 12px 24px;
                    background: #ff5722;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                ">❌ Fermer</button>
            </div>
        </div>
    `;

    document.body.appendChild(reportModal);
});

// Fonction pour initialiser les statistiques des drones
function initializeDroneStats(droneId) {
    if (!combatStats.dronePerformance[`Drone-${droneId}`]) {
        combatStats.dronePerformance[`Drone-${droneId}`] = {
            missilesFired: 0,
            hits: 0,
            damageDealt: 0,
            buildingsDestroyed: 0,
            distanceTraveled: 0,
            timeInCombat: 0
        };
    }
}

// Fonction pour enregistrer une destruction
function recordBuildingDestruction(buildingId, destroyerId, damageTotal) {
    combatStats.buildingsDestroyed.push({
        id: buildingId,
        destroyedBy: destroyerId,
        time: Date.now() - missionStartTime,
        totalDamage: damageTotal
    });
}

// Fonction pour enregistrer un tir de missile
function recordMissileFired(droneId) {
    combatStats.totalMissilesFired++;
    if (combatStats.dronePerformance[`Drone-${droneId}`]) {
        combatStats.dronePerformance[`Drone-${droneId}`].missilesFired++;
    }
}

// Fonction pour enregistrer un impact
function recordHit(droneId, damage) {
    combatStats.totalHits++;
    combatStats.totalDamageDealt += damage;

    if (combatStats.dronePerformance[`Drone-${droneId}`]) {
        combatStats.dronePerformance[`Drone-${droneId}`].hits++;
        combatStats.dronePerformance[`Drone-${droneId}`].damageDealt += damage;
    }
}

// Fonction pour enregistrer l'utilisation d'une formation
function recordFormationUse(formationType) {
    if (combatStats.formations[formationType] !== undefined) {
        combatStats.formations[formationType]++;
    }
}

// Fonction pour enregistrer une frappe coordonnée
function recordCoordinatedStrike() {
    combatStats.coordinatedStrikes++;
}

// Vérification de victoire avec 25 immeubles
function checkMissionComplete() {
    if (combatStats.buildingsDestroyed.length >= TOTAL_BUILDINGS) {
        missionEndTime = Date.now();
        combatStats.missionComplete = true;

        // Afficher le bouton de rapport
        const reportBtn = document.getElementById('reportBtn');
        if (reportBtn) {
            reportBtn.style.display = 'block';
        }

        // Mettre à jour le statut
        const missionStatus = document.getElementById('missionStatus');
        if (missionStatus) {
            missionStatus.textContent = 'ACCOMPLIE';
            missionStatus.style.color = '#4CAF50';
        }

        return true;
    }
    return false;
}

// Générer le rapport de mission HTML
function generateReport() {
    if (!missionEndTime) {
        missionEndTime = Date.now();
    }

    const totalTime = missionEndTime - missionStartTime;
    const minutes = Math.floor(totalTime / 60000);
    const seconds = Math.floor((totalTime % 60000) / 1000);

    let reportHTML = `
        <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px;">
            <h3 style="color: #333; margin-bottom: 10px; border-bottom: 2px solid #ff5722; padding-bottom: 5px;">
                📊 RÉSUMÉ DE MISSION
            </h3>
            <div style="display: flex; justify-content: space-between; margin: 8px 0; padding: 5px; background: white; border-radius: 3px;">
                <span>Statut:</span>
                <span style="color: #4CAF50; font-weight: bold;">SUCCÈS</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 8px 0; padding: 5px; background: white; border-radius: 3px;">
                <span>Durée totale:</span>
                <span>${minutes}m ${seconds}s</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 8px 0; padding: 5px; background: white; border-radius: 3px;">
                <span>Cibles neutralisées:</span>
                <span>${combatStats.buildingsDestroyed.length} / ${TOTAL_BUILDINGS}</span>
            </div>
        </div>
        
        <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px;">
            <h3 style="color: #333; margin-bottom: 10px; border-bottom: 2px solid #ff5722; padding-bottom: 5px;">
                🎯 STATISTIQUES DE COMBAT
            </h3>
            <div style="display: flex; justify-content: space-between; margin: 8px 0; padding: 5px; background: white; border-radius: 3px;">
                <span>Missiles tirés:</span>
                <span>${combatStats.totalMissilesFired}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 8px 0; padding: 5px; background: white; border-radius: 3px;">
                <span>Impacts réussis:</span>
                <span>${combatStats.totalHits}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 8px 0; padding: 5px; background: white; border-radius: 3px;">
                <span>Précision:</span>
                <span>${combatStats.totalMissilesFired > 0 ? Math.round((combatStats.totalHits / combatStats.totalMissilesFired) * 100) : 0}%</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 8px 0; padding: 5px; background: white; border-radius: 3px;">
                <span>Dégâts totaux:</span>
                <span>${combatStats.totalDamageDealt}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 8px 0; padding: 5px; background: white; border-radius: 3px;">
                <span>Frappes coordonnées:</span>
                <span>${combatStats.coordinatedStrikes}</span>
            </div>
        </div>
        
        <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px;">
            <h3 style="color: #333; margin-bottom: 10px; border-bottom: 2px solid #ff5722; padding-bottom: 5px;">
                🚁 PERFORMANCE DES DRONES
            </h3>`;

    // Ajouter les performances de chaque drone
    Object.entries(combatStats.dronePerformance).forEach(([droneId, stats]) => {
        const accuracy = stats.missilesFired > 0 ?
            Math.round((stats.hits / stats.missilesFired) * 100) : 0;

        reportHTML += `
            <div style="margin-bottom: 15px; padding: 10px; background: white; border-left: 4px solid #ff5722;">
                <strong>${droneId}</strong>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 5px; font-size: 12px;">
                    <div>Missiles: ${stats.missilesFired}</div>
                    <div>Précision: ${accuracy}%</div>
                    <div>Dégâts: ${stats.damageDealt}</div>
                    <div>Cibles détruites: ${stats.buildingsDestroyed}</div>
                    <div>Distance: ${Math.round(stats.distanceTraveled)}m</div>
                    <div>Temps combat: ${Math.round(stats.timeInCombat / 1000)}s</div>
                </div>
            </div>`;
    });

    reportHTML += `
        </div>
        
        <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px;">
            <h3 style="color: #333; margin-bottom: 10px; border-bottom: 2px solid #ff5722; padding-bottom: 5px;">
                ⚔️ TACTIQUES UTILISÉES
            </h3>
            <div style="display: flex; justify-content: space-between; margin: 8px 0; padding: 5px; background: white; border-radius: 3px;">
                <span>Formation Diamant:</span>
                <span>${combatStats.formations.diamond} fois</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 8px 0; padding: 5px; background: white; border-radius: 3px;">
                <span>Formation Ligne:</span>
                <span>${combatStats.formations.line} fois</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 8px 0; padding: 5px; background: white; border-radius: 3px;">
                <span>Formation Cercle:</span>
                <span>${combatStats.formations.circle} fois</span>
            </div>
        </div>
    `;

    document.getElementById('reportBody').innerHTML = reportHTML;
    document.getElementById('reportModal').style.display = 'flex';
}

// Télécharger le PDF (nécessite jsPDF)
function downloadPDF() {
    // Vérifier si jsPDF est chargé
    if (typeof window.jspdf === 'undefined') {
        // Charger jsPDF dynamiquement si pas déjà chargé
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = () => {
            generatePDFReport();
        };
        document.head.appendChild(script);
    } else {
        generatePDFReport();
    }
}

// Générer le rapport PDF
function generatePDFReport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const totalTime = missionEndTime - missionStartTime;
    const minutes = Math.floor(totalTime / 60000);
    const seconds = Math.floor((totalTime % 60000) / 1000);

    // Configuration des couleurs
    const primaryColor = [255, 87, 34];
    const secondaryColor = [244, 67, 54];
    const successColor = [76, 175, 80];

    // PAGE 1 - En-tête et résumé
    doc.setFontSize(24);
    doc.setTextColor(...primaryColor);
    doc.text('RAPPORT DE MISSION TACTIQUE', 105, 25, { align: 'center' });

    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text('OPÉRATION URBAN STRIKE', 105, 35, { align: 'center' });
    doc.text(`25 CIBLES À NEUTRALISER`, 105, 42, { align: 'center' });

    // Informations de base
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 20, 55);
    doc.text(`Heure de début: ${new Date(missionStartTime).toLocaleTimeString('fr-FR')}`, 20, 61);
    if (missionEndTime) {
        doc.text(`Heure de fin: ${new Date(missionEndTime).toLocaleTimeString('fr-FR')}`, 20, 67);
    }
    doc.text(`Classification: CONFIDENTIEL`, 150, 55);

    // Ligne de séparation
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(20, 75, 190, 75);

    // Résumé exécutif
    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.text('RÉSUMÉ EXÉCUTIF', 20, 85);

    // Cadre de statut
    const statusColor = combatStats.buildingsDestroyed.length >= TOTAL_BUILDINGS ? successColor : secondaryColor;
    doc.setDrawColor(...statusColor);
    doc.setFillColor(...statusColor);
    doc.rect(20, 90, 170, 20, 'FD');

    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    const statusText = combatStats.buildingsDestroyed.length >= TOTAL_BUILDINGS ?
        'MISSION ACCOMPLIE AVEC SUCCÈS' :
        `MISSION EN COURS - ${combatStats.buildingsDestroyed.length}/${TOTAL_BUILDINGS} CIBLES`;
    doc.text(statusText, 105, 102, { align: 'center' });

    // Statistiques principales
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);

    let yPos = 120;
    doc.text(`• Durée totale de la mission: ${minutes} minutes ${seconds} secondes`, 25, yPos);
    yPos += 7;
    doc.text(`• Nombre de cibles neutralisées: ${combatStats.buildingsDestroyed.length} / ${TOTAL_BUILDINGS}`, 25, yPos);
    yPos += 7;
    doc.text(`• Taux de réussite: ${Math.round((combatStats.buildingsDestroyed.length / TOTAL_BUILDINGS) * 100)}%`, 25, yPos);
    yPos += 7;
    doc.text(`• Drones déployés: 4 unités tactiques`, 25, yPos);
    yPos += 7;
    doc.text(`• Munitions utilisées: ${combatStats.totalMissilesFired} missiles`, 25, yPos);
    yPos += 7;
    doc.text(`• Précision globale: ${combatStats.totalMissilesFired > 0 ? Math.round((combatStats.totalHits / combatStats.totalMissilesFired) * 100) : 0}%`, 25, yPos);

    // Statistiques de combat
    yPos = 165;
    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.text('STATISTIQUES DE COMBAT', 20, yPos);

    yPos += 10;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    // Tableau simple de statistiques
    const stats = [
        ['Missiles tirés', combatStats.totalMissilesFired],
        ['Impacts réussis', combatStats.totalHits],
        ['Dégâts totaux', combatStats.totalDamageDealt],
        ['Frappes coordonnées', combatStats.coordinatedStrikes]
    ];

    stats.forEach(([label, value], index) => {
        doc.text(`${label}: ${value}`, 25, yPos + (index * 7));
    });

    // Formations utilisées
    yPos = 210;
    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.text('FORMATIONS TACTIQUES', 20, yPos);

    yPos += 10;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    Object.entries(combatStats.formations).forEach(([formation, count], index) => {
        doc.text(`${formation.charAt(0).toUpperCase() + formation.slice(1)}: ${count} utilisations`, 25, yPos + (index * 7));
    });

    // PAGE 2 - Performance des drones
    doc.addPage();

    doc.setFontSize(20);
    doc.setTextColor(...primaryColor);
    doc.text('PERFORMANCE DES DRONES', 105, 20, { align: 'center' });

    doc.setLineWidth(0.5);
    doc.line(20, 25, 190, 25);

    yPos = 35;

    Object.entries(combatStats.dronePerformance).forEach(([droneId, stats], index) => {
        if (yPos > 250) {
            doc.addPage();
            yPos = 30;
        }

        // En-tête du drone
        doc.setFillColor(...primaryColor);
        doc.rect(20, yPos, 170, 8, 'F');

        doc.setFontSize(12);
        doc.setTextColor(255, 255, 255);
        doc.text(`${droneId} - UNITÉ TACTIQUE`, 25, yPos + 6);

        yPos += 12;

        // Statistiques du drone
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);

        const accuracy = stats.missilesFired > 0 ?
            Math.round((stats.hits / stats.missilesFired) * 100) : 0;

        doc.text(`Missiles tirés: ${stats.missilesFired}`, 25, yPos);
        doc.text(`Précision: ${accuracy}%`, 110, yPos);
        yPos += 6;

        doc.text(`Impacts réussis: ${stats.hits}`, 25, yPos);
        doc.text(`Dégâts infligés: ${stats.damageDealt}`, 110, yPos);
        yPos += 6;

        doc.text(`Bâtiments détruits: ${stats.buildingsDestroyed}`, 25, yPos);
        doc.text(`Distance parcourue: ${Math.round(stats.distanceTraveled)}m`, 110, yPos);

        yPos += 12;
    });

    // PAGE 3 - Analyse finale
    doc.addPage();

    doc.setFontSize(20);
    doc.setTextColor(...primaryColor);
    doc.text('ANALYSE ET RECOMMANDATIONS', 105, 20, { align: 'center' });

    doc.setLineWidth(0.5);
    doc.line(20, 25, 190, 25);

    yPos = 40;

    // Points forts
    doc.setFontSize(14);
    doc.setTextColor(...successColor);
    doc.text('POINTS FORTS', 20, yPos);

    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    const strengths = generateStrengths();
    strengths.forEach(strength => {
        if (yPos > 270) {
            doc.addPage();
            yPos = 30;
        }
        doc.text(`• ${strength}`, 25, yPos);
        yPos += 6;
    });

    yPos += 10;

    // Points d'amélioration
    doc.setFontSize(14);
    doc.setTextColor(...secondaryColor);
    doc.text('AXES D\'AMÉLIORATION', 20, yPos);

    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    const improvements = generateImprovements();
    improvements.forEach(improvement => {
        if (yPos > 270) {
            doc.addPage();
            yPos = 30;
        }
        doc.text(`• ${improvement}`, 25, yPos);
        yPos += 6;
    });

    // Score global
    yPos += 10;
    const globalScore = calculateGlobalScore();

    doc.setFontSize(14);
    doc.setTextColor(...primaryColor);
    doc.text('ÉVALUATION GLOBALE', 20, yPos);

    yPos += 10;
    doc.setFontSize(18);
    doc.setTextColor(...getScoreColor(globalScore));
    doc.text(`SCORE DE MISSION: ${globalScore}/100`, 105, yPos, { align: 'center' });

    doc.setFontSize(12);
    doc.text(getScoreGrade(globalScore), 105, yPos + 10, { align: 'center' });

    // Signature
    yPos = 260;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Rapport généré automatiquement', 20, yPos);
    doc.text(`${new Date().toLocaleString('fr-FR')}`, 20, yPos + 5);
    doc.text('Système TacticalDrone v1.0', 150, yPos);

    // Sauvegarder le PDF
    doc.save(`Rapport_Mission_${new Date().getTime()}.pdf`);
}

// Fonctions auxiliaires pour l'analyse
function generateStrengths() {
    const strengths = [];

    const accuracy = combatStats.totalMissilesFired > 0 ?
        combatStats.totalHits / combatStats.totalMissilesFired : 0;

    if (accuracy >= 0.7) {
        strengths.push(`Excellente précision de tir (${Math.round(accuracy * 100)}%)`);
    }

    if (combatStats.coordinatedStrikes >= 3) {
        strengths.push(`Utilisation efficace des frappes coordonnées (${combatStats.coordinatedStrikes} exécutées)`);
    }

    const totalTime = missionEndTime ? missionEndTime - missionStartTime : Date.now() - missionStartTime;
    const minutes = Math.floor(totalTime / 60000);
    if (minutes < 5 && combatStats.buildingsDestroyed.length >= TOTAL_BUILDINGS) {
        strengths.push(`Mission accomplie rapidement (${minutes} minutes)`);
    }

    if (combatStats.buildingsDestroyed.length === TOTAL_BUILDINGS) {
        strengths.push('Taux de réussite de 100% sur les 25 cibles');
    }

    const avgDamagePerMissile = combatStats.totalMissilesFired > 0 ?
        combatStats.totalDamageDealt / combatStats.totalMissilesFired : 0;
    if (avgDamagePerMissile >= 20) {
        strengths.push(`Efficacité des munitions optimale (${Math.round(avgDamagePerMissile)} dégâts/missile)`);
    }

    return strengths.length > 0 ? strengths : ['Mission accomplie selon les paramètres standard'];
}

function generateImprovements() {
    const improvements = [];

    const accuracy = combatStats.totalMissilesFired > 0 ?
        combatStats.totalHits / combatStats.totalMissilesFired : 0;

    if (accuracy < 0.6) {
        improvements.push(`Améliorer la précision de tir (actuellement ${Math.round(accuracy * 100)}%)`);
    }

    if (combatStats.coordinatedStrikes < 2) {
        improvements.push('Augmenter l\'utilisation des frappes coordonnées pour plus d\'efficacité');
    }

    const totalFormations = Object.values(combatStats.formations).reduce((a, b) => a + b, 0);
    if (totalFormations < 5) {
        improvements.push('Utiliser davantage les formations tactiques');
    }

    if (combatStats.buildingsDestroyed.length < TOTAL_BUILDINGS) {
        const remaining = TOTAL_BUILDINGS - combatStats.buildingsDestroyed.length;
        improvements.push(`Neutraliser les ${remaining} cibles restantes`);
    }

    return improvements.length > 0 ? improvements : ['Maintenir le niveau de performance actuel'];
}

function calculateGlobalScore() {
    let score = 0;

    // Score basé sur le taux de réussite (40 points max)
    const successRate = combatStats.buildingsDestroyed.length / TOTAL_BUILDINGS;
    score += successRate * 40;

    // Score basé sur la précision (30 points max)
    const accuracy = combatStats.totalMissilesFired > 0 ?
        combatStats.totalHits / combatStats.totalMissilesFired : 0;
    score += accuracy * 30;

    // Score basé sur le temps (15 points max)
    const totalTime = missionEndTime ? missionEndTime - missionStartTime : Date.now() - missionStartTime;
    const minutes = Math.floor(totalTime / 60000);
    if (minutes <= 3) score += 15;
    else if (minutes <= 5) score += 10;
    else if (minutes <= 8) score += 5;

    // Score basé sur l'efficacité tactique (15 points max)
    if (combatStats.coordinatedStrikes >= 3) score += 5;
    const formationUse = Object.values(combatStats.formations).reduce((a, b) => a + b, 0);
    if (formationUse >= 5) score += 5;

    // Bonus pour mission parfaite
    if (successRate === 1 && accuracy >= 0.8) score += 5;

    return Math.min(100, Math.round(score));
}

function getScoreColor(score) {
    if (score >= 90) return [76, 175, 80];   // Vert
    if (score >= 75) return [255, 193, 7];   // Jaune
    if (score >= 60) return [255, 152, 0];   // Orange
    return [244, 67, 54];                     // Rouge
}

function getScoreGrade(score) {
    if (score >= 95) return 'PERFORMANCE EXCEPTIONNELLE';
    if (score >= 85) return 'EXCELLENCE OPÉRATIONNELLE';
    if (score >= 75) return 'MISSION TRÈS RÉUSSIE';
    if (score >= 65) return 'OBJECTIFS ATTEINTS';
    if (score >= 50) return 'PERFORMANCE ACCEPTABLE';
    return 'AMÉLIORATION NÉCESSAIRE';
}

// Fonction pour fermer le modal de rapport
function closeReport() {
    const modal = document.getElementById('reportModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Export des fonctions pour utilisation dans le fichier principal
window.gameRapport = {
    initializeDroneStats,
    recordBuildingDestruction,
    recordMissileFired,
    recordHit,
    recordFormationUse,
    recordCoordinatedStrike,
    checkMissionComplete,
    generateReport,
    downloadPDF,
    closeReport,
    combatStats,
    TOTAL_BUILDINGS
};

console.log('📊 Système de rapport chargé - 25 immeubles configurés');