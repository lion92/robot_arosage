const fs = require('fs');
const path = require('path');
const os = require('os');

// Chemin du bureau (compatible Windows, Mac, Linux)
const desktopPath = path.join(os.homedir(), 'Desktop');

// Fonction principale pour organiser le bureau
async function organiserBureau() {
    try {
        console.log('🚀 Début de l\'organisation du bureau...');
        console.log(`📁 Chemin du bureau: ${desktopPath}`);

        // Lire tous les fichiers du bureau
        const elements = await fs.promises.readdir(desktopPath);

        let fichiersTraites = 0;
        let dossiersCreés = new Set();

        for (const element of elements) {
            const cheminComplet = path.join(desktopPath, element);
            const stats = await fs.promises.stat(cheminComplet);

            // Traiter seulement les fichiers (pas les dossiers existants)
            if (stats.isFile()) {
                // Obtenir la première lettre du nom de fichier
                const premiereLettreOriginale = element[0];
                const premiereLettre = premiereLettreOriginale.toUpperCase();

                // Vérifier si c'est une lettre de A à Z
                if (/^[A-Z]$/.test(premiereLettre)) {
                    // Créer le nom du dossier (toujours en majuscule)
                    const nomDossier = premiereLettre;
                    const cheminDossier = path.join(desktopPath, nomDossier);

                    // Créer le dossier s'il n'existe pas
                    if (!fs.existsSync(cheminDossier)) {
                        await fs.promises.mkdir(cheminDossier, { recursive: true });
                        dossiersCreés.add(nomDossier);
                        console.log(`✅ Dossier créé: ${nomDossier}`);
                    }

                    // Déplacer le fichier dans le dossier approprié
                    const nouveauChemin = path.join(cheminDossier, element);

                    // Gérer les conflits de noms
                    let cheminFinal = nouveauChemin;
                    let compteur = 1;

                    while (fs.existsSync(cheminFinal)) {
                        const extension = path.extname(element);
                        const nomSansExtension = path.basename(element, extension);
                        cheminFinal = path.join(cheminDossier, `${nomSansExtension}_${compteur}${extension}`);
                        compteur++;
                    }

                    await fs.promises.rename(cheminComplet, cheminFinal);
                    console.log(`📄 Fichier déplacé: ${element} → ${nomDossier}/`);
                    fichiersTraites++;

                } else if (/^[0-9]$/.test(premiereLettreOriginale)) {
                    // Pour les fichiers commençant par un chiffre
                    const nomDossier = '0-9';
                    const cheminDossier = path.join(desktopPath, nomDossier);

                    if (!fs.existsSync(cheminDossier)) {
                        await fs.promises.mkdir(cheminDossier, { recursive: true });
                        dossiersCreés.add(nomDossier);
                        console.log(`✅ Dossier créé: ${nomDossier}`);
                    }

                    const nouveauChemin = path.join(cheminDossier, element);

                    // Gérer les conflits de noms
                    let cheminFinal = nouveauChemin;
                    let compteur = 1;

                    while (fs.existsSync(cheminFinal)) {
                        const extension = path.extname(element);
                        const nomSansExtension = path.basename(element, extension);
                        cheminFinal = path.join(cheminDossier, `${nomSansExtension}_${compteur}${extension}`);
                        compteur++;
                    }

                    await fs.promises.rename(cheminComplet, cheminFinal);
                    console.log(`📄 Fichier déplacé: ${element} → ${nomDossier}/`);
                    fichiersTraites++;

                } else {
                    // Pour les fichiers commençant par des caractères spéciaux
                    const nomDossier = 'Autres';
                    const cheminDossier = path.join(desktopPath, nomDossier);

                    if (!fs.existsSync(cheminDossier)) {
                        await fs.promises.mkdir(cheminDossier, { recursive: true });
                        dossiersCreés.add(nomDossier);
                        console.log(`✅ Dossier créé: ${nomDossier}`);
                    }

                    const nouveauChemin = path.join(cheminDossier, element);

                    // Gérer les conflits de noms
                    let cheminFinal = nouveauChemin;
                    let compteur = 1;

                    while (fs.existsSync(cheminFinal)) {
                        const extension = path.extname(element);
                        const nomSansExtension = path.basename(element, extension);
                        cheminFinal = path.join(cheminDossier, `${nomSansExtension}_${compteur}${extension}`);
                        compteur++;
                    }

                    await fs.promises.rename(cheminComplet, cheminFinal);
                    console.log(`📄 Fichier déplacé: ${element} → ${nomDossier}/`);
                    fichiersTraites++;
                }
            }
        }

        // Résumé final
        console.log('\n' + '='.repeat(50));
        console.log('✨ Organisation terminée avec succès!');
        console.log(`📊 Statistiques:`);
        console.log(`   - Fichiers traités: ${fichiersTraites}`);
        console.log(`   - Dossiers créés: ${dossiersCreés.size}`);
        if (dossiersCreés.size > 0) {
            console.log(`   - Liste des dossiers: ${Array.from(dossiersCreés).join(', ')}`);
        }
        console.log('='.repeat(50));

    } catch (erreur) {
        console.error('❌ Erreur lors de l\'organisation du bureau:', erreur.message);
        process.exit(1);
    }
}

// Mode simulation (pour tester sans déplacer les fichiers)
async function simulerOrganisation() {
    try {
        console.log('🔍 MODE SIMULATION - Aucun fichier ne sera déplacé');
        console.log(`📁 Analyse du bureau: ${desktopPath}\n`);

        const elements = await fs.promises.readdir(desktopPath);
        const organisation = {};

        for (const element of elements) {
            const cheminComplet = path.join(desktopPath, element);
            const stats = await fs.promises.stat(cheminComplet);

            if (stats.isFile()) {
                const premiereLettre = element[0].toUpperCase();
                let dossier;

                if (/^[A-Z]$/.test(premiereLettre)) {
                    dossier = premiereLettre;
                } else if (/^[0-9]$/.test(element[0])) {
                    dossier = '0-9';
                } else {
                    dossier = 'Autres';
                }

                if (!organisation[dossier]) {
                    organisation[dossier] = [];
                }
                organisation[dossier].push(element);
            }
        }

        console.log('📋 Résultat de la simulation:');
        for (const [dossier, fichiers] of Object.entries(organisation)) {
            console.log(`\n📁 ${dossier}/`);
            fichiers.forEach(f => console.log(`   └─ ${f}`));
        }

    } catch (erreur) {
        console.error('❌ Erreur lors de la simulation:', erreur.message);
    }
}

// Menu principal
async function menu() {
    console.log('\n🗂️  ORGANISATEUR DE BUREAU\n');
    console.log('Que souhaitez-vous faire?');
    console.log('1. Organiser le bureau maintenant');
    console.log('2. Simuler l\'organisation (voir le résultat sans déplacer les fichiers)');
    console.log('3. Quitter\n');

    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    readline.question('Votre choix (1, 2 ou 3): ', async (choix) => {
        switch(choix) {
            case '1':
                readline.close();
                await organiserBureau();
                break;
            case '2':
                readline.close();
                await simulerOrganisation();
                break;
            case '3':
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

module.exports = { organiserBureau, simulerOrganisation };