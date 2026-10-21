/**
 * Suivi de la casse : application web Google Apps Script.
 *
 * Le personnel photographie l'objet cassé depuis son téléphone, choisit l'objet,
 * la quantité, le lieu et la cause. Le script :
 *   1. range la photo dans Google Drive : « Suivi de la casse / 2026-10 / … .jpg » ;
 *   2. ajoute une ligne au classeur « Registre de la casse » (onglet Registre) ;
 *   3. ajoute une ligne au fichier texte « journal-casse.txt ».
 *
 * Les listes (objets et coûts, lieux, causes, personnel) se modifient dans
 * l'onglet « Réglages » du classeur, sans toucher au code.
 */

const CONFIG = {
  NOM_DOSSIER: 'Suivi de la casse',
  NOM_CLASSEUR: 'Registre de la casse',
  NOM_JOURNAL: 'journal-casse.txt',
  // Dossier Google Drive où ranger « Suivi de la casse » : coller son lien (ou son identifiant).
  // Vide = à la racine de « Mon Drive ». Une installation existante y est déplacée telle quelle.
  DOSSIER_PARENT: '',
  // Code à 4 chiffres demandé avant chaque déclaration. Laisser vide pour ne pas en demander.
  CODE_PIN: '',
  // Heure (0-23) à partir de laquelle on considère que c'est le service du soir.
  HEURE_SERVICE_SOIR: 16,
  // Récapitulatif hebdomadaire : destinataires séparés par des virgules.
  // Vide = l'adresse du compte qui a installé le script.
  EMAILS_RECAP: '',
  // Heure (0-23) d'envoi, le lundi et le 1er du mois. Google envoie dans l'heure qui suit (8 = entre 8 h et 9 h).
  HEURE_RECAP: 8,
  // Envoyer aussi l'e-mail quand aucune casse n'a été déclarée dans la semaine.
  RECAP_SI_AUCUNE_CASSE: true,
  // Nombre maximal de photos affichées dans l'e-mail (les suivantes en simple lien).
  PHOTOS_DANS_RECAP: 12,
  // Récapitulatif mensuel : nombre de mois affichés dans le tableau « Évolution ».
  MOIS_HISTORIQUE: 6,
};

const ENTETES_REGISTRE = [
  'N°', 'Horodatage', 'Date', 'Service', 'Objet', 'Quantité',
  'Coût unitaire (€)', 'Coût total (€)', 'Lieu', 'Cause',
  'Déclaré par', 'Commentaire', 'Photo', 'Catégorie',
];

// Valeurs de départ de l'onglet Réglages (à adapter). Coûts à 0 : à renseigner.
// La catégorie de chaque objet (Sommellerie ou Cuisine) est proposée par categorieParDefaut_().
const REGLAGES_PAR_DEFAUT = {
  objets: [
    'Verre à vin', 'Verre à eau', 'Flûte à champagne', 'Verre à bière', 'Tumbler',
    'Carafe', 'Assiette plate', 'Assiette creuse', 'Assiette à dessert', 'Tasse',
    'Soucoupe', 'Ramequin', 'Plat de service', 'Bol', 'Autre',
  ],
  lieux: ['Salle', 'Terrasse', 'Bar', 'Cuisine', 'Plonge', 'Réserve'],
  causes: [
    'Chute', 'Choc pendant le service', 'Plonge / lave-vaisselle', 'Choc thermique',
    'Ébréchure / fêlure', 'Client', 'Rangement', 'Inconnue',
  ],
  personnel: [],
};

/* ------------------------------------------------------------------ */
/* Installation                                                        */
/* ------------------------------------------------------------------ */

/** À lancer une fois depuis l'éditeur : crée le dossier, le classeur et le journal. */
function installer() {
  const r = ressources_();
  reparerLiensPhotos();
  migrerCategories_(r.classeur);
  Logger.log('Dossier : ' + r.dossier.getUrl());
  Logger.log('Classeur : ' + r.classeur.getUrl());
  Logger.log('Journal : ' + r.journal.getUrl());
}

/** Retrouve (ou recrée s'ils ont disparu) le dossier, le classeur et le journal. */
function ressources_() {
  const props = PropertiesService.getScriptProperties();

  const parent = dossierParent_();
  let dossier = parId_(props.getProperty('DOSSIER_ID'), id => DriveApp.getFolderById(id));
  if (!dossier) {
    dossier = (parent || DriveApp.getRootFolder()).createFolder(CONFIG.NOM_DOSSIER);
    props.setProperty('DOSSIER_ID', dossier.getId());
    props.setProperty('PARENT_ID', parent ? parent.getId() : '');
  } else if (parent && props.getProperty('PARENT_ID') !== parent.getId()) {
    // Réglage nouveau ou modifié : on déplace tout le dossier (photos, classeur, journal).
    // Les identifiants ne changent pas : liens, registre et e-mails restent valables.
    dossier.moveTo(parent);
    props.setProperty('PARENT_ID', parent.getId());
  }

  const fichierClasseur = parId_(props.getProperty('CLASSEUR_ID'), id => DriveApp.getFileById(id));
  let classeur = fichierClasseur ? SpreadsheetApp.openById(fichierClasseur.getId()) : null;
  if (!classeur) {
    classeur = creerClasseur_(dossier);
    props.setProperty('CLASSEUR_ID', classeur.getId());
  }

  let journal = parId_(props.getProperty('JOURNAL_ID'), id => DriveApp.getFileById(id));
  if (!journal) {
    journal = dossier.createFile(
      CONFIG.NOM_JOURNAL,
      'JOURNAL DE LA CASSE\n' +
      'N° | date heure | service | objet x quantité | coût | lieu | cause | déclaré par | commentaire | photo\n\n',
      MimeType.PLAIN_TEXT
    );
    props.setProperty('JOURNAL_ID', journal.getId());
  }

  return { dossier, classeur, journal };
}

/* ------------------------------------------------------------------ */
/* Liens vers les photos (colonne M du registre)                       */
/* ------------------------------------------------------------------ */

function lienPhoto_(url) {
  return SpreadsheetApp.newRichTextValue().setText('Voir la photo').setLinkUrl(url).build();
}

/**
 * Adresse de la photo de chaque ligne du registre (indice = numéro de ligne - 1).
 * Lit le lien cliquable, et à défaut l'adresse contenue dans une ancienne formule =HYPERLINK
 * (même en erreur) ou dans le texte de la cellule.
 */
function urlsPhotos_(feuille) {
  const n = feuille.getLastRow();
  if (n < 1) return [];
  const plage = feuille.getRange(1, 13, n, 1);
  const riches = plage.getRichTextValues();
  const formules = plage.getFormulas();
  const valeurs = plage.getDisplayValues();
  const adresse = /https:\/\/drive\.google\.com\/[^"'\s;,)]+/;
  return riches.map((ligne, i) => {
    const r = ligne[0];
    const lien = r && (r.getLinkUrl() || r.getRuns().map(x => x.getLinkUrl()).find(Boolean));
    if (lien) return lien;
    const m = adresse.exec(formules[i][0]) || adresse.exec(valeurs[i][0]);
    return m ? m[0] : '';
  });
}

/**
 * Transforme les anciennes cellules « Photo » (formule =HYPERLINK, parfois en erreur)
 * en liens cliquables « Voir la photo ». Sans effet sur les lignes déjà correctes.
 * Lancée automatiquement par installer() ; peut aussi être exécutée seule.
 */
function reparerLiensPhotos() {
  const feuille = ressources_().classeur.getSheetByName('Registre');
  const urls = urlsPhotos_(feuille);
  const riches = urls.length ? feuille.getRange(1, 13, urls.length, 1).getRichTextValues() : [];
  let reparees = 0;
  for (let i = 1; i < urls.length; i++) {
    const dejaBon = riches[i][0] && riches[i][0].getLinkUrl() && riches[i][0].getText() === 'Voir la photo';
    if (!urls[i] || dejaBon) continue;
    feuille.getRange(i + 1, 13).setRichTextValue(lienPhoto_(urls[i]));
    reparees++;
  }
  Logger.log(reparees ? reparees + ' lien(s) photo réparé(s) dans le registre.' : 'Liens photo : rien à réparer.');
  return reparees;
}

/* ------------------------------------------------------------------ */
/* Catégories d'objets (Sommellerie, Cuisine…)                         */
/* ------------------------------------------------------------------ */

/**
 * Catégorie proposée pour un objet d'après son nom : la verrerie, les carafes (vin et eau),
 * les tasses et les soucoupes vont en Sommellerie ; le reste en Cuisine.
 */
function categorieParDefaut_(nom) {
  return /verre|fl[ûu]te|coupe|tumbler|old.?fashion|martini|highball|hi.?ball|whisky|cocktail|chope|ap[ée]ritif|digestif|carafe|d[ée]canteur|pichet|seau|ballon|calice|shooter|tasse|soucoupe/i.test(String(nom))
    ? 'Sommellerie' : 'Cuisine';
}

/**
 * Ajoute les catégories à une installation qui n'en avait pas :
 * colonne C « Catégorie » de Réglages (pré-remplie) et colonne N « Catégorie » du registre.
 * Ne touche jamais une cellule déjà remplie. Lancée par installer() et, au besoin, par getReglages().
 */
function migrerCategories_(classeur) {
  const entete = r => r.setFontWeight('bold').setBackground('#f3ede2');

  const reglages = classeur.getSheetByName('Réglages');
  if (String(reglages.getRange('C1').getValue()).trim() === '') {
    entete(reglages.getRange('C1').setValue('Catégorie'));
    const n = reglages.getLastRow() - 1;
    if (n > 0) {
      const plage = reglages.getRange(2, 1, n, 3);
      const v = plage.getValues();
      v.forEach(l => { if (String(l[0]).trim() && !String(l[2]).trim()) l[2] = categorieParDefaut_(l[0]); });
      reglages.getRange(2, 3, n, 1).setValues(v.map(l => [l[2]]));
    }
  }

  const registre = classeur.getSheetByName('Registre');
  if (String(registre.getRange(1, 14).getValue()).trim() === '') {
    entete(registre.getRange(1, 14).setValue('Catégorie'));
    const n = registre.getLastRow() - 1;
    if (n > 0) {
      const noms = reglages.getRange(2, 1, Math.max(reglages.getLastRow() - 1, 1), 3).getValues();
      const parNom = Object.fromEntries(noms.filter(l => String(l[0]).trim())
        .map(l => [String(l[0]).trim(), String(l[2]).trim()]));
      const objets = registre.getRange(2, 5, n, 1).getValues();
      const actuelles = registre.getRange(2, 14, n, 1).getValues();
      registre.getRange(2, 14, n, 1).setValues(objets.map((l, i) => [
        String(actuelles[i][0]).trim() || (l[0] ? parNom[String(l[0]).trim()] || categorieParDefaut_(l[0]) : ''),
      ]));
    }
  }
}

/**
 * Remet la colonne « Catégorie » du registre en accord avec l'onglet Réglages, pour toutes les
 * casses passées. À lancer à la main après avoir reclassé des objets, si l'on veut que les
 * anciens bilans suivent le nouveau classement. Les objets absents de Réglages ne sont pas modifiés.
 */
function reappliquerCategories() {
  const registre = ressources_().classeur.getSheetByName('Registre');
  const n = registre.getLastRow() - 1;
  if (n < 1) return Logger.log('Registre vide : rien à faire.');
  const parNom = Object.fromEntries(getReglages().objets.map(o => [o.nom, o.categorie]));
  const objets = registre.getRange(2, 5, n, 1).getValues();
  const plage = registre.getRange(2, 14, n, 1);
  const actuelles = plage.getValues();
  let changees = 0;
  const nouvelles = objets.map((l, i) => {
    const cible = parNom[String(l[0]).trim()];
    if (cible && cible !== actuelles[i][0]) { changees++; return [cible]; }
    return [actuelles[i][0]];
  });
  plage.setValues(nouvelles);
  Logger.log(changees + ' casse(s) reclassée(s) dans le registre.');
}

/** Dossier Drive indiqué dans CONFIG.DOSSIER_PARENT, ou null s'il n'est pas renseigné. */
function dossierParent_() {
  const valeur = String(CONFIG.DOSSIER_PARENT || '').trim();
  if (!valeur) return null;
  const m = /folders\/([\w-]+)/.exec(valeur) || /[?&]id=([\w-]+)/.exec(valeur);
  const id = m ? m[1] : valeur;
  try {
    const dossier = DriveApp.getFolderById(id);
    if (!dossier.isTrashed()) return dossier;
  } catch (e) {
    // traité ci-dessous
  }
  throw new Error('Dossier Drive introuvable : vérifiez le lien indiqué dans DOSSIER_PARENT (Code.gs).');
}

/** Ouvre une ressource Drive par son identifiant ; null si absente ou à la corbeille. */
function parId_(id, ouvrir) {
  if (!id) return null;
  try {
    const res = ouvrir(id);
    return res.isTrashed() ? null : res;
  } catch (e) {
    return null;
  }
}

function creerClasseur_(dossier) {
  const classeur = SpreadsheetApp.create(CONFIG.NOM_CLASSEUR);
  DriveApp.getFileById(classeur.getId()).moveTo(dossier);

  const registre = classeur.getSheets()[0].setName('Registre');
  registre.getRange(1, 1, 1, ENTETES_REGISTRE.length)
    .setValues([ENTETES_REGISTRE]).setFontWeight('bold').setBackground('#f3ede2');
  registre.setFrozenRows(1);
  registre.getRange('B:B').setNumberFormat('dd/MM/yyyy HH:mm');
  registre.getRange('C:C').setNumberFormat('dd/MM/yyyy');
  registre.getRange('G:H').setNumberFormat('0.00 €');

  const reglages = classeur.insertSheet('Réglages');
  const d = REGLAGES_PAR_DEFAUT;
  const n = Math.max(d.objets.length, d.lieux.length, d.causes.length, 1);
  const lignes = [['Objet', 'Coût unitaire (€)', 'Catégorie', 'Lieu', 'Cause', 'Personnel']];
  for (let i = 0; i < n; i++) {
    lignes.push([
      d.objets[i] || '', d.objets[i] ? 0 : '', d.objets[i] ? categorieParDefaut_(d.objets[i]) : '',
      d.lieux[i] || '', d.causes[i] || '', d.personnel[i] || '',
    ]);
  }
  reglages.getRange(1, 1, lignes.length, 6).setValues(lignes);
  reglages.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#f3ede2');
  reglages.getRange('B:B').setNumberFormat('0.00 €');
  reglages.setFrozenRows(1);
  reglages.getRange('H1').setValue(
    'Modifiez librement ces listes : l\'application les relit à chaque ouverture. ' +
    'Renseignez le coût d\'achat de chaque objet pour chiffrer la casse. ' +
    'La catégorie (Sommellerie, Cuisine…) regroupe les objets dans l\'application et les bilans.'
  );
  return classeur;
}

/* ------------------------------------------------------------------ */
/* Application web                                                     */
/* ------------------------------------------------------------------ */

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Casse')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}

/** Listes affichées dans le formulaire. */
function getReglages() {
  const classeur = ressources_().classeur;
  const feuille = classeur.getSheetByName('Réglages');
  let valeurs = feuille.getDataRange().getValues();
  if (String(valeurs[0][2]).trim() === '') {
    // Installation antérieure aux catégories : on les ajoute une fois pour toutes.
    migrerCategories_(classeur);
    valeurs = feuille.getDataRange().getValues();
  }
  valeurs = valeurs.slice(1);
  const colonne = i => valeurs.map(l => String(l[i]).trim()).filter(Boolean);
  const objets = valeurs
    .filter(l => String(l[0]).trim())
    .map(l => ({
      nom: String(l[0]).trim(),
      cout: Number(l[1]) || 0,
      categorie: String(l[2]).trim() || 'Autres',
    }));
  return {
    objets,
    categories: objets.map(o => o.categorie).filter((c, i, t) => t.indexOf(c) === i),
    lieux: colonne(3),
    causes: colonne(4),
    personnel: colonne(5),
    pinRequis: Boolean(CONFIG.CODE_PIN),
    heureSoir: CONFIG.HEURE_SERVICE_SOIR,
  };
}

/**
 * Enregistre une déclaration de casse.
 * @param {Object} d { pin, photo (base64 JPEG), objet, quantite, lieu, cause, declarant, commentaire, service }
 */
function enregistrerCasse(d) {
  if (CONFIG.CODE_PIN && String(d.pin) !== String(CONFIG.CODE_PIN)) {
    throw new Error('Code incorrect.');
  }
  const objet = texte_(d.objet, 80);
  const quantite = Math.floor(Number(d.quantite));
  if (!objet) throw new Error('Choisissez l\'objet cassé.');
  if (!(quantite >= 1 && quantite <= 500)) throw new Error('Quantité invalide.');

  const verrou = LockService.getScriptLock();
  verrou.waitLock(30000);
  try {
    const { dossier, classeur, journal } = ressources_();
    const fuseau = Session.getScriptTimeZone();
    const maintenant = new Date();
    const horodatage = Utilities.formatDate(maintenant, fuseau, 'yyyy-MM-dd_HHmmss');
    const numero = 'C' + Utilities.formatDate(maintenant, fuseau, 'yyMMdd-HHmmss');

    // Coût unitaire relu côté serveur : on ne fait pas confiance au téléphone.
    const reglages = getReglages();
    const fiche = reglages.objets.find(o => o.nom === objet);
    const coutUnitaire = fiche ? fiche.cout : 0;
    const categorie = fiche ? fiche.categorie : '';
    const coutTotal = Math.round(coutUnitaire * quantite * 100) / 100;

    const lieu = texte_(d.lieu, 60);
    const cause = texte_(d.cause, 60);
    const declarant = texte_(d.declarant, 60);
    const commentaire = texte_(d.commentaire, 500);
    const service = d.service === 'Soir' ? 'Soir' : 'Midi';

    // 1. Photo, rangée par mois.
    let urlPhoto = '';
    if (d.photo) {
      const sousDossier = sousDossier_(dossier, Utilities.formatDate(maintenant, fuseau, 'yyyy-MM'));
      const nomFichier = horodatage + '_' + slug_(objet) + '_x' + quantite + '.jpg';
      const blob = Utilities.newBlob(Utilities.base64Decode(d.photo), 'image/jpeg', nomFichier);
      const fichier = sousDossier.createFile(blob);
      fichier.setDescription(
        [numero, objet + ' x' + quantite, lieu, cause, commentaire].filter(Boolean).join(' | ')
      );
      urlPhoto = fichier.getUrl();
    }

    // 2. Ligne du registre.
    const registre = classeur.getSheetByName('Registre');
    registre.appendRow([
      numero, maintenant, maintenant, service, objet, quantite,
      coutUnitaire, coutTotal, lieu, cause, declarant, commentaire, '', categorie,
    ]);
    // Lien cliquable « Voir la photo » : un vrai lien plutôt qu'une formule =HYPERLINK,
    // dont la syntaxe change selon la langue du classeur (virgule ou point-virgule).
    if (urlPhoto) registre.getRange(registre.getLastRow(), 13).setRichTextValue(lienPhoto_(urlPhoto));

    // 3. Ligne du journal texte.
    const ligne = [
      numero,
      Utilities.formatDate(maintenant, fuseau, 'dd/MM/yyyy HH:mm'),
      service,
      objet + ' x' + quantite,
      coutTotal.toFixed(2) + ' €',
      lieu || '-', cause || '-', declarant || '-',
      commentaire.replace(/\s+/g, ' ') || '-',
      urlPhoto || 'sans photo',
    ].join(' | ');
    journal.setContent(journal.getBlob().getDataAsString('UTF-8') + ligne + '\n');

    return { numero, urlPhoto, coutTotal };
  } finally {
    verrou.releaseLock();
  }
}

/** Bilan du mois en cours (ou du mois « yyyy-MM » demandé), pour l'application. */
function getBilan(mois) {
  const fuseau = Session.getScriptTimeZone();
  const cible = mois || Utilities.formatDate(new Date(), fuseau, 'yyyy-MM');
  const entrees = lireRegistre_().filter(e => Utilities.formatDate(e.date, fuseau, 'yyyy-MM') === cible);
  return Object.assign({ mois: cible }, agreger_(entrees));
}

/**
 * Toutes les casses du registre, sous forme d'objets, pour les bilans.
 * Volontairement anonyme : la colonne « Déclaré par » n'est pas lue, elle reste dans le registre.
 */
function lireRegistre_() {
  const feuille = ressources_().classeur.getSheetByName('Registre');
  const valeurs = feuille.getDataRange().getValues();
  const liens = urlsPhotos_(feuille);
  let categories = null; // objet -> catégorie actuelle, pour les lignes sans catégorie
  const entrees = [];
  for (let i = 1; i < valeurs.length; i++) {
    const l = valeurs[i];
    if (!(l[1] instanceof Date)) continue;
    let categorie = String(l[13] || '').trim();
    if (!categorie) {
      categories = categories || Object.fromEntries(getReglages().objets.map(o => [o.nom, o.categorie]));
      categorie = categories[String(l[4])] || categorieParDefaut_(l[4]);
    }
    entrees.push({ categorie,
      numero: String(l[0]), date: l[1], service: String(l[3]), objet: String(l[4]),
      quantite: Number(l[5]) || 0, cout: Number(l[7]) || 0,
      lieu: String(l[8]), cause: String(l[9]),
      commentaire: String(l[11]), urlPhoto: liens[i] || '',
    });
  }
  return entrees;
}

function agreger_(entrees) {
  const bilan = { declarations: 0, pieces: 0, cout: 0, parCategorie: {}, parObjet: {}, parLieu: {}, parCause: {} };
  entrees.forEach(e => {
    bilan.declarations++;
    bilan.pieces += e.quantite;
    bilan.cout += e.cout;
    ajouter_(bilan.parCategorie, e.categorie, e.quantite, e.cout);
    ajouter_(bilan.parObjet, e.objet, e.quantite, e.cout);
    ajouter_(bilan.parLieu, e.lieu || 'Non précisé', e.quantite, e.cout);
    ajouter_(bilan.parCause, e.cause || 'Non précisée', e.quantite, e.cout);
  });
  bilan.cout = Math.round(bilan.cout * 100) / 100;
  return bilan;
}

/* ------------------------------------------------------------------ */
/* Récapitulatifs par e-mail (informatifs) : chaque lundi, chaque 1er  */
/* ------------------------------------------------------------------ */

/** À lancer une fois depuis l'éditeur : programme l'envoi chaque lundi matin. */
function installerRecapLundi() {
  supprimerRecapLundi();
  ScriptApp.newTrigger('envoyerRecapHebdo')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(CONFIG.HEURE_RECAP)
    .create();
  Logger.log('Récapitulatif hebdomadaire programmé chaque lundi vers ' + CONFIG.HEURE_RECAP + ' h, pour : ' + destinataires_());
}

/** Arrête l'envoi automatique du lundi. */
function supprimerRecapLundi() {
  supprimerDeclencheurs_('envoyerRecapHebdo');
}

/** À lancer une fois depuis l'éditeur : programme l'envoi le 1er de chaque mois. */
function installerRecapMensuel() {
  supprimerRecapMensuel();
  ScriptApp.newTrigger('envoyerRecapMensuel')
    .timeBased()
    .onMonthDay(1)
    .atHour(CONFIG.HEURE_RECAP)
    .create();
  Logger.log('Récapitulatif mensuel programmé le 1er de chaque mois vers ' + CONFIG.HEURE_RECAP + ' h, pour : ' + destinataires_());
}

/** Arrête l'envoi automatique du 1er du mois. */
function supprimerRecapMensuel() {
  supprimerDeclencheurs_('envoyerRecapMensuel');
}

function supprimerDeclencheurs_(fonction) {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === fonction)
    .forEach(t => ScriptApp.deleteTrigger(t));
}

/**
 * Bilan de la semaine écoulée (du lundi 0 h au dimanche 24 h).
 * Appelée automatiquement le lundi ; peut aussi être lancée à la main pour essayer.
 */
function envoyerRecapHebdo() {
  const fuseau = Session.getScriptTimeZone();
  const jour = 24 * 3600 * 1000;

  // Lundi de la semaine en cours, à minuit (heure du script).
  const lundi = minuit_(new Date(), fuseau);
  lundi.setDate(lundi.getDate() - (lundi.getDay() + 6) % 7);
  const debut = new Date(lundi.getTime() - 7 * jour);
  const debutPrecedent = new Date(lundi.getTime() - 14 * jour);
  const dimanche = new Date(lundi.getTime() - jour);

  envoyerRecap_({
    titre: 'Casse de la semaine',
    periode: 'du ' + Utilities.formatDate(debut, fuseau, 'dd/MM') +
      ' au ' + Utilities.formatDate(dimanche, fuseau, 'dd/MM/yyyy'),
    cette: 'cette semaine',
    precedente: 'la semaine précédente',
    debut, fin: lundi, debutPrecedent,
    photos: CONFIG.PHOTOS_DANS_RECAP,
  });
}

/**
 * Bilan du mois écoulé, avec répartition midi/soir, par semaine et évolution sur plusieurs mois.
 * Appelée automatiquement le 1er du mois ; peut aussi être lancée à la main pour essayer.
 */
function envoyerRecapMensuel() {
  const fuseau = Session.getScriptTimeZone();
  const fin = minuit_(new Date(), fuseau);
  fin.setDate(1);                                  // 1er du mois en cours
  const debut = decalerMois_(fin, -1);             // 1er du mois écoulé
  const debutPrecedent = decalerMois_(fin, -2);

  envoyerRecap_({
    titre: 'Casse du mois',
    periode: nomMois_(debut),
    cette: 'ce mois-ci',
    precedente: 'le mois précédent',
    debut, fin, debutPrecedent,
    photos: 0,
    mensuel: true,
  });
}

/** Construit et envoie un récapitulatif à partir de la description de sa période. */
function envoyerRecap_(r) {
  const fuseau = Session.getScriptTimeZone();
  const registre = lireRegistre_();
  const dans = (e, a, b) => e.date >= a && e.date < b;

  r.entrees = registre.filter(e => dans(e, r.debut, r.fin)).sort((a, b) => a.date - b.date);
  r.bilan = agreger_(r.entrees);
  r.avant = agreger_(registre.filter(e => dans(e, r.debutPrecedent, r.debut)));
  if (!r.bilan.declarations && !CONFIG.RECAP_SI_AUCUNE_CASSE) return;

  if (r.mensuel) {
    r.parService = {};
    r.entrees.forEach(e => ajouter_(r.parService, e.service || 'Non précisé', e.quantite, e.cout));

    // Semaines du mois, numérotées par leur lundi.
    r.parSemaine = [];
    r.entrees.forEach(e => {
      const lundi = minuit_(e.date, fuseau);
      lundi.setDate(lundi.getDate() - (lundi.getDay() + 6) % 7);
      const cle = 'Semaine du ' + Utilities.formatDate(lundi, fuseau, 'dd/MM');
      let ligne = r.parSemaine.find(x => x[0] === cle);
      if (!ligne) r.parSemaine.push(ligne = [cle, { pieces: 0, cout: 0 }]);
      ligne[1].pieces += e.quantite;
      ligne[1].cout = Math.round((ligne[1].cout + e.cout) * 100) / 100;
    });

    // Évolution : les N derniers mois, du plus ancien au mois écoulé.
    r.evolution = [];
    for (let k = CONFIG.MOIS_HISTORIQUE - 1; k >= 0; k--) {
      const a = decalerMois_(r.debut, -k);
      const b = agreger_(registre.filter(e => dans(e, a, decalerMois_(a, 1))));
      r.evolution.push([nomMois_(a), { pieces: b.pieces, cout: b.cout }]);
    }
  }

  const de = r.mensuel ? (/^[aeiouéh]/i.test(r.periode) ? "d'" : 'de ') : '';
  r.sujet = 'Casse ' + de + r.periode + ' : ' + (r.bilan.declarations
    ? pluriel_(r.bilan.pieces, 'pièce') + ', ' + euros_(r.bilan.cout)
    : 'aucune casse déclarée');

  // Photos intégrées à l'e-mail (dans l'ordre chronologique, limitées en nombre).
  const images = {};
  let nbPhotos = 0;
  r.entrees.forEach(e => {
    const id = /\/d\/([^/]+)/.exec(e.urlPhoto);
    if (!id || nbPhotos >= r.photos) return;
    try {
      images['photo' + nbPhotos] = DriveApp.getFileById(id[1]).getBlob();
      e.cid = 'photo' + nbPhotos++;
    } catch (err) {
      // Photo supprimée entre-temps : on garde le simple lien.
    }
  });

  r.urlClasseur = ressources_().classeur.getUrl();
  MailApp.sendEmail({
    to: destinataires_(),
    subject: r.sujet,
    htmlBody: htmlRecap_(r, fuseau),
    body: texteRecap_(r, fuseau),
    inlineImages: images,
    name: 'Suivi de la casse',
  });
}

function destinataires_() {
  return CONFIG.EMAILS_RECAP.trim() || Session.getEffectiveUser().getEmail();
}

/** « 12,50 € de plus que la semaine précédente (3 pièces, 9,00 €). » */
function comparaison_(r) {
  const ecart = Math.round((r.bilan.cout - r.avant.cout) * 100) / 100;
  if (!r.avant.declarations && !r.bilan.declarations) return '';
  if (!r.avant.declarations) return 'Aucune casse déclarée ' + r.precedente + '.';
  const rappel = ' (' + pluriel_(r.avant.pieces, 'pièce') + ', ' + euros_(r.avant.cout) + ').';
  if (ecart === 0) return 'Même coût que ' + r.precedente + rappel;
  return (ecart > 0 ? euros_(ecart) + ' de plus' : euros_(-ecart) + ' de moins') +
    ' que ' + r.precedente + rappel;
}

function trier_(table) {
  return Object.keys(table)
    .map(k => [k, table[k]])
    .sort((a, b) => b[1].cout - a[1].cout || b[1].pieces - a[1].pieces);
}

function htmlRecap_(r, fuseau) {
  const h = echapper_;
  const gris = '#7a6f62';
  const td = 'padding:6px 8px;border-bottom:1px solid #e4dccf;';
  const titre = t => '<h3 style="margin:22px 0 6px;font-size:15px;color:' + gris +
    ';text-transform:uppercase;letter-spacing:.04em">' + t + '</h3>';
  const tableau = lignes => '<table style="border-collapse:collapse;width:100%;max-width:520px">' +
    lignes.map(([nom, v]) =>
      '<tr><td style="' + td + '">' + h(nom) + '</td>' +
      '<td style="' + td + 'text-align:right">' + v.pieces + ' pc</td>' +
      '<td style="' + td + 'text-align:right">' + euros_(v.cout) + '</td></tr>').join('') +
    '</table>';
  const quand = e => jourSemaine_(e.date, fuseau) + ' ' + Utilities.formatDate(e.date, fuseau, 'dd/MM HH:mm');
  const b = r.bilan;

  let html = '<div style="font-family:Arial,Helvetica,sans-serif;color:#2b2620;max-width:620px">' +
    '<h2 style="color:#8c2f1b;margin:0 0 4px">' + h(r.titre) + '</h2>' +
    '<p style="margin:0 0 16px;color:' + gris + '">' + h(r.periode) + '</p>';

  if (!b.declarations) {
    html += '<p>Aucune casse n\'a été déclarée ' + h(r.cette) + '.</p>' +
      '<p style="color:' + gris + '">' + h(comparaison_(r)) + '</p>';
  } else {
    const chiffre = (n, l) => '<td style="background:#faf6ef;border-radius:8px;padding:10px 14px;text-align:center">' +
      '<div style="font-size:22px;font-weight:bold">' + n + '</div><div style="font-size:12px;color:' + gris + '">' + l + '</div></td>';
    html += '<table style="border-collapse:separate;border-spacing:6px 0"><tr>' +
      chiffre(b.declarations, b.declarations > 1 ? 'déclarations' : 'déclaration') +
      chiffre(b.pieces, b.pieces > 1 ? 'pièces' : 'pièce') + chiffre(euros_(b.cout), 'coût') +
      '</tr></table>' +
      '<p style="color:' + gris + '">' + h(comparaison_(r)) + '</p>' +
      titre('Par catégorie') + tableau(trier_(b.parCategorie)) +
      titre('Par objet') + tableau(trier_(b.parObjet)) +
      titre('Par lieu') + tableau(trier_(b.parLieu)) +
      titre('Par cause') + tableau(trier_(b.parCause));

    if (r.mensuel) {
      html += titre('Midi et soir') + tableau(trier_(r.parService)) +
        titre('Par semaine') + tableau(r.parSemaine);
    }
  }

  if (r.mensuel) {
    html += titre('Évolution sur ' + r.evolution.length + ' mois') + tableau(r.evolution);
  }

  if (b.declarations && r.mensuel) {
    // Détail compact : une ligne par casse, photo en lien.
    html += titre('Détail') + '<table style="border-collapse:collapse;width:100%;font-size:13px">' +
      r.entrees.map(e => '<tr>' +
        '<td style="' + td + 'white-space:nowrap;color:' + gris + '">' + h(quand(e)) + '</td>' +
        '<td style="' + td + '"><strong>' + h(e.objet) + ' x' + e.quantite + '</strong><br>' +
        h([e.lieu, e.cause].filter(Boolean).join(' · ')) +
        (e.commentaire ? '<br><em>' + h(e.commentaire) + '</em>' : '') + '</td>' +
        '<td style="' + td + 'text-align:right;white-space:nowrap">' + euros_(e.cout) +
        (e.urlPhoto ? '<br><a href="' + h(e.urlPhoto) + '" style="color:#8c2f1b">photo</a>' : '') + '</td>' +
        '</tr>').join('') + '</table>';
  } else if (b.declarations) {
    // Détail hebdomadaire : une fiche par casse, photo intégrée.
    html += titre('Détail');
    r.entrees.forEach(e => {
      const infos = [e.lieu, e.cause].filter(Boolean).join(' · ');
      html += '<div style="border-top:1px solid #e4dccf;padding:10px 0">' +
        (e.cid ? '<a href="' + h(e.urlPhoto) + '"><img src="cid:' + e.cid + '" width="140" ' +
          'style="float:right;margin-left:10px;border-radius:6px" alt="Photo"></a>' : '') +
        '<strong>' + h(e.objet) + ' x' + e.quantite + '</strong> · ' + euros_(e.cout) + '<br>' +
        '<span style="color:' + gris + ';font-size:13px">' +
        h(quand(e)) + ' (' + h(e.service) + ') · n° ' + h(e.numero) + '</span><br>' +
        (infos ? h(infos) + '<br>' : '') +
        (e.commentaire ? '<em>' + h(e.commentaire) + '</em><br>' : '') +
        (!e.cid && e.urlPhoto ? '<a href="' + h(e.urlPhoto) + '">Voir la photo</a>' : '') +
        '<div style="clear:both"></div></div>';
    });
  }

  return html + '<p style="margin-top:24px"><a href="' + h(r.urlClasseur) + '" style="color:#8c2f1b">' +
    'Ouvrir le registre complet</a></p></div>';
}

/** Version texte, pour les messageries qui n'affichent pas le HTML. */
function texteRecap_(r, fuseau) {
  const b = r.bilan;
  const lignes = (titre, liste) => {
    l.push('', titre.toUpperCase());
    liste.forEach(([n, v]) => l.push('- ' + n + ' : ' + v.pieces + ' pc, ' + euros_(v.cout)));
  };
  const l = [(r.titre + ' : ' + r.periode).toUpperCase(), ''];
  if (!b.declarations) {
    l.push('Aucune casse déclarée ' + r.cette + '.');
    if (comparaison_(r)) l.push(comparaison_(r));
  } else {
    l.push(pluriel_(b.declarations, 'déclaration') + ', ' + pluriel_(b.pieces, 'pièce') + ', ' + euros_(b.cout));
    l.push(comparaison_(r));
    lignes('Par catégorie', trier_(b.parCategorie));
    lignes('Par objet', trier_(b.parObjet));
    lignes('Par lieu', trier_(b.parLieu));
    lignes('Par cause', trier_(b.parCause));
    if (r.mensuel) {
      lignes('Midi et soir', trier_(r.parService));
      lignes('Par semaine', r.parSemaine);
    }
  }
  if (r.mensuel) lignes('Évolution sur ' + r.evolution.length + ' mois', r.evolution);
  if (b.declarations) {
    l.push('', 'DÉTAIL');
    r.entrees.forEach(e => l.push('- ' + Utilities.formatDate(e.date, fuseau, 'dd/MM HH:mm') + ' ' +
      e.objet + ' x' + e.quantite + ' (' + euros_(e.cout) + ') ' +
      [e.lieu, e.cause].filter(Boolean).join(', ') + (e.urlPhoto ? ' ' + e.urlPhoto : '')));
  }
  l.push('', 'Registre complet : ' + r.urlClasseur);
  return l.join('\n');
}

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

function ajouter_(table, cle, q, c) {
  const k = String(cle);
  table[k] = table[k] || { pieces: 0, cout: 0 };
  table[k].pieces += q;
  table[k].cout = Math.round((table[k].cout + c) * 100) / 100;
}

function euros_(n) {
  return n.toFixed(2).replace('.', ',') + ' €';
}

/** Minuit du jour de « date », dans le fuseau du script. */
function minuit_(date, fuseau) {
  return new Date(Utilities.formatDate(date, fuseau, "yyyy-MM-dd'T'00:00:00"));
}

/** 1er du mois décalé de « n » mois (date supposée être un 1er du mois). */
function decalerMois_(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

function nomMois_(date) {
  const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
    'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return mois[date.getMonth()] + ' ' + date.getFullYear();
}

function pluriel_(n, mot) {
  return n + ' ' + mot + (n > 1 ? 's' : '');
}

function jourSemaine_(date, fuseau) {
  const jours = ['', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
  return jours[Number(Utilities.formatDate(date, fuseau, 'u'))];
}

function echapper_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sousDossier_(parent, nom) {
  const it = parent.getFoldersByName(nom);
  return it.hasNext() ? it.next() : parent.createFolder(nom);
}

/** Texte nettoyé et tronqué ; neutralise les formules (=, +, -, @) dans le classeur. */
function texte_(v, max) {
  const s = String(v == null ? '' : v).trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function slug_(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
