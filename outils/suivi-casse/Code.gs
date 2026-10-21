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
  // Code à 4 chiffres demandé avant chaque déclaration. Laisser vide pour ne pas en demander.
  CODE_PIN: '',
  // Heure (0-23) à partir de laquelle on considère que c'est le service du soir.
  HEURE_SERVICE_SOIR: 16,
};

const ENTETES_REGISTRE = [
  'N°', 'Horodatage', 'Date', 'Service', 'Objet', 'Quantité',
  'Coût unitaire (€)', 'Coût total (€)', 'Lieu', 'Cause',
  'Déclaré par', 'Commentaire', 'Photo',
];

// Valeurs de départ de l'onglet Réglages (à adapter). Coûts à 0 : à renseigner.
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
  Logger.log('Dossier : ' + r.dossier.getUrl());
  Logger.log('Classeur : ' + r.classeur.getUrl());
  Logger.log('Journal : ' + r.journal.getUrl());
}

/** Retrouve (ou recrée s'ils ont disparu) le dossier, le classeur et le journal. */
function ressources_() {
  const props = PropertiesService.getScriptProperties();

  let dossier = parId_(props.getProperty('DOSSIER_ID'), id => DriveApp.getFolderById(id));
  if (!dossier) {
    dossier = DriveApp.createFolder(CONFIG.NOM_DOSSIER);
    props.setProperty('DOSSIER_ID', dossier.getId());
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
  const lignes = [['Objet', 'Coût unitaire (€)', '', 'Lieu', 'Cause', 'Personnel']];
  for (let i = 0; i < n; i++) {
    lignes.push([
      d.objets[i] || '', d.objets[i] ? 0 : '', '',
      d.lieux[i] || '', d.causes[i] || '', d.personnel[i] || '',
    ]);
  }
  reglages.getRange(1, 1, lignes.length, 6).setValues(lignes);
  reglages.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#f3ede2');
  reglages.getRange('B:B').setNumberFormat('0.00 €');
  reglages.setFrozenRows(1);
  reglages.getRange('H1').setValue(
    'Modifiez librement ces listes : l\'application les relit à chaque ouverture. ' +
    'Renseignez le coût d\'achat de chaque objet pour chiffrer la casse.'
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
  const feuille = ressources_().classeur.getSheetByName('Réglages');
  const valeurs = feuille.getDataRange().getValues().slice(1);
  const colonne = i => valeurs.map(l => String(l[i]).trim()).filter(Boolean);
  return {
    objets: valeurs
      .filter(l => String(l[0]).trim())
      .map(l => ({ nom: String(l[0]).trim(), cout: Number(l[1]) || 0 })),
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
        [numero, objet + ' x' + quantite, lieu, cause, declarant, commentaire].filter(Boolean).join(' | ')
      );
      urlPhoto = fichier.getUrl();
    }

    // 2. Ligne du registre.
    classeur.getSheetByName('Registre').appendRow([
      numero, maintenant, maintenant, service, objet, quantite,
      coutUnitaire, coutTotal, lieu, cause, declarant, commentaire,
      urlPhoto ? '=HYPERLINK("' + urlPhoto + '","Voir la photo")' : '',
    ]);

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

/** Bilan du mois en cours (ou du mois « yyyy-MM » demandé). */
function getBilan(mois) {
  const fuseau = Session.getScriptTimeZone();
  const cible = mois || Utilities.formatDate(new Date(), fuseau, 'yyyy-MM');
  const lignes = ressources_().classeur.getSheetByName('Registre').getDataRange().getValues().slice(1);

  const bilan = { mois: cible, declarations: 0, pieces: 0, cout: 0, parObjet: {}, parLieu: {}, parCause: {} };
  lignes.forEach(l => {
    if (!(l[1] instanceof Date)) return;
    if (Utilities.formatDate(l[1], fuseau, 'yyyy-MM') !== cible) return;
    const q = Number(l[5]) || 0;
    const c = Number(l[7]) || 0;
    bilan.declarations++;
    bilan.pieces += q;
    bilan.cout += c;
    ajouter_(bilan.parObjet, l[4], q, c);
    ajouter_(bilan.parLieu, l[8] || 'Non précisé', q, c);
    ajouter_(bilan.parCause, l[9] || 'Non précisée', q, c);
  });
  bilan.cout = Math.round(bilan.cout * 100) / 100;
  return bilan;
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
