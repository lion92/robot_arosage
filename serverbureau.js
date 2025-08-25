const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Chemin du bureau
const bureauPath = path.join(os.homedir(), 'Desktop');

// Fonction pour explorer le bureau
function explorerBureau() {
    console.log('Exploration du bureau...');
    const resultats = [];

    // Fonction récursive pour parcourir les dossiers
    function parcourir(dossier, niveau) {
        // Si on a atteint le niveau 2, on arrête
        if (niveau > 2) return;

        try {
            // Lire le contenu du dossier
            const contenu = fs.readdirSync(dossier);

            contenu.forEach(element => {
                const cheminComplet = path.join(dossier, element);

                try {
                    const stats = fs.statSync(cheminComplet);

                    // Ajouter l'élément aux résultats
                    resultats.push({
                        nom: element,
                        chemin: cheminComplet,
                        estDossier: stats.isDirectory(),
                        niveau: niveau
                    });

                    // Si c'est un dossier et qu'on n'est pas au niveau max, explorer dedans
                    if (stats.isDirectory() && niveau < 2) {
                        parcourir(cheminComplet, niveau + 1);
                    }
                } catch (err) {
                    // Ignorer les erreurs (fichiers protégés, etc.)
                }
            });
        } catch (err) {
            console.log('Erreur lors de la lecture:', err.message);
        }
    }

    // Commencer l'exploration depuis le bureau (niveau 0)
    parcourir(bureauPath, 0);

    console.log('Nombre total d\'éléments trouvés:', resultats.length);
    return resultats;
}

// Page HTML
const pageHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Explorateur Bureau</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background: #f0f0f0;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            border-bottom: 2px solid #4CAF50;
            padding-bottom: 10px;
        }
        .controls {
            margin: 20px 0;
        }
        input {
            padding: 8px 12px;
            font-size: 16px;
            border: 1px solid #ddd;
            border-radius: 4px;
            width: 300px;
        }
        button {
            padding: 8px 20px;
            font-size: 16px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin-left: 10px;
        }
        button:hover {
            background: #45a049;
        }
        .stats {
            background: #e7f3ff;
            padding: 10px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .niveau-0 {
            background: #fff;
            border-left: 4px solid #4CAF50;
        }
        .niveau-1 {
            background: #f9f9f9;
            border-left: 4px solid #2196F3;
            margin-left: 20px;
        }
        .niveau-2 {
            background: #f5f5f5;
            border-left: 4px solid #FF9800;
            margin-left: 40px;
        }
        .item {
            padding: 10px;
            margin: 5px 0;
            border-radius: 4px;
        }
        .item:hover {
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .nom {
            font-weight: bold;
            color: #333;
        }
        .chemin {
            color: #666;
            font-size: 12px;
            margin-top: 5px;
            font-family: monospace;
            background: #f0f0f0;
            padding: 4px;
            border-radius: 3px;
        }
        .icone {
            margin-right: 8px;
        }
        .section-titre {
            font-size: 18px;
            font-weight: bold;
            margin: 20px 0 10px 0;
            color: #333;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Explorateur du Bureau</h1>
        
        <div class="controls">
            <input type="text" id="recherche" placeholder="Filtrer par nom...">
            <button onclick="filtrer()">Filtrer</button>
            <button onclick="afficherTout()">Afficher tout</button>
            <button onclick="location.reload()">Actualiser</button>
        </div>
        
        <div class="stats">
            <strong>Statistiques:</strong>
            <span id="stats"></span>
        </div>
        
        <div id="resultats"></div>
    </div>

    <script>
        let donnees = [];
        
        // Charger les données
        fetch('/api/explorer')
            .then(res => res.json())
            .then(data => {
                donnees = data;
                afficher(donnees);
            });
        
        function afficher(items) {
            const div = document.getElementById('resultats');
            const stats = document.getElementById('stats');
            
            // Grouper par niveau
            const niveau0 = items.filter(i => i.niveau === 0);
            const niveau1 = items.filter(i => i.niveau === 1);
            const niveau2 = items.filter(i => i.niveau === 2);
            
            // Stats
            const nbFichiers = items.filter(i => !i.estDossier).length;
            const nbDossiers = items.filter(i => i.estDossier).length;
            stats.innerHTML = 'Total: ' + items.length + ' éléments | ' +
                             nbFichiers + ' fichiers | ' + 
                             nbDossiers + ' dossiers | ' +
                             'Bureau: ' + niveau0.length + ' | ' +
                             'Niveau 1: ' + niveau1.length + ' | ' +
                             'Niveau 2: ' + niveau2.length;
            
            let html = '';
            
            // Niveau 0 - Bureau
            if (niveau0.length > 0) {
                html += '<div class="section-titre">📌 Bureau (' + niveau0.length + ' éléments)</div>';
                niveau0.forEach(item => {
                    html += creerItem(item);
                });
            }
            
            // Niveau 1
            if (niveau1.length > 0) {
                html += '<div class="section-titre">📂 Premier niveau (' + niveau1.length + ' éléments)</div>';
                niveau1.forEach(item => {
                    html += creerItem(item);
                });
            }
            
            // Niveau 2
            if (niveau2.length > 0) {
                html += '<div class="section-titre">📁 Deuxième niveau (' + niveau2.length + ' éléments)</div>';
                niveau2.forEach(item => {
                    html += creerItem(item);
                });
            }
            
            div.innerHTML = html;
        }
        
        function creerItem(item) {
            const icone = item.estDossier ? '📁' : '📄';
            return '<div class="item niveau-' + item.niveau + '">' +
                   '<div class="nom">' +
                   '<span class="icone">' + icone + '</span>' +
                   item.nom +
                   '</div>' +
                   '<div class="chemin">' + item.chemin + '</div>' +
                   '</div>';
        }
        
        function filtrer() {
            const recherche = document.getElementById('recherche').value.toLowerCase();
            if (!recherche) {
                afficher(donnees);
                return;
            }
            
            const filtres = donnees.filter(item => 
                item.nom.toLowerCase().includes(recherche)
            );
            afficher(filtres);
        }
        
        function afficherTout() {
            document.getElementById('recherche').value = '';
            afficher(donnees);
        }
    </script>
</body>
</html>
`;

// Créer le serveur
const server = http.createServer((req, res) => {
    console.log('Requête reçue:', req.url);

    if (req.url === '/') {
        // Servir la page HTML
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(pageHTML);
    } else if (req.url === '/api/explorer') {
        // API pour obtenir les données
        const resultats = explorerBureau();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(resultats));
    } else {
        // 404
        res.writeHead(404);
        res.end('Page non trouvée');
    }
});

// Démarrer le serveur
const PORT = 3009;
server.listen(PORT, () => {
    console.log('');
    console.log('========================================');
    console.log('✅ Serveur démarré avec succès !');
    console.log('========================================');
    console.log('');
    console.log('📌 Ouvrez votre navigateur à cette adresse :');
    console.log('   http://localhost:' + PORT);
    console.log('');
    console.log('📁 Exploration du bureau : ' + bureauPath);
    console.log('');
    console.log('Pour arrêter le serveur : Ctrl+C');
    console.log('========================================');
    console.log('');
});