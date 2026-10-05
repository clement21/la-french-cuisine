# Projet « La Cuisine Française / The French Cuisine » : état au 5 octobre 2026

Blog bilingue (FR/EN) sur l'évolution de la gastronomie française, la sauvegarde des goûts de terroir, le retour de la cuisine de village et des recettes modernisées en 6 ingrédients maximum. Textes écrits pour le podcast **Polische**.

## État actuel

- Site statique de 42 pages HTML, généré par `build_site.py` : `/fr/` et `/en/` (accueil, manifeste, histoire, essai, terroirs, recettes + 6 pages recettes, **bibliothèque + 3 pages d'ouvrages**, mon village, FAQ, mentions légales, sources), plus une passerelle de langue à la racine.
- **Bibliothèque** (nouveau, 5 octobre 2026) : une page par ouvrage de référence — La cuisine savoyarde, La gastronomie lyonnaise, Mille et un trucs de cuisine — en français et en anglais, avec menu, fil d'Ariane, SEO, sitemap et références dans la page Sources.
- **Mise à jour automatique** : une tâche planifiée quotidienne compare les documents du projet à `claude/site-manifest.json` et reconstruit le site dès qu'un élément est ajouté ou modifié. Procédure détaillée : `claude/AUTOMATISATION-SITE.md`.
- Design : blanc total, bascule « noir sur blanc / blanc sur noir », menu responsive, ardoise d'accueil. Titre d'accueil animé une seule fois.
- SEO : une URL par page, titre et description uniques, canonical, hreflang FR/EN, Open Graph, JSON-LD (site, fil d'Ariane, article, FAQ, recettes), sitemap, robots.txt, `.htaccess` Apache. Audit : `python3 seo_check.py site` (0 erreur).
- Filtre des recettes (page Recettes) : recherche + moment du repas, type de plat, ingrédient vedette, terroir d'inspiration, nombre d'ingrédients. Sélection partageable par l'adresse (`?moment=grand`).

## Décisions prises

- Noms : « The French Cuisine » (EN) et « La Cuisine Française » (FR). Nom très générique : risque de référencement et de marque signalé.
- Règle des 6 ingrédients : tout compte (sel, poivre, huile, beurre, vin, cidre) sauf l'eau.
- Pas de cookie, pas d'outil de mesure d'audience à ce stade (à mettre à jour dans la FAQ et les mentions légales si une mesure d'audience est ajoutée).
- Un nouveau document « texte » ajouté au projet devient une page de la Bibliothèque (une page par texte), en FR et EN.

## Points ouverts

1. Domaine et hébergeur non choisis : le site utilise `https://www.example.com` à remplacer (voir ci-dessous).
2. Mentions légales à compléter : éditeur, e-mail de contact, hébergeur (champs surlignés).
3. Recettes écrites à partir de plats classiques mais **non testées** : vérifier quantités et temps de cuisson.
4. Classement des recettes par moment, ingrédient vedette et terroir fait par Claude : à valider.
5. Pas de photos de recettes (donc pas de résultat enrichi « Recette ») ; auteur non renseigné dans les données structurées (`AUTHOR_NAME` dans `build_site.py`).
6. Polices chargées depuis Google Fonts (IP transmise à Google) : héberger les .woff2 soi-même.
7. Dates historiques à relire avec la page Sources ; références d'ouvrages (Pitte, Ory, Escoffier) données sans vérification en ligne.
8. **Bibliothèque** : les pages résument des livres sous droit d'auteur (Lansard, Hachette, Couffignal). Vérifier que la publication de ces résumés est acceptable avant la mise en ligne ; la source est citée en bas de chaque page et sur la page Sources. Les traductions anglaises sont de Claude : à relire.

## Fichiers et usage

| Fichier | Rôle |
|---|---|
| `build_site.py` | Générateur du site (dossier `site/`). `python3 build_site.py https://VOTRE-DOMAINE.fr` |
| `data-fr.json`, `data-en.json` | Recettes (ingrédients, étapes) et terroirs, par langue |
| `claude/library-fr.json`, `claude/library-en.json` | Pages de la Bibliothèque (une entrée par ouvrage ; mêmes `id` dans les deux langues) |
| `village-table-fr.html`, `village-table.html` | Sources des textes (manifeste, histoire, essai, FAQ, mentions légales, sources, accueil). Les blocs `<div class="page" data-page="...">` sont repris par le générateur |
| `og.js` / `claude/og_playwright.py` | Images de partage 1200×630 (Node + puppeteer, ou Python + Playwright) |
| `make_preview.py` | Aperçu hors ligne (liens relatifs), dossier `apercu-hors-ligne/` |
| `seo_check.py` | Audit SEO automatique |
| `claude/site-manifest.json` | État du site à la dernière mise à jour automatique (documents pris en compte) |
| `claude/AUTOMATISATION-SITE.md` | Procédure suivie par la tâche planifiée |

Reconstruire : `python3 build_site.py https://VOTRE-DOMAINE.fr` puis `python3 og_playwright.py .` (ou `node og.js`) puis `python3 seo_check.py site`.

## Où modifier quoi

- Recettes et terroirs : `data-*.json`.
- Ouvrages de la Bibliothèque : `library-*.json` (blocs `h2`, `h3`, `p`, `list`, `dishes`).
- Moments, types, ingrédients vedettes, terroirs d'inspiration : `RECIPE_FACETS` et `FACETS` dans `build_site.py`.
- Titres et descriptions SEO : `META` dans `build_site.py` (titre 25 à 65 caractères, description 70 à 160) ; pour la Bibliothèque, champ `meta` des fichiers `library-*.json`.
- Textes des autres pages : `village-table-fr.html` et `village-table.html`.
