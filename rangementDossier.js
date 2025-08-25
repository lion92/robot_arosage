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

                // Ignorer les dossiers de regroupement déjà créés (A, B, C, etc.)
                if (element.length === 1 && /^[A-Z]$/.test(element)) {
                    dossiersIgnores.push(element);
                    continue;
                }

                // Ignorer aussi les dossiers spéciaux "0-9" et "Autres"
                if (element === '0-9' || element === 'Autres') {
                    dossiersIgnores.push(element);
                    continue;
                }

                let dossierConteneur;

                // Déterminer le dossier conteneur approprié
                if (/^[A-Z]$/i.test(premiereLettreOriginale)) {
                    // Lettre de A à Z (majuscule ou minuscule)
                    dossierConteneur = premiereLettre; // Toujours en majuscule
                } else if (/^[0-9]$/.test(premiereLettreOriginale)) {
                    // Commence par un chiffre
                    dossierConteneur = '0-9';
                } else {
                    // Commence par un caractère spécial
                    dossierConteneur = 'Autres';
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
        const organisation = {
            'A-Z': {},
            '0-9': [],
            'Autres': []
        };

        let totalDossiers = 0;
        let dossiersIgnores = [];

        for (const element of elements) {
            const cheminComplet = path.join(desktopPath, element);
            const stats = await fs.promises.stat(cheminComplet);

            if (stats.isDirectory()) {
                const premiereLettreOriginale = element[0];
                const premiereLettre = premiereLettreOriginale.toUpperCase();

                // Ignorer les dossiers de regroupement
                if ((element.length === 1 && /^[A-Z]$/.test(element)) ||
                    element === '0-9' ||
                    element === 'Autres') {
                    dossiersIgnores.push(element);
                    continue;
                }

                if (/^[A-Z]$/i.test(premiereLettreOriginale)) {
                    if (!organisation['A-Z'][premiereLettre]) {
                        organisation['A-Z'][premiereLettre] = [];
                    }
                    organisation['A-Z'][premiereLettre].push(element);
                } else if (/^[0-9]$/.test(premiereLettreOriginale)) {
                    organisation['0-9'].push(element);
                } else {
                    organisation['Autres'].push(element);
                }
                totalDossiers++;
            }
        }

        console.log('📋 Résultat de la simulation:\n');

        // Afficher les dossiers par lettre
        const lettres = Object.keys(organisation['A-Z']).sort();
        for (const lettre of lettres) {
            console.log(`📁 ${lettre}/`);
            organisation['A-Z'][lettre].forEach(d => console.log(`   └─ 📂 ${d}`));
            console.log('');
        }

        // Afficher les dossiers numériques
        if (organisation['0-9'].length > 0) {
            console.log(`📁 0-9/`);
            organisation['0-9'].forEach(d => console.log(`   └─ 📂 ${d}`));
            console.log('');
        }

        // Afficher les autres dossiers
        if (organisation['Autres'].length > 0) {
            console.log(`📁 Autres/`);
            organisation['Autres'].forEach(d => console.log(`   └─ 📂 ${d}`));
            console.log('');
        }

        console.log('='.repeat(60));
        console.log(`Total: ${totalDossiers} dossiers à organiser`);
        if (dossiersIgnores.length > 0) {
            console.log(`Dossiers ignorés: ${dossiersIgnores.join(', ')}`);
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
    console.log('Ce programme organise les DOSSIERS de votre bureau');
    console.log('en les regroupant par leur première lettre (A, B, C...)\n');
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