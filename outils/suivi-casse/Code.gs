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
  // Récapitulatif hebdomadaire : destinataires séparés par des virgules.
  // Vide = l'adresse du compte qui a installé le script.
  EMAILS_RECAP: '',
  // Heure (0-23) d'envoi le lundi. Google envoie dans l'heure qui suit (8 = entre 8 h et 9 h).
  HEURE_RECAP: 8,
  // Envoyer aussi l'e-mail quand aucune casse n'a été déclarée dans la semaine.
  RECAP_SI_AUCUNE_CASSE: true,
  // Nombre maximal de photos affichées dans l'e-mail (les suivantes en simple lien).
  PHOTOS_DANS_RECAP: 12,
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

/** Bilan du mois en cours (ou du mois « yyyy-MM » demandé), pour l'application. */
function getBilan(mois) {
  const fuseau = Session.getScriptTimeZone();
  const cible = mois || Utilities.formatDate(new Date(), fuseau, 'yyyy-MM');
  const entrees = lireRegistre_().filter(e => Utilities.formatDate(e.date, fuseau, 'yyyy-MM') === cible);
  return Object.assign({ mois: cible }, agreger_(entrees));
}

/** Toutes les casses du registre, sous forme d'objets. */
function lireRegistre_() {
  const plage = ressources_().classeur.getSheetByName('Registre').getDataRange();
  const valeurs = plage.getValues();
  const formules = plage.getFormulas();
  const entrees = [];
  for (let i = 1; i < valeurs.length; i++) {
    const l = valeurs[i];
    if (!(l[1] instanceof Date)) continue;
    const lien = /HYPERLINK\("([^"]+)"/i.exec(formules[i][12] || '');
    entrees.push({
      numero: String(l[0]), date: l[1], service: String(l[3]), objet: String(l[4]),
      quantite: Number(l[5]) || 0, cout: Number(l[7]) || 0,
      lieu: String(l[8]), cause: String(l[9]), declarant: String(l[10]),
      commentaire: String(l[11]), urlPhoto: lien ? lien[1] : '',
    });
  }
  return entrees;
}

function agreger_(entrees) {
  const bilan = { declarations: 0, pieces: 0, cout: 0, parObjet: {}, parLieu: {}, parCause: {} };
  entrees.forEach(e => {
    bilan.declarations++;
    bilan.pieces += e.quantite;
    bilan.cout += e.cout;
    ajouter_(bilan.parObjet, e.objet, e.quantite, e.cout);
    ajouter_(bilan.parLieu, e.lieu || 'Non précisé', e.quantite, e.cout);
    ajouter_(bilan.parCause, e.cause || 'Non précisée', e.quantite, e.cout);
  });
  bilan.cout = Math.round(bilan.cout * 100) / 100;
  return bilan;
}

/* ------------------------------------------------------------------ */
/* Récapitulatif du lundi par e-mail                                   */
/* ------------------------------------------------------------------ */

/** À lancer une fois depuis l'éditeur : programme l'envoi chaque lundi matin. */
function installerRecapLundi() {
  supprimerRecapLundi();
  ScriptApp.newTrigger('envoyerRecapHebdo')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(CONFIG.HEURE_RECAP)
    .create();
  Logger.log('Récapitulatif programmé chaque lundi vers ' + CONFIG.HEURE_RECAP + ' h, pour : ' + destinataires_());
}

/** Arrête l'envoi automatique du lundi. */
function supprimerRecapLundi() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'envoyerRecapHebdo')
    .forEach(t => ScriptApp.deleteTrigger(t));
}

/**
 * Envoie le bilan de la semaine écoulée (du lundi 0 h au dimanche 24 h).
 * Appelée automatiquement le lundi ; peut aussi être lancée à la main pour essayer.
 */
function envoyerRecapHebdo() {
  const fuseau = Session.getScriptTimeZone();
  const jour = 24 * 3600 * 1000;

  // Lundi de la semaine en cours, à minuit (heure du script).
  const lundi = new Date(Utilities.formatDate(new Date(), fuseau, "yyyy-MM-dd'T'00:00:00"));
  lundi.setDate(lundi.getDate() - (lundi.getDay() + 6) % 7);
  const debut = new Date(lundi.getTime() - 7 * jour);
  const debutPrecedente = new Date(lundi.getTime() - 14 * jour);

  const registre = lireRegistre_();
  const dans = (e, a, b) => e.date >= a && e.date < b;
  const semaine = registre.filter(e => dans(e, debut, lundi)).sort((a, b) => a.date - b.date);
  const precedente = agreger_(registre.filter(e => dans(e, debutPrecedente, debut)));
  const bilan = agreger_(semaine);

  if (!bilan.declarations && !CONFIG.RECAP_SI_AUCUNE_CASSE) return;

  const dimanche = new Date(lundi.getTime() - jour);
  const periode = 'du ' + Utilities.formatDate(debut, fuseau, 'dd/MM') +
    ' au ' + Utilities.formatDate(dimanche, fuseau, 'dd/MM/yyyy');
  const sujet = bilan.declarations
    ? 'Casse ' + periode + ' : ' + pluriel_(bilan.pieces, 'pièce') + ', ' + euros_(bilan.cout)
    : 'Casse ' + periode + ' : aucune casse déclarée';

  // Photos intégrées à l'e-mail (les plus récentes en dernier, limitées en nombre).
  const images = {};
  let nbPhotos = 0;
  semaine.forEach(e => {
    const id = /\/d\/([^/]+)/.exec(e.urlPhoto);
    if (!id || nbPhotos >= CONFIG.PHOTOS_DANS_RECAP) return;
    try {
      e.cid = 'photo' + nbPhotos;
      images[e.cid] = DriveApp.getFileById(id[1]).getBlob();
      nbPhotos++;
    } catch (err) {
      delete e.cid; // photo supprimée entre-temps : on garde le simple lien
    }
  });

  const urlClasseur = ressources_().classeur.getUrl();
  MailApp.sendEmail({
    to: destinataires_(),
    subject: sujet,
    htmlBody: htmlRecap_(periode, bilan, precedente, semaine, urlClasseur, fuseau),
    body: texteRecap_(periode, bilan, precedente, semaine, urlClasseur, fuseau),
    inlineImages: images,
    name: 'Suivi de la casse',
  });
}

function destinataires_() {
  return CONFIG.EMAILS_RECAP.trim() || Session.getEffectiveUser().getEmail();
}

/** « +12,50 € de plus que la semaine précédente », etc. */
function comparaison_(bilan, precedente) {
  const ecart = Math.round((bilan.cout - precedente.cout) * 100) / 100;
  if (!precedente.declarations && !bilan.declarations) return '';
  if (ecart === 0) return 'Même coût que la semaine précédente.';
  return (ecart > 0 ? euros_(ecart) + ' de plus' : euros_(-ecart) + ' de moins') +
    ' que la semaine précédente (' + pluriel_(precedente.pieces, 'pièce') + ', ' + euros_(precedente.cout) + ').';
}

function trier_(table) {
  return Object.keys(table)
    .map(k => [k, table[k]])
    .sort((a, b) => b[1].cout - a[1].cout || b[1].pieces - a[1].pieces);
}

function htmlRecap_(periode, bilan, precedente, semaine, urlClasseur, fuseau) {
  const h = echapper_;
  const td = 'padding:6px 8px;border-bottom:1px solid #e4dccf;';
  const titre = t => '<h3 style="margin:22px 0 6px;font-size:15px;color:#7a6f62;text-transform:uppercase;letter-spacing:.04em">' + t + '</h3>';
  const tableau = table => '<table style="border-collapse:collapse;width:100%;max-width:520px">' +
    trier_(table).map(([nom, v]) =>
      '<tr><td style="' + td + '">' + h(nom) + '</td>' +
      '<td style="' + td + 'text-align:right">' + v.pieces + ' pc</td>' +
      '<td style="' + td + 'text-align:right">' + euros_(v.cout) + '</td></tr>').join('') +
    '</table>';

  let html = '<div style="font-family:Arial,Helvetica,sans-serif;color:#2b2620;max-width:620px">' +
    '<h2 style="color:#8c2f1b;margin:0 0 4px">Casse de la semaine</h2>' +
    '<p style="margin:0 0 16px;color:#7a6f62">' + h(periode) + '</p>';

  if (!bilan.declarations) {
    html += '<p>Aucune casse n\'a été déclarée cette semaine.</p>' +
      (precedente.declarations ? '<p style="color:#7a6f62">' + h(comparaison_(bilan, precedente)) + '</p>' : '');
  } else {
    const chiffre = (n, l) => '<td style="background:#faf6ef;border-radius:8px;padding:10px 14px;text-align:center">' +
      '<div style="font-size:22px;font-weight:bold">' + n + '</div><div style="font-size:12px;color:#7a6f62">' + l + '</div></td>';
    html += '<table style="border-collapse:separate;border-spacing:6px 0"><tr>' +
      chiffre(bilan.declarations, bilan.declarations > 1 ? 'déclarations' : 'déclaration') +
      chiffre(bilan.pieces, bilan.pieces > 1 ? 'pièces' : 'pièce') + chiffre(euros_(bilan.cout), 'coût') +
      '</tr></table>' +
      '<p style="color:#7a6f62">' + h(comparaison_(bilan, precedente)) + '</p>' +
      titre('Par objet') + tableau(bilan.parObjet) +
      titre('Par lieu') + tableau(bilan.parLieu) +
      titre('Par cause') + tableau(bilan.parCause) +
      titre('Détail');
    semaine.forEach(e => {
      const infos = [e.lieu, e.cause, e.declarant ? 'déclaré par ' + e.declarant : ''].filter(Boolean).join(' · ');
      html += '<div style="border-top:1px solid #e4dccf;padding:10px 0">' +
        (e.cid ? '<a href="' + h(e.urlPhoto) + '"><img src="cid:' + e.cid + '" width="140" ' +
          'style="float:right;margin-left:10px;border-radius:6px" alt="Photo"></a>' : '') +
        '<strong>' + h(e.objet) + ' x' + e.quantite + '</strong> · ' + euros_(e.cout) + '<br>' +
        '<span style="color:#7a6f62;font-size:13px">' +
        h(jourSemaine_(e.date, fuseau) + ' ' + Utilities.formatDate(e.date, fuseau, 'dd/MM HH:mm')) + ' (' + h(e.service) + ') · n° ' + h(e.numero) +
        '</span><br>' + (infos ? h(infos) + '<br>' : '') +
        (e.commentaire ? '<em>' + h(e.commentaire) + '</em><br>' : '') +
        (!e.cid && e.urlPhoto ? '<a href="' + h(e.urlPhoto) + '">Voir la photo</a>' : '') +
        '<div style="clear:both"></div></div>';
    });
  }
  return html + '<p style="margin-top:24px"><a href="' + h(urlClasseur) + '" style="color:#8c2f1b">' +
    'Ouvrir le registre complet</a></p></div>';
}

/** Version texte, pour les messageries qui n'affichent pas le HTML. */
function texteRecap_(periode, bilan, precedente, semaine, urlClasseur, fuseau) {
  const l = ['CASSE DE LA SEMAINE ' + periode.toUpperCase(), ''];
  if (!bilan.declarations) {
    l.push('Aucune casse déclarée cette semaine.');
  } else {
    l.push(pluriel_(bilan.declarations, 'déclaration') + ', ' + pluriel_(bilan.pieces, 'pièce') + ', ' + euros_(bilan.cout));
    l.push(comparaison_(bilan, precedente), '', 'PAR OBJET');
    trier_(bilan.parObjet).forEach(([n, v]) => l.push('- ' + n + ' : ' + v.pieces + ' pc, ' + euros_(v.cout)));
    l.push('', 'DÉTAIL');
    semaine.forEach(e => l.push('- ' + Utilities.formatDate(e.date, fuseau, 'dd/MM HH:mm') + ' ' +
      e.objet + ' x' + e.quantite + ' (' + euros_(e.cout) + ') ' +
      [e.lieu, e.cause, e.declarant].filter(Boolean).join(', ') + (e.urlPhoto ? ' ' + e.urlPhoto : '')));
  }
  l.push('', 'Registre complet : ' + urlClasseur);
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
