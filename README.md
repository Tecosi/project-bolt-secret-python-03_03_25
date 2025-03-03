# Analyseur de Dessins Techniques

Application web qui analyse automatiquement des dessins techniques (CAO et PDF), extrait les spécifications techniques, calcule le poids des pièces et propose des alternatives de matériaux.

## Fonctionnalités

- Upload et reconnaissance de dessins techniques (DXF, DWG, PDF, STL, STEP/STP)
- Extraction automatique des dimensions, matériaux et annotations
- Calcul du poids et du coût des pièces
- Proposition d'alternatives de matériaux avec comparaison
- Interface utilisateur intuitive et réactive
- Sauvegarde et chargement de projets

## Technologies utilisées

### Backend
- Node.js
- Express
- Three.js pour le traitement des fichiers 3D (STL, STEP)
- SQLite pour le stockage local des données de matériaux

### Frontend
- HTML5/CSS3/JavaScript
- Vue.js pour la réactivité
- Chart.js pour les visualisations comparatives
- Bootstrap 5 pour l'interface utilisateur

## Installation

1. Cloner le dépôt
2. Installer les dépendances:
   ```
   npm install
   ```
3. Lancer l'application:
   ```
   npm start
   ```
4. Ouvrir un navigateur et accéder à `http://localhost:3000`

## Structure du projet

```
├── server.js                # Serveur Express principal
├── public/                  # Fichiers statiques
│   ├── css/                 # Styles CSS
│   ├── js/                  # Scripts JavaScript
│   └── index.html           # Page principale
├── uploads/                 # Dossier pour les fichiers téléchargés
├── projects/                # Dossier pour les projets sauvegardés
└── database/                # Base de données SQLite
```

## Workflow utilisateur

1. L'utilisateur télécharge un dessin technique ou un modèle 3D
2. L'application analyse automatiquement le fichier et extrait les informations
3. L'application calcule le poids et le coût estimé
4. L'application propose des alternatives de matériaux
5. L'utilisateur peut ajuster les paramètres et exporter les résultats

## Formats de fichiers supportés

- **DXF/DWG**: Dessins techniques 2D (AutoCAD)
- **PDF**: Documents techniques et plans
- **STL**: Modèles 3D pour impression 3D et fabrication
- **STEP/STP**: Modèles 3D standard pour l'échange de données CAO

## Limitations actuelles

- Support limité pour les fichiers DWG
- Précision de la détection des dimensions dépendante de la qualité du dessin
- Base de données de matériaux limitée aux matériaux courants

## Développements futurs

- Amélioration de la reconnaissance des cotations et annotations
- Support pour plus de formats de fichiers CAO
- Algorithmes plus avancés pour la suggestion d'alternatives
- Export vers plus de formats (PDF, Excel)
- Intégration avec des API de fournisseurs de matériaux pour des coûts en temps réel

## Licence

Ce projet est sous licence MIT.