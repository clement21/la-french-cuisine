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
    │     └── onglet Réglages       listes modifiables : objets + coût + catégorie, lieux, causes, personnel
    ├── journal-casse.txt           une ligne de texte par casse (copie lisible partout)
    └── 2026-10/
        ├── 2026-10-21_143207_verre-a-vin_x2.jpg
        └── …
```

3. L'onglet **Bilan du mois** de l'application affiche le nombre de déclarations, de pièces et le coût, ventilés par objet, par lieu et par cause.
4. Chaque **lundi matin**, un e-mail récapitule la semaine écoulée, photos comprises.
5. Le **1er de chaque mois**, un e-mail fait le bilan du mois écoulé.

Ces e-mails sont purement informatifs : aucune alerte, aucun seuil. Ils sont aussi **anonymes** : le nom du déclarant n'apparaît que dans le registre (classeur et journal texte), jamais dans les bilans, ni dans l'application, ni dans la description des photos. Seule limite : un prénom tapé dans le champ « Commentaire » serait recopié tel quel.

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
   - *Qui a accès* : **Moi uniquement** si vous êtes seul à déclarer, depuis votre téléphone connecté à votre compte Google : c'est le réglage le plus sûr, personne d'autre ne peut ouvrir l'application et le code PIN devient inutile. Si plusieurs personnes doivent déclarer : **Tout le monde** (l'équipe n'a pas de compte Google) ou **Tout utilisateur disposant d'un compte Google**.
8. Copier l'URL `https://script.google.com/macros/s/…/exec`, l'ouvrir sur le téléphone qui servira aux déclarations (ou l'envoyer à l'équipe) et l'**ajouter à l'écran d'accueil** (Safari : bouton Partager ; Chrome : menu ⋮).

Astuce : imprimer cette URL en **QR code** et la coller près de la plonge et du bar.

## Récapitulatif par e-mail chaque lundi

Chaque lundi matin, un e-mail résume la semaine écoulée (du lundi au dimanche) :

- objet : `Casse du 12/10 au 18/10/2026 : 5 pièces, 37,50 €` ;
- nombre de déclarations, de pièces et coût, comparés à la semaine précédente ;
- tableaux par objet, par lieu et par cause ;
- détail de chaque casse (jour, heure, service, lieu, cause, commentaire) avec la **photo intégrée** (12 au maximum, les suivantes en lien) ;
- lien vers le registre complet.

Mise en route (une fois, après l'installation) :

1. En haut de `Code.gs`, régler si besoin :
   - `EMAILS_RECAP` : destinataires séparés par des virgules, par exemple `'gerant@monresto.fr, chef@monresto.fr'`. Vide = l'adresse du compte qui a installé le script ;
   - `HEURE_RECAP` : 8 par défaut. Google envoie dans l'heure qui suit, donc entre 8 h et 9 h ;
   - `RECAP_SI_AUCUNE_CASSE` : `true` pour recevoir aussi un e-mail les semaines sans casse.
2. Choisir la fonction **`envoyerRecapHebdo`** et cliquer sur **Exécuter** : Google demande l'autorisation d'envoyer des e-mails, et un premier récapitulatif (semaine dernière) arrive aussitôt.
3. Choisir la fonction **`installerRecapLundi`** et cliquer sur **Exécuter**. C'est programmé : l'horloge ⏰ « Déclencheurs » du menu de gauche l'affiche.

Pour arrêter : exécuter **`supprimerRecapLundi`**. Après une modification de `EMAILS_RECAP` ou `HEURE_RECAP`, relancer `installerRecapLundi` (inutile de redéployer l'application). L'e-mail part depuis le compte Google qui a installé le script ; un compte gratuit peut envoyer 100 e-mails par jour, bien assez ici.

## Bilan par e-mail le 1er de chaque mois

Le 1er du mois, entre 8 h et 9 h (même réglage `HEURE_RECAP`), un e-mail fait le bilan du mois écoulé :

- objet : `Casse d'octobre 2026 : 9 pièces, 52,00 €` ;
- totaux comparés au mois précédent ;
- répartition par objet, par lieu, par cause, **midi / soir** et **par semaine** ;
- **évolution sur 6 mois** (réglable avec `MOIS_HISTORIQUE`), pour voir la tendance et repérer les mois chargés ;
- détail compact de chaque casse, avec un lien vers sa photo (pas de photo intégrée : un mois peut en compter beaucoup).

Mise en route : exécuter **`envoyerRecapMensuel`** pour recevoir tout de suite le bilan du mois dernier, puis **`installerRecapMensuel`** pour le programmer. Pour arrêter : **`supprimerRecapMensuel`**. Les deux récapitulatifs sont indépendants : on peut garder l'un sans l'autre.

## Ranger le dossier dans un dossier Drive précis

Par défaut, « Suivi de la casse » est créé à la racine de « Mon Drive ». Pour le ranger ailleurs (par exemple `Restaurant / Gestion`) :

1. Dans Google Drive, ouvrir le dossier de destination et copier son lien dans la barre d'adresse : `https://drive.google.com/drive/folders/1AbC…`.
2. En haut de `Code.gs`, le coller entre les apostrophes : `DOSSIER_PARENT: 'https://drive.google.com/drive/folders/1AbC…',` puis enregistrer (Ctrl+S).
3. Exécuter **`installer`** une fois, ou **Déployer → Gérer les déploiements → Modifier → Nouvelle version** puis ouvrir l'application.

Si l'outil est déjà installé, **tout le dossier est déplacé** avec son contenu : photos, classeur et journal. Les liens ne changent pas, donc le registre, les anciens e-mails et l'application continuent de fonctionner. Si le lien est erroné, le script s'arrête avec le message « Dossier Drive introuvable » et ne crée rien ailleurs. Pour un **Drive partagé** (Google Workspace), le déplacement automatique peut être refusé : déplacer alors le dossier à la main, le script le retrouvera.

## Sécurité

Avec l'accès **Moi uniquement**, rien à faire : seul votre compte Google peut ouvrir l'application. Ce qui suit ne concerne que l'accès ouvert à d'autres personnes.

Avec l'accès « Tout le monde », quiconque connaît l'URL peut déclarer une casse et consulter le bilan du mois ainsi que les listes de l'onglet Réglages (prénoms du personnel compris) ; il ne peut ni voir les photos, ni modifier le registre. Pour limiter cela, mettre un code dans `CODE_PIN` en haut de `Code.gs`, par exemple `CODE_PIN: '4821'`, puis **Déployer → Gérer les déploiements → Modifier → Nouvelle version**. Le formulaire demandera alors le code.

## Modifier l'outil

- Listes (objets, coûts, catégories, lieux, causes, personnel) : onglet **Réglages** du classeur, sans redéployer.
- **Catégories** (colonne C de Réglages) : chaque objet appartient à une catégorie, par défaut **Sommellerie** (verres, flûtes, carafes…) ou **Cuisine** (assiettes, tasses, ramequins…). L'application affiche un groupe de tuiles par catégorie, dans l'ordre de l'onglet, et les bilans (application et e-mails) ajoutent une ventilation « Par catégorie ». Pour reclasser un objet, changer sa catégorie ; pour créer une catégorie (par exemple « Bar » ou « Couverts »), il suffit de taper son nom. Le registre garde en colonne N la catégorie de l'objet au moment de la casse.
- Installation antérieure aux catégories : recopier `Code.gs` puis exécuter **`installer`**. Les catégories sont proposées pour les objets existants et ajoutées aux anciennes lignes du registre, sans toucher aux cellules déjà remplies.
- Code (`Code.gs`, `Index.html`) : après modification, **Gérer les déploiements → Modifier → Version : Nouvelle version**. L'URL ne change pas.
- Heure de bascule midi/soir : `HEURE_SERVICE_SOIR` (16 h par défaut).

## Dépannage

- **La colonne « Photo » du registre affiche une erreur ou un texte non cliquable** (versions antérieures au 21/10/2026, qui écrivaient une formule `=HYPERLINK` dépendant de la langue du classeur) : recopier `Code.gs`, puis exécuter **`installer`** ou **`reparerLiensPhotos`**. Les anciennes lignes deviennent des liens « Voir la photo ». Les nouvelles déclarations écrivent directement un lien cliquable, quelle que soit la langue du classeur.

## Limites connues

- Il faut du réseau au moment de l'envoi (pas de mode hors ligne).
- Le coût est figé au moment de la déclaration : modifier un prix dans Réglages ne recalcule pas les casses passées.
- Ne pas renommer les onglets « Registre » et « Réglages ». Le dossier et le classeur, eux, peuvent être renommés ou déplacés à la main : le script les retrouve par leur identifiant (et les recrée s'ils sont mis à la corbeille). Si `DOSSIER_PARENT` est renseigné, le script ne déplace le dossier que lorsque ce réglage change.
