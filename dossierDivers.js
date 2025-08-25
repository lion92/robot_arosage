const fs = require('fs');
const path = require('path');
const os = require('os');

// Chemin du bureau (compatible Windows, Mac, Linux)
const desktopPath = path.join(os.homedir(), 'Desktop');

// Fonction pour déplacer un dossier avec tout son contenu
async function deplacerDossier(source, destination) {
    // Créer le dossier de destination s'il n'existe pas
    await fs.promises.mkdir(destination, { recursive: true });

    // Lire le contenu du dossier source
    const elements = await fs.promises.readdir(source);

    // Copier chaque élément
    for (const element of elements) {
        const sourcePath = path.join(source, element);
        const destPath = path.join(destination, element);

        const stats = await fs.promises.stat(sourcePath);

        if (stats.isDirectory()) {
            // Récursivement copier les sous-dossiers
            await deplacerDossier(sourcePath, destPath);
        } else {
            // Copier les fichiers
            await fs.promises.copyFile(sourcePath, destPath);
        }
    }

    // Supprimer le dossier source après la copie
    await fs.promises.rm(source, { recursive: true, force: true });
}

// Fonction principale pour organiser les dossiers du bureau
async function organiserDossiers() {
    try {
        console.log('🚀 Début de l\'organisation des dossiers du bureau...');
        console.log(`📁 Chemin du bureau: ${desktopPath}`);
        console.log('');

        // Lire tous les éléments du bureau
        const elements = await fs.promises.readdir(desktopPath);

        let dossiersTraites = 0;
        let dossiersConteneursCrees = new Set();
        let dossiersIgnores = [];

        for (const element of elements) {
            const cheminComplet = path.join(desktopPath, element);
            const stats = await fs.promises.stat(cheminComplet);

            // Traiter seulement les dossiers
            if (stats.isDirectory()) {
                const premiereLettreOriginale = element[0];
                const premiereLettre = premiereLettreOriginale.toUpperCase();

                // Ignorer les dossiers de regroupement déjà créés (A, B, C, etc.) et Divers
                if ((element.length === 1 && /^[A-Z]$/.test(element)) || element === 'Divers') {
                    dossiersIgnores.push(element);
                    continue;
                }

                let dossierConteneur;

                // Déterminer le dossier conteneur
                if (/^[A-Z]$/i.test(premiereLettreOriginale)) {
                    // Si commence par une lettre (A-Z ou a-z) → dossier avec cette lettre en majuscule
                    dossierConteneur = premiereLettre;
                } else {
                    // Sinon (chiffre, caractère spécial, etc.) → dossier Divers
                    dossierConteneur = 'Divers';
                }

                const cheminDossierConteneur = path.join(desktopPath, dossierConteneur);

                // Créer le dossier conteneur s'il n'existe pas
                if (!fs.existsSync(cheminDossierConteneur)) {
                    await fs.promises.mkdir(cheminDossierConteneur, { recursive: true });
                    dossiersConteneursCrees.add(dossierConteneur);
                    console.log(`✅ Dossier conteneur créé: ${dossierConteneur}/`);
                }

                // Nouveau chemin pour le dossier à déplacer
                let nouveauChemin = path.join(cheminDossierConteneur, element);

                // Gérer les conflits de noms
                let cheminFinal = nouveauChemin;
                let compteur = 1;

                while (fs.existsSync(cheminFinal)) {
                    cheminFinal = path.join(cheminDossierConteneur, `${element}_${compteur}`);
                    compteur++;
                }

                // Déplacer le dossier avec tout son contenu
                console.log(`📂 Déplacement: ${element} → ${dossierConteneur}/${path.basename(cheminFinal)}`);
                await deplacerDossier(cheminComplet, cheminFinal);
                dossiersTraites++;
            }
        }

        // Résumé final
        console.log('\n' + '='.repeat(60));
        console.log('✨ Organisation des dossiers terminée avec succès!');
        console.log(`📊 Statistiques:`);
        console.log(`   - Dossiers déplacés: ${dossiersTraites}`);
        console.log(`   - Dossiers conteneurs créés: ${dossiersConteneursCrees.size}`);
        if (dossiersConteneursCrees.size > 0) {
            console.log(`   - Liste des conteneurs créés: ${Array.from(dossiersConteneursCrees).join(', ')}`);
        }
        if (dossiersIgnores.length > 0) {
            console.log(`   - Dossiers ignorés (déjà organisés): ${dossiersIgnores.join(', ')}`);
        }
        console.log('='.repeat(60));

    } catch (erreur) {
        console.error('❌ Erreur lors de l\'organisation des dossiers:', erreur.message);
        process.exit(1);
    }
}

// Mode simulation pour voir ce qui sera fait
async function simulerOrganisation() {
    try {
        console.log('🔍 MODE SIMULATION - Aucun dossier ne sera déplacé');
        console.log(`📁 Analyse du bureau: ${desktopPath}\n`);

        const elements = await fs.promises.readdir(desktopPath);
        const organisation = {};
        let totalDossiers = 0;
        let dossiersIgnores = [];

        for (const element of elements) {
            const cheminComplet = path.join(desktopPath, element);
            const stats = await fs.promises.stat(cheminComplet);

            if (stats.isDirectory()) {
                const premiereLettreOriginale = element[0];
                const premiereLettre = premiereLettreOriginale.toUpperCase();

                // Ignorer les dossiers de regroupement existants
                if ((element.length === 1 && /^[A-Z]$/.test(element)) || element === 'Divers') {
                    dossiersIgnores.push(element);
                    continue;
                }

                let dossierConteneur;

                if (/^[A-Z]$/i.test(premiereLettreOriginale)) {
                    dossierConteneur = premiereLettre;
                } else {
                    dossierConteneur = 'Divers';
                }

                if (!organisation[dossierConteneur]) {
                    organisation[dossierConteneur] = [];
                }
                organisation[dossierConteneur].push(element);
                totalDossiers++;
            }
        }

        console.log('📋 Résultat de la simulation:\n');

        // Afficher les dossiers par lettre (ordre alphabétique)
        const conteneurs = Object.keys(organisation).sort((a, b) => {
            // Mettre "Divers" à la fin
            if (a === 'Divers') return 1;
            if (b === 'Divers') return -1;
            return a.localeCompare(b);
        });

        for (const conteneur of conteneurs) {
            console.log(`📁 ${conteneur}/`);
            organisation[conteneur].sort().forEach(d => console.log(`   └─ 📂 ${d}`));
            console.log('');
        }

        console.log('='.repeat(60));
        console.log(`Total: ${totalDossiers} dossiers à organiser`);
        if (dossiersIgnores.length > 0) {
            console.log(`Dossiers ignorés (déjà organisés): ${dossiersIgnores.join(', ')}`);
        }

    } catch (erreur) {
        console.error('❌ Erreur lors de la simulation:', erreur.message);
    }
}

// Fonction pour lister le contenu actuel du bureau
async function listerBureau() {
    try {
        console.log(`📁 Contenu actuel du bureau:\n`);

        const elements = await fs.promises.readdir(desktopPath);
        let dossiers = [];
        let fichiers = [];

        for (const element of elements) {
            const cheminComplet = path.join(desktopPath, element);
            const stats = await fs.promises.stat(cheminComplet);

            if (stats.isDirectory()) {
                dossiers.push(element);
            } else {
                fichiers.push(element);
            }
        }

        if (dossiers.length > 0) {
            console.log('📂 DOSSIERS:');
            dossiers.sort().forEach(d => console.log(`   └─ ${d}/`));
            console.log('');
        }

        if (fichiers.length > 0) {
            console.log('📄 FICHIERS:');
            fichiers.sort().forEach(f => console.log(`   └─ ${f}`));
        }

        console.log('\n' + '='.repeat(60));
        console.log(`Total: ${dossiers.length} dossiers, ${fichiers.length} fichiers`);

    } catch (erreur) {
        console.error('❌ Erreur lors du listage:', erreur.message);
    }
}

// Menu principal
async function menu() {
    console.log('\n🗂️  ORGANISATEUR DE DOSSIERS DU BUREAU\n');
    console.log('Ce programme organise les dossiers de votre bureau :');
    console.log('• Dossiers commençant par une lettre → Dossier A-Z');
    console.log('• Tous les autres (chiffres, caractères spéciaux) → Dossier "Divers"\n');
    console.log('Que souhaitez-vous faire?');
    console.log('1. Organiser les dossiers maintenant');
    console.log('2. Simuler l\'organisation (aperçu sans déplacer)');
    console.log('3. Lister le contenu actuel du bureau');
    console.log('4. Quitter\n');

    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    readline.question('Votre choix (1, 2, 3 ou 4): ', async (choix) => {
        console.log('');
        switch(choix) {
            case '1':
                readline.question('⚠️  ATTENTION: Cette action va déplacer tous vos dossiers. Continuer? (oui/non): ', async (confirmation) => {
                    if (confirmation.toLowerCase() === 'oui' || confirmation.toLowerCase() === 'o') {
                        readline.close();
                        await organiserDossiers();
                    } else {
                        console.log('❌ Organisation annulée');
                        readline.close();
                        await menu();
                    }
                });
                break;
            case '2':
                readline.close();
                await simulerOrganisation();
                await menu();
                break;
            case '3':
                readline.close();
                await listerBureau();
                await menu();
                break;
            case '4':
                console.log('👋 Au revoir!');
                readline.close();
                process.exit(0);
                break;
            default:
                console.log('❌ Choix invalide');
                readline.close();
                await menu();
        }
    });
}

// Lancer le programme
if (require.main === module) {
    menu();
}

module.exports = { organiserDossiers, simulerOrganisation };