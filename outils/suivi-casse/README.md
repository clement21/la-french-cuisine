# Suivi de la casse (restaurant)

Petite application web, utilisable depuis n'importe quel téléphone, pour déclarer la casse (verres, assiettes, carafes…) au moment où elle se produit.

Ce dossier est indépendant du site : `build_site.py` ne le lit pas.

## Ce que fait l'outil

1. Le serveur, le plongeur ou le cuisinier ouvre le lien sur son téléphone, **photographie l'objet cassé**, touche l'objet, la quantité, le lieu (salle, bar, plonge…) et la cause (chute, lave-vaisselle, choc thermique…).
2. Le script range dans **Google Drive** :

```
Mon Drive/
└── Suivi de la casse/
    ├── Registre de la casse        (classeur Google Sheets)
    │     ├── onglet Registre       une ligne par casse, avec lien vers la photo
    │     └── onglet Réglages       listes modifiables : objets + coût, lieux, causes, personnel
    ├── journal-casse.txt           une ligne de texte par casse (copie lisible partout)
    └── 2026-10/
        ├── 2026-10-21_143207_verre-a-vin_x2.jpg
        └── …
```

3. L'onglet **Bilan du mois** de l'application affiche le nombre de déclarations, de pièces et le coût, ventilés par objet, par lieu et par cause.

Les photos sont réduites à 1 600 pixels sur le téléphone avant l'envoi : l'envoi reste rapide même avec un réseau faible, et Drive ne se remplit pas trop vite (environ 200 à 400 ko par photo).

## Installation (10 minutes, une seule fois)

Avec le compte Google du restaurant (celui qui doit posséder les photos) :

1. Aller sur <https://script.google.com> puis **Nouveau projet**. Le renommer « Suivi de la casse ».
2. Dans le fichier `Code.gs`, tout effacer et coller le contenu de [`Code.gs`](Code.gs).
3. Cliquer sur **+** à côté de « Fichiers » puis **HTML**, le nommer exactement `Index` et y coller le contenu de [`Index.html`](Index.html).
4. Engrenage **Paramètres du projet** : vérifier que le fuseau horaire est `(GMT+01:00) Paris`.
5. Revenir dans `Code.gs`, choisir la fonction **`installer`** dans la liste en haut, puis **Exécuter**. Google demande des autorisations (Drive et Sheets) : les accepter. Si un écran « Google n'a pas validé cette application » apparaît, cliquer sur *Paramètres avancés* puis *Accéder à Suivi de la casse* : c'est votre propre script.
6. Ouvrir le classeur « Registre de la casse » créé dans Drive, onglet **Réglages** : renseigner le **coût d'achat** de chaque objet, compléter la liste du **personnel**, retirer ou ajouter des objets.
7. **Déployer** → **Nouveau déploiement** → type **Application Web** :
   - *Exécuter en tant que* : **Moi** (les photos arrivent toujours dans votre Drive) ;
   - *Qui a accès* : **Tout le monde** si l'équipe n'a pas de compte Google, sinon **Tout utilisateur disposant d'un compte Google**.
8. Copier l'URL `https://script.google.com/macros/s/…/exec`, l'envoyer à l'équipe et, sur chaque téléphone, l'**ajouter à l'écran d'accueil** (Safari : bouton Partager ; Chrome : menu ⋮).

Astuce : imprimer cette URL en **QR code** et la coller près de la plonge et du bar.

## Sécurité

Avec l'accès « Tout le monde », quiconque connaît l'URL peut déclarer une casse et consulter le bilan du mois ainsi que les listes de l'onglet Réglages (prénoms du personnel compris) ; il ne peut ni voir les photos, ni modifier le registre. Pour limiter cela, mettre un code dans `CODE_PIN` en haut de `Code.gs`, par exemple `CODE_PIN: '4821'`, puis **Déployer → Gérer les déploiements → Modifier → Nouvelle version**. Le formulaire demandera alors le code.

## Modifier l'outil

- Listes (objets, coûts, lieux, causes, personnel) : onglet **Réglages** du classeur, sans redéployer.
- Code (`Code.gs`, `Index.html`) : après modification, **Gérer les déploiements → Modifier → Version : Nouvelle version**. L'URL ne change pas.
- Heure de bascule midi/soir : `HEURE_SERVICE_SOIR` (16 h par défaut).

## Limites connues

- Il faut du réseau au moment de l'envoi (pas de mode hors ligne).
- Le coût est figé au moment de la déclaration : modifier un prix dans Réglages ne recalcule pas les casses passées.
- Ne pas renommer les onglets « Registre » et « Réglages ». Le dossier et le classeur, eux, peuvent être renommés ou déplacés : le script les retrouve par leur identifiant (et les recrée s'ils sont mis à la corbeille).
