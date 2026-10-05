# La Cuisine Française / The French Cuisine : site statique bilingue

Langue de travail : **français** (réponses, commentaires, messages de commit). Prose publiable, sans fautes, vocabulaire de cuisine et de terroir précis.

## Le projet
Blog bilingue FR/EN sur l'évolution de la gastronomie française, les terroirs, la cuisine de village et des recettes en 6 ingrédients maximum (textes écrits pour le podcast Polische). Site statique de 42 pages généré par Python : `/fr/`, `/en/`, plus une passerelle de langue à la racine. Voir `README-PROJET.md` pour l'état, les décisions et les points ouverts.

## Reconstruire (à faire après toute modification)
```
python3 build_site.py https://www.example.com   # remplacer par le vrai domaine dès qu'il est choisi
python3 og_playwright.py .                       # images de partage (ou : node og.js). APRÈS le build, qui vide site/
python3 seo_check.py site                        # doit afficher 0 erreur
```
`pip install playwright` + Chromium sont nécessaires pour `og_playwright.py`. Ne jamais modifier `site/` à la main : il est régénéré.

## Où modifier quoi
- Recettes et terroirs : `data-fr.json`, `data-en.json` (mêmes `id` dans les deux langues).
- Bibliothèque (ouvrages de référence) : `library-fr.json`, `library-en.json`.
- Textes des autres pages (manifeste, histoire, essai, FAQ, mentions, sources, accueil) : `village-table-fr.html`, `village-table.html` (blocs `<div class="page" data-page="...">`).
- Titres/descriptions SEO : dict `META` de `build_site.py` (titre 25-65 caractères, description 70-160). Pour la Bibliothèque : champ `meta` du JSON.
- Filtres de recettes : `RECIPE_FACETS` et `FACETS` dans `build_site.py`.

## Règle : un nouveau texte = une page de la Bibliothèque
Quand un texte est ajouté dans `sources/` (ou collé dans la conversation), créer **une page**, en français et en anglais :
1. Ajouter un objet dans `items` de `library-fr.json` ET `library-en.json`, avec le **même `id`** et les **mêmes blocs dans le même ordre** : `id`, `doc` (nom du texte), `slug` (propre à chaque langue), `title`, `sub`, `meta` [titre SEO, description], `source` (auteur, titre, éditeur, année), `blocks`.
2. Blocs : `{"t":"h2","x":""}`, `{"t":"h3","x":""}`, `{"t":"p","x":""}`, `{"t":"list","items":[""]}`, `{"t":"dishes","items":[["Nom","description"]]}`. HTML autorisé : `<em>`, `<strong>`. Pas de Markdown.
3. Reprendre fidèlement le contenu (rien d'inventé), corriger les fautes de frappe. Les espaces insécables françaises sont ajoutées par le générateur : ne pas les saisir. De même, l'apostrophe droite ' est convertie en ’ à la génération : saisir l'apostrophe droite.
4. Reconstruire, auditer (0 erreur), puis committer.

## Règles éditoriales
- Règle des 6 ingrédients : tout compte (sel, poivre, huile, beurre, vin, cidre) sauf l'eau.
- Noms : « La Cuisine Française » (FR), « The French Cuisine » (EN).
- Pas de cookie ni de mesure d'audience (si ajout : mettre à jour la FAQ et les mentions légales).
- Les résumés d'ouvrages sont sous droit d'auteur : toujours citer la source en bas de page et sur la page Sources.
- Les recettes ne sont pas testées : ne pas affirmer le contraire.

## Points ouverts (ne pas les inventer)
Domaine, hébergeur, éditeur et e-mail des mentions légales (champs surlignés `todo`), auteur dans les données structurées (`AUTHOR_NAME`), polices Google à héberger soi-même.
