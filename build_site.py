import re, json, math, html as H, os, shutil, sys, datetime
HERE = os.path.dirname(os.path.abspath(__file__))

SITE_URL = (sys.argv[1] if len(sys.argv) > 1 else "https://www.example.com").rstrip("/")
BUILD_DATE = datetime.date.today().isoformat()
AUTHOR_NAME = ""          # à renseigner : apparaît dans le JSON-LD Article/Recipe si non vide
OUT = os.path.join(HERE, "site")

# ------------------------------------------------------------------ données
DATA = {l: json.load(open(os.path.join(HERE, "data-%s.json" % l), encoding="utf-8")) for l in ("en", "fr")}
SRC = {"en": open(os.path.join(HERE, "village-table.html"), encoding="utf-8").read(),
       "fr": open(os.path.join(HERE, "village-table-fr.html"), encoding="utf-8").read()}
# Bibliothèque : un fichier library-<lang>.json (ouvrages de référence, une page par ouvrage)
def _lib(l):
    fp = os.path.join(HERE, "library-%s.json" % l)
    return json.load(open(fp, encoding="utf-8")) if os.path.isfile(fp) else {"items": []}
LIB = {l: _lib(l) for l in ("en", "fr")}
LIB_IDS = [i["id"] for i in LIB["fr"]["items"]]
HAS_LIB = bool(LIB_IDS)

ORDER = ["manifesto", "history", "essay", "terroirs", "recipes"] + (["library"] if HAS_LIB else []) + ["village"]
RECIPE_IDS = ["gratin", "lyonnaise", "onion-soup", "mussels", "chicken", "tart"]

PATHS = {
 "en": {"home": "/en/", "manifesto": "/en/manifesto/", "history": "/en/history/", "essay": "/en/essay/",
        "terroirs": "/en/terroirs/", "recipes": "/en/recipes/", "village": "/en/your-village/", "library": "/en/library/",
        "faq": "/en/faq/", "legal": "/en/legal-notice/", "sources": "/en/sources/"},
 "fr": {"home": "/fr/", "manifesto": "/fr/manifeste/", "history": "/fr/histoire/", "essay": "/fr/essai/",
        "terroirs": "/fr/terroirs/", "recipes": "/fr/recettes/", "village": "/fr/mon-village/", "library": "/fr/bibliotheque/",
        "faq": "/fr/faq/", "legal": "/fr/mentions-legales/", "sources": "/fr/sources/"},
}
RSLUG = {
 "en": {"gratin": "potato-gratin", "lyonnaise": "lyonnaise-salad", "onion-soup": "french-onion-soup",
        "mussels": "mussels-with-muscadet", "chicken": "normandy-cider-chicken", "tart": "thin-apple-tart"},
 "fr": {"gratin": "gratin-de-pommes-de-terre", "lyonnaise": "salade-lyonnaise", "onion-soup": "soupe-a-l-oignon-gratinee",
        "mussels": "moules-au-muscadet", "chicken": "poulet-normand-au-cidre", "tart": "tarte-fine-aux-pommes"},
}
for l in PATHS:
    for rid in RECIPE_IDS:
        PATHS[l]["r_" + rid] = PATHS[l]["recipes"] + RSLUG[l][rid] + "/"
    for it in LIB[l]["items"]:
        PATHS[l]["lib_" + it["id"]] = PATHS[l]["library"] + it["slug"] + "/"

L = {
 "en": dict(lang="en", locale="en_GB", brand="The French Cuisine", menu="Menu", skip="Skip to content",
   nav={"manifesto": "Manifesto", "history": "History", "essay": "Essay", "terroirs": "Terroirs", "recipes": "Recipes", "library": "Library", "village": "Your village"},
   home="Home", crumb="Breadcrumb", main_nav="Main menu", other="Français", theme_to_dark="White on black",
   prev="Previous", next="Next", more="More recipes", count="%d of 6 ingredients",
   cook_for="Cooking for", servings_aria="Number of servings", ing="Ingredients for", people="people",
   method="Method", changed="What we changed:", tastes="Tastes worth defending", habit="A village habit to keep",
   cook="Cook it: ", jump="Jump to a region", start="Start cooking", start_aria="Recipes to start with",
   explore_recipes_intro="Classic village dishes, modernised, each with six ingredients or fewer. Choose how many people you are cooking for on each recipe.",
   rule="The rule: salt, pepper, oil and butter all count as ingredients. Water is free, because the village well never charged for it.",
   recipes_h1="Six ingredients or fewer", regions_h1="Eight terroirs, eight tastes to defend",
   regions_p="Eight regions, the tastes worth protecting there, and the village habit that keeps each one alive.",
   foot_site="Site information", foot_p="Taste, terroir and the village kitchen. Written for the Polische podcast on the evolution of gastronomy.",
   foot_links=[("faq", "FAQ"), ("legal", "Legal notice"), ("sources", "Sources")],
   lib_jump="Jump to a section", lib_source="Source", lib_from="Summary of", lib_row_lead="Reference books, summarised: ", lib_sources_h="Library"),
 "fr": dict(lang="fr", locale="fr_FR", brand="La Cuisine Française", menu="Menu", skip="Aller au contenu",
   nav={"manifesto": "Manifeste", "history": "Histoire", "essay": "Essai", "terroirs": "Terroirs", "recipes": "Recettes", "library": "Bibliothèque", "village": "Mon village"},
   home="Accueil", crumb="Fil d'Ariane", main_nav="Menu principal", other="English", theme_to_dark="Blanc sur noir",
   prev="Précédent", next="Suivant", more="Autres recettes", count="%d ingrédients sur 6",
   cook_for="Pour combien de personnes", servings_aria="Nombre de personnes", ing="Ingrédients pour", people="personnes",
   method="Préparation", changed="Ce qui a changé&nbsp;:", tastes="Les goûts qui méritent d'être défendus", habit="Une habitude de village à garder",
   cook="Cuisiner&nbsp;: ", jump="Aller à une région", start="Commencer par une recette", start_aria="Recettes pour commencer",
   explore_recipes_intro="Des plats de village classiques, modernisés, chacun avec six ingrédients au maximum. Choisissez pour combien de personnes vous cuisinez sur chaque recette.",
   rule="La règle&nbsp;: le sel, le poivre, l'huile et le beurre comptent comme des ingrédients. L'eau est gratuite, car le puits du village n'a jamais fait payer personne.",
   recipes_h1="Six ingrédients au maximum", regions_h1="Huit terroirs, huit goûts à défendre",
   regions_p="Huit régions, les goûts qui méritent d'être protégés, et l'habitude de village qui fait vivre chacun.",
   foot_site="Informations sur le site", foot_p="Le goût, le terroir et la cuisine de village. Écrit pour le podcast Polische sur l'évolution de la gastronomie.",
   foot_links=[("faq", "FAQ"), ("legal", "Mentions légales"), ("sources", "Sources")],
   lib_jump="Aller à une section", lib_source="Source", lib_from="Résumé de l'ouvrage", lib_row_lead="Ouvrages de référence résumés&nbsp;: ", lib_sources_h="Bibliothèque"),
}

META = {
 "en": {
  "home": ("The French Cuisine: village cooking and 6-ingredient recipes", "Follow the story of French gastronomy, defend regional tastes and cook modern village recipes with six ingredients or fewer."),
  "manifesto": ("A manifesto for French village cooking | The French Cuisine", "Five promises to bring the village kitchen back: seasonal cooking, endangered tastes, short recipes, visible producers and cooking passed on."),
  "history": ("History of French gastronomy, from La Varenne to UNESCO", "Nine moments that shaped French cooking: La Varenne, Carême, Escoffier, Michelin, appellations, nouvelle cuisine, bistronomy and UNESCO."),
  "essay": ("Why French regional taste is worth saving: an essay", "An essay in four chapters on village kitchens, the grand detour of haute cuisine, vanishing tastes and the case for six-ingredient cooking."),
  "terroirs": ("French regional cuisine: 8 terroirs and the tastes to defend", "Brittany, Normandy, Alsace, Burgundy, Lyon, Provence, the Southwest and Auvergne: the regional tastes worth protecting and the habits that keep them alive."),
  "recipes": ("French village recipes with 6 ingredients or fewer", "Six classic French village dishes in six ingredients or fewer: gratin dauphinois, Lyonnaise salad, onion soup, mussels, cider chicken and apple tart."),
  "village": ("Add the dish of your village | The French Cuisine", "Write down one dish or product from your village that deserves to be cooked again. Your list stays on your own device."),
  "faq": ("FAQ: six-ingredient recipes, allergies and your data", "Answers about the six-ingredient rule, quantities, allergies, cookies, the Polische podcast texts and reusing content."),
  "legal": ("Legal notice | The French Cuisine", "Publisher, host, intellectual property, personal data and cookies for The French Cuisine."),
  "sources": ("Sources and references | The French Cuisine", "The references behind the dates and facts on The French Cuisine: UNESCO, INAO, Michelin, Curnonsky and more."),
  "r_gratin": ("Potato gratin dauphinois: a 6-ingredient recipe", "A gratin dauphinois without cheese or butter. Six ingredients, serves 2 to 6, step-by-step method."),
  "r_lyonnaise": ("Lyonnaise salad recipe with 6 ingredients", "The bouchon classic, where bacon fat replaces the oil. Six ingredients, serves 2 to 6, step-by-step method."),
  "r_onion-soup": ("French onion soup (gratinée): a 6-ingredient recipe", "Onion soup without stock cubes or flour. Six ingredients, serves 2 to 6, step-by-step method."),
  "r_mussels": ("Mussels with Muscadet: a 6-ingredient recipe", "Moules marinières trimmed to what the sea provides. Six ingredients, serves 2 to 6, step-by-step method."),
  "r_chicken": ("Normandy cider chicken: a 6-ingredient recipe", "A vallée d'Auge chicken without flambé or a long shopping list. Six ingredients, serves 2 to 6."),
  "r_tart": ("Thin apple tart (tarte fine): a 5-ingredient recipe", "Tarte fine aux pommes with one sheet of pastry and five ingredients. Serves 2 to 6, step-by-step method."),
 },
 "fr": {
  "home": ("La Cuisine Française : recettes de village en 6 ingrédients", "Suivez l'histoire de la gastronomie française, défendez les goûts régionaux et cuisinez des recettes de village modernisées en six ingrédients au maximum."),
  "manifesto": ("Manifeste pour la cuisine de village | La Cuisine Française", "Cinq engagements pour ramener la cuisine de village : saison, goûts menacés, recettes courtes, producteurs visibles et transmission."),
  "history": ("Histoire de la gastronomie française, de La Varenne à l'UNESCO", "Neuf moments qui ont façonné la cuisine française : La Varenne, Carême, Escoffier, Michelin, appellations, nouvelle cuisine, bistronomie, UNESCO."),
  "essay": ("Pourquoi sauver le goût des terroirs français : un essai", "Un essai en quatre chapitres sur les cuisines de village, le grand détour de la haute cuisine, les goûts qui disparaissent et la cuisine en six ingrédients."),
  "terroirs": ("Cuisine de terroir : 8 régions et leurs goûts à défendre", "Bretagne, Normandie, Alsace, Bourgogne, Lyon, Provence, Sud-Ouest et Auvergne : les goûts régionaux à protéger et les habitudes qui les font vivre."),
  "recipes": ("Recettes de village en 6 ingrédients au maximum", "Six classiques de village en six ingrédients maximum : gratin dauphinois, salade lyonnaise, soupe à l'oignon, moules, poulet au cidre et tarte fine."),
  "village": ("Ajoutez le plat de votre village | La Cuisine Française", "Notez un plat ou un produit de votre village qui mérite d'être cuisiné à nouveau. Votre liste reste sur votre appareil."),
  "faq": ("FAQ : recettes en six ingrédients, allergies et données", "Réponses sur la règle des six ingrédients, les quantités, les allergies, les cookies, les textes du podcast Polische et la réutilisation des contenus."),
  "legal": ("Mentions légales | La Cuisine Française", "Éditeur, hébergeur, propriété intellectuelle, données personnelles et cookies de La Cuisine Française."),
  "sources": ("Sources et références | La Cuisine Française", "Les références derrière les dates et faits de La Cuisine Française : UNESCO, INAO, Michelin, Curnonsky et plus."),
  "r_gratin": ("Gratin dauphinois : recette en 6 ingrédients", "Un gratin dauphinois sans fromage et sans beurre. Six ingrédients, pour 2 à 6 personnes, pas à pas."),
  "r_lyonnaise": ("Salade lyonnaise : recette en 6 ingrédients", "Le classique du bouchon, où la graisse des lardons tient lieu d'huile. Six ingrédients, pour 2 à 6 personnes."),
  "r_onion-soup": ("Soupe à l'oignon gratinée : recette en 6 ingrédients", "Une soupe à l'oignon sans bouillon cube et sans farine. Six ingrédients, pour 2 à 6 personnes, pas à pas."),
  "r_mussels": ("Moules au muscadet : recette en 6 ingrédients", "Des moules marinières réduites à ce que la mer apporte. Six ingrédients, pour 2 à 6 personnes, pas à pas."),
  "r_chicken": ("Poulet normand au cidre : recette en 6 ingrédients", "Un poulet vallée d'Auge sans flambage ni longue liste de courses. Six ingrédients, pour 2 à 6 personnes."),
  "r_tart": ("Tarte fine aux pommes : recette en 5 ingrédients", "Une tarte fine aux pommes avec une abaisse de pâte et cinq ingrédients. Pour 2 à 6 personnes, pas à pas."),
 },
}
for _l in ("en", "fr"):
    if HAS_LIB:
        META[_l]["library"] = tuple(LIB[_l]["meta"])
        for it in LIB[_l]["items"]:
            META[_l]["lib_" + it["id"]] = tuple(it["meta"])

# ------------------------------------------------------------------ outils
def min_css(c):
    c = re.sub(r'/\*.*?\*/', '', c, flags=re.S)
    c = re.sub(r'\s+', ' ', c)
    c = re.sub(r'\s*([{};,])\s*', r'\1', c)
    return c.strip()

def tidy(h):
    h = re.sub(r'<!--.*?-->', '', h, flags=re.S)
    return '\n'.join(l.strip() for l in h.split('\n') if l.strip())

def extract_page(src, name):
    start = src.index('<div class="page" data-page="%s" hidden>' % name)
    gt = src.index('>', start) + 1
    depth, pos = 1, gt
    for m in re.finditer(r'<div\b|</div>', src[gt:]):
        depth += 1 if m.group(0) == '<div' else -1
        if depth == 0:
            return src[gt:gt + m.start()]
    raise ValueError(name)

def rewrite_links(h, lang):
    p = PATHS[lang]
    h = h.replace('href="#/"', 'href="%s"' % p["home"])
    for k in ("manifesto", "history", "essay", "terroirs", "recipes", "library", "village", "faq", "legal", "sources"):
        h = h.replace('href="#/%s"' % k, 'href="%s"' % p[k])
    return h

def fmt(item, servings, lang):
    if item.get("q") is None:
        return item["t"]
    v = item["q"] * servings / 4.0
    unit, name = item.get("u", ""), item["n"]
    if unit == "g" and v >= 1000:
        amount = "%g" % (math.floor(v / 100 + 0.5) / 10)
        if lang == "fr":
            amount = amount.replace(".", ",")
        unit = "kg"
    elif unit in ("g", "ml"):
        amount = str(max(5, int(math.floor(v / 5 + 0.5) * 5)))
    else:
        r = max(0.5, math.floor(v * 2 + 0.5) / 2)
        w = int(math.floor(r))
        amount = (str(w) if w else "") + ("½" if (r - w) >= 0.5 else "")
        if item.get("p") and r > 1:
            name = item["p"]
    return amount + (" " + unit if unit else "") + " " + name

def esc(s):
    return H.escape(s, quote=True)

def plain(s):
    return H.unescape(re.sub(r'<[^>]+>', '', s)).replace('\xa0', ' ')

def url(path):
    return SITE_URL + path

def jsonld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + '</script>'

def typo(s, lang):
    """Typographie française : espace insécable avant : ; ! ? » et après «."""
    if lang != "fr":
        return s
    s = re.sub(r' ([:;!?»])', r'&nbsp;\1', s)
    return s.replace('« ', '«&nbsp;')


RECIPE_FACETS = {
 "gratin":     dict(moment="grand",        type="main",    main="veg",   terroir="dauphine"),
 "lyonnaise":  dict(moment="petit rapide", type="starter", main="meat",  terroir="lyon"),
 "onion-soup": dict(moment="petit grand",  type="starter", main="veg",   terroir="lyon"),
 "mussels":    dict(moment="rapide",       type="main",    main="sea",   terroir="bretagne"),
 "chicken":    dict(moment="grand",        type="main",    main="meat",  terroir="normandie"),
 "tart":       dict(moment="grand",        type="dessert", main="fruit", terroir="france"),
}
FACETS = {
 "en": dict(
   title="Filter the recipes", search="Search a dish or an ingredient", ph="For example: cider, egg, apple",
   clear="Clear filters", none="No recipe matches these filters.",
   groups=[("moment", "Meal occasion", [("petit", "Light meal"), ("rapide", "Quick meal"), ("grand", "Big meal")]),
           ("type", "Course", [("starter", "Starter"), ("main", "Main"), ("dessert", "Dessert")]),
           ("main", "Main ingredient", [("veg", "Vegetables"), ("meat", "Meat and charcuterie"), ("sea", "Fish and shellfish"), ("fruit", "Fruit")]),
           ("terroir", "Terroir of inspiration", [("dauphine", "Dauphiné"), ("lyon", "Lyon"), ("bretagne", "Brittany"), ("normandie", "Normandy"), ("france", "All of France")]),
           ("n", "Number of ingredients", [("5", "5 ingredients"), ("6", "6 ingredients")])]),
 "fr": dict(
   title="Filtrer les recettes", search="Rechercher un plat ou un ingrédient", ph="Par exemple&nbsp;: cidre, œuf, pomme",
   clear="Tout effacer", none="Aucune recette ne correspond à ces filtres.",
   groups=[("moment", "Moment du repas", [("petit", "Petit repas"), ("rapide", "Repas rapide"), ("grand", "Grand repas")]),
           ("type", "Type de plat", [("starter", "Entrée"), ("main", "Plat"), ("dessert", "Dessert")]),
           ("main", "Ingrédient vedette", [("veg", "Légumes"), ("meat", "Viande et charcuterie"), ("sea", "Poisson et coquillages"), ("fruit", "Fruits")]),
           ("terroir", "Terroir d'inspiration", [("dauphine", "Dauphiné"), ("lyon", "Lyon"), ("bretagne", "Bretagne"), ("normandie", "Normandie"), ("france", "Toute la France")]),
           ("n", "Nombre d'ingrédients", [("5", "5 ingrédients"), ("6", "6 ingrédients")])]),
}

HINTS = {
 "en": {"moment": "Light meal: one light dish on its own. Quick meal: no long cooking. Big meal: for a Sunday table or guests."},
 "fr": {"moment": "Petit repas : un plat léger qui suffit. Repas rapide : sans longue cuisson. Grand repas : pour la tablée du dimanche ou des invités."},
}
TYPE_LABEL = {
 "en": {"starter": "Starter", "main": "Main course", "dessert": "Dessert"},
 "fr": {"starter": "Entrée", "main": "Plat principal", "dessert": "Dessert"},
}
MOMENT_LABEL = {
 "en": {"petit": "Light meal", "rapide": "Quick meal", "grand": "Big meal"},
 "fr": {"petit": "Petit repas", "rapide": "Repas rapide", "grand": "Grand repas"},
}

def alt_paths(key):
    return {l: PATHS[l][key] for l in ("en", "fr")}

# ------------------------------------------------------------------ gabarit
BASE_CSS = re.search(r'<style>(.*?)</style>', SRC["en"], re.S).group(1)
BASE_CSS = BASE_CSS.replace('[aria-current="page"]', '[aria-current]')
EXTRA_CSS = min_css("""
*,*::before,*::after{box-sizing:border-box}
.skip{position:absolute;left:-9999px;top:0;background:var(--ink);color:var(--bg);padding:.7rem 1rem;z-index:50}
.skip:focus{left:1rem;top:1rem}
.breadcrumb{padding:1rem 0 0;font-size:.92rem;color:var(--ink-soft)}
.breadcrumb ol{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.2rem .6rem}
.breadcrumb li+li::before{content:"/";margin-right:.6rem;color:var(--line)}
.breadcrumb a{text-decoration:underline;text-underline-offset:3px}
.tabs a.tab{text-decoration:none;display:inline-flex;align-items:center}
.region{padding:2.4rem 0;border-top:1px solid var(--line);scroll-margin-top:90px}
.region .panel h2{font-size:clamp(1.8rem,4vw,2.6rem);margin-bottom:.7rem}
.region .panel h3{font-family:var(--sans);font-weight:700;font-size:1rem;margin:0 0 .5rem}
.recipe-page .r-body{padding:0;margin-top:1.6rem}
.recipe-page .r-meta{display:flex;flex-wrap:wrap;align-items:center;gap:.8rem 1.5rem;margin-top:1.2rem;color:var(--ink-soft);font-size:.95rem}
.more-recipes{margin-top:3rem}
.more-recipes h2{font-size:1.5rem;margin-bottom:1rem}
.hero-home-note{margin-top:1rem}
.filters{margin-bottom:1.8rem;border:1px solid var(--line);border-radius:8px;padding:0 1.2rem}
.filters summary{cursor:pointer;font-weight:700;padding:.9rem 1.6rem .9rem 0;min-height:44px;list-style:none;position:relative}
.filters summary::-webkit-details-marker{display:none}
.filters summary::after{content:"+";position:absolute;right:.2rem;top:.7rem;font-size:1.4rem;line-height:1}
.filters details[open] summary::after{content:"\\2212"}
.filters #activeCount{font-weight:400;color:var(--ink-soft);margin-left:.4rem}
.filter-body{padding-bottom:1.2rem}
.facet{border:0;margin:0 0 1.1rem;padding:0;min-width:0}
.facet legend{font-weight:700;margin-bottom:.5rem;padding:0}
.facet .tabs{margin-bottom:0}
.tab[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.tab .n{opacity:.65;margin-left:.4rem;font-size:.85em}
.row[hidden]{display:none}
.hint{margin:.7rem 0 0;font-size:.92rem;color:var(--ink-soft)}
#resultCount{padding:.2rem 0 .9rem;margin:0}
.noresult{padding:1.2rem;border:1px dashed var(--line);border-radius:8px}
.r-h{font-family:var(--sans);font-weight:700;font-size:1.15rem;margin:0 0 .8rem}
div.wrap:has(>.breadcrumb)+section,div.wrap:has(>.breadcrumb)+article>section{padding-top:2rem}
.recipe-page .r-body ul li{padding-top:.1rem}
.gateway{min-height:70vh;display:grid;place-content:center;text-align:center;gap:1.4rem;padding:3rem 1.25rem}
.gateway h1{font-size:clamp(2rem,6vw,3.6rem)}
.gateway .links{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap}
.gateway a.btn{min-width:11rem;text-align:center}
.lib h2{scroll-margin-top:90px}
.lib h3{font-family:var(--sans);font-weight:700;font-size:1.05rem;margin:1.8rem 0 .7rem}
.lib .src{margin-bottom:1.4rem}
.lib ul.plain{padding-left:1.1rem}
.lib ul.plain li{margin-bottom:.9rem}
.lib-source{margin-top:2.2rem;color:var(--ink-soft);font-size:.95rem;max-width:46rem}
""")
CSS = min_css(BASE_CSS) + EXTRA_CSS

APP_JS = r"""
(function(){
"use strict";
var d=document,root=d.documentElement,FR=root.lang==="fr",reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var S=FR?{toDark:"Blanc sur noir",toLight:"Noir sur blanc",aDark:"Passer en blanc sur noir",aLight:"Passer en noir sur blanc",listen:"Écouter l'essai",stop:"Arrêter l'écoute",stopped:"Lecture arrêtée.",reading:"Lecture à voix haute avec la voix de votre appareil.",remove:"Supprimer"}
:{toDark:"White on black",toLight:"Black on white",aDark:"Switch to white on black",aLight:"Switch to black on white",listen:"Listen to the essay",stop:"Stop listening",stopped:"Stopped.",reading:"Reading aloud with your device's voice.",remove:"Remove"};
var themeBtn=d.getElementById("themeBtn");
function themeLabel(){var dark=root.getAttribute("data-theme")==="dark";themeBtn.textContent=dark?S.toLight:S.toDark;themeBtn.setAttribute("aria-label",dark?S.aLight:S.aDark);}
if(themeBtn){themeBtn.addEventListener("click",function(){var next=root.getAttribute("data-theme")==="dark"?"light":"dark";root.setAttribute("data-theme",next);try{localStorage.setItem("vt-theme",next);}catch(e){}themeLabel();});themeLabel();}
var menuBtn=d.getElementById("menuBtn"),menu=d.getElementById("mainMenu");
function setMenu(o){menu.classList.toggle("open",o);menuBtn.setAttribute("aria-expanded",o?"true":"false");}
if(menuBtn&&menu){
menuBtn.addEventListener("click",function(){setMenu(!menu.classList.contains("open"));});
d.addEventListener("keydown",function(e){if(e.key==="Escape"&&menu.classList.contains("open")){setMenu(false);menuBtn.focus();}});
d.addEventListener("click",function(e){if(menu.classList.contains("open")&&!menu.contains(e.target)&&!menuBtn.contains(e.target)){setMenu(false);}});
}
var yr=d.getElementById("year");if(yr){yr.textContent=new Date().getFullYear();}
/* portions */
var sv=d.getElementById("servings");
function fmt(li,n){var q=+li.getAttribute("data-q"),u=li.getAttribute("data-u")||"",name=li.getAttribute("data-n"),p=li.getAttribute("data-p"),v=q*n/4,a;
if(u==="g"&&v>=1000){a=String(Math.round(v/100)/10);if(FR){a=a.replace(".",",");}u="kg";}
else if(u==="g"||u==="ml"){a=String(Math.max(5,Math.round(v/5)*5));}
else{var r=Math.max(.5,Math.round(v*2)/2),w=Math.floor(r);a=(w?String(w):"")+((r-w)>=.5?"½":"");if(p&&r>1){name=p;}}
return a+(u?" "+u:"")+" "+name;}
if(sv){var items=d.querySelectorAll("#ingredients li[data-q]"),out=d.getElementById("serv-n");
sv.addEventListener("click",function(e){var b=e.target.closest("button[data-n]");if(!b){return;}var n=parseInt(b.getAttribute("data-n"),10);
sv.querySelectorAll("button").forEach(function(x){x.setAttribute("aria-pressed",x===b?"true":"false");});
if(out){out.textContent=n;}items.forEach(function(li){li.textContent=fmt(li,n);});});}
/* écoute de l'essai */
var lb=d.getElementById("listenBtn"),ls=d.getElementById("listenStatus"),speaking=false;
if(lb){if(!("speechSynthesis" in window)){lb.hidden=true;}else{
lb.addEventListener("click",function(){
if(speaking){window.speechSynthesis.cancel();speaking=false;lb.textContent=S.listen;ls.textContent=S.stopped;return;}
var u=new SpeechSynthesisUtterance(d.getElementById("essayText").innerText);u.lang=FR?"fr-FR":"en-GB";u.rate=.95;
u.onend=u.onerror=function(){speaking=false;lb.textContent=S.listen;ls.textContent="";};
speaking=true;lb.textContent=S.stop;ls.textContent=S.reading;window.speechSynthesis.speak(u);});
window.addEventListener("pagehide",function(){window.speechSynthesis.cancel();});}}
/* registre du village */
var rf=d.getElementById("regForm");
if(rf){var rl=d.getElementById("regList"),re=d.getElementById("regEmpty"),key="vt-register-"+(FR?"fr":"en"),en=[];
try{var raw=localStorage.getItem(key);if(raw){en=JSON.parse(raw)||[];}}catch(e){en=[];}
var save=function(){try{localStorage.setItem(key,JSON.stringify(en));}catch(e){}};
var draw=function(){rl.innerHTML="";re.hidden=en.length>0;en.forEach(function(x,i){var li=d.createElement("li"),l=d.createElement("div"),v=d.createElement("div"),s=d.createElement("div");v.className="v";v.textContent=x.village;s.textContent=x.dish;l.appendChild(v);l.appendChild(s);
var b=d.createElement("button");b.type="button";b.textContent=S.remove;b.setAttribute("aria-label",S.remove+" "+x.village);b.addEventListener("click",function(){en.splice(i,1);save();draw();});li.appendChild(l);li.appendChild(b);rl.appendChild(li);});};
rf.addEventListener("submit",function(e){e.preventDefault();var v=d.getElementById("vName").value.trim(),s=d.getElementById("vDish").value.trim();if(!v||!s){return;}en.unshift({village:v,dish:s});save();draw();rf.reset();d.getElementById("vName").focus();});
draw();}

/* filtre des recettes */
var fb=d.getElementById("filters");
if(fb){
var rows=[].slice.call(d.querySelectorAll("#recipeRows .row")),chips=[].slice.call(fb.querySelectorAll("button[data-facet]")),
qi=d.getElementById("rsearch"),cnt=d.getElementById("resultCount"),none=d.getElementById("noResult"),act=d.getElementById("activeCount"),box=d.getElementById("filterBox"),
sel={moment:[],type:[],main:[],terroir:[],n:[]};
var fold=function(x){return x.toLowerCase().replace(/œ/g,"oe").replace(/æ/g,"ae").normalize("NFD").replace(/[̀-ͯ]/g,"");};
var RC=FR?function(n,t){return n+(n>1?" recettes":" recette")+" sur "+t;}:function(n,t){return n+(n===1?" recipe":" recipes")+" out of "+t;};
rows.forEach(function(r){r._t=fold(r.getAttribute("data-q")||"");});
function sync(){try{var u=new URLSearchParams();Object.keys(sel).forEach(function(k){if(sel[k].length){u.set(k,sel[k].join(","));}});if(qi.value.trim()){u.set("q",qi.value.trim());}var s=u.toString();history.replaceState(null,"",location.pathname+(s?"?"+s:""));}catch(e){}}
function apply(){
var words=fold(qi.value.trim()).split(/\s+/).filter(Boolean),shown=0,active=0;
Object.keys(sel).forEach(function(k){active+=sel[k].length;});if(words.length){active+=1;}
rows.forEach(function(r){var ok=true;
Object.keys(sel).forEach(function(k){if(ok&&sel[k].length){var tk=(r.getAttribute("data-"+k)||"").split(" ");if(!sel[k].some(function(v){return tk.indexOf(v)>-1;})){ok=false;}}});
if(ok&&words.length){ok=words.every(function(w){return r._t.indexOf(w)>-1;});}
r.hidden=!ok;if(ok){shown++;}});
chips.forEach(function(c){c.setAttribute("aria-pressed",sel[c.getAttribute("data-facet")].indexOf(c.getAttribute("data-value"))>-1?"true":"false");});
cnt.textContent=RC(shown,rows.length);none.hidden=shown>0;act.textContent=active?" ("+active+")":"";sync();}
chips.forEach(function(c){c.addEventListener("click",function(){var k=c.getAttribute("data-facet"),v=c.getAttribute("data-value"),i=sel[k].indexOf(v);if(i>-1){sel[k].splice(i,1);}else{sel[k].push(v);}apply();});});
qi.addEventListener("input",apply);
d.getElementById("clearFilters").addEventListener("click",function(){Object.keys(sel).forEach(function(k){sel[k]=[];});qi.value="";apply();qi.focus();});
try{var up=new URLSearchParams(location.search);Object.keys(sel).forEach(function(k){var v=up.get(k);if(v){sel[k]=v.split(",");}});if(up.get("q")){qi.value=up.get("q");}}catch(e){}
fb.hidden=false;box.open=window.innerWidth>=700||location.search.length>1;apply();
}
})();
"""

def header(lang, key, active):
    t, p = L[lang], PATHS[lang]
    other = "fr" if lang == "en" else "en"
    ok = key if key in PATHS[other] else "home"
    nav = ""
    for k in ORDER:
        cur = ""
        if k == active:
            cur = ' aria-current="page"' if key == k else ' aria-current="true"'
        nav += '<a href="%s"%s>%s</a>\n' % (p[k], cur, t["nav"][k])
    return ('<header class="site-head"><div class="wrap">\n<a class="brand" href="%s">%s</a>\n'
            '<button class="menu-btn" id="menuBtn" type="button" aria-expanded="false" aria-controls="mainMenu"><span class="bars" aria-hidden="true"></span><span>%s</span></button>\n'
            '<div class="menu" id="mainMenu">\n<nav class="nav" aria-label="%s">\n%s</nav>\n'
            '<div class="tools"><a class="theme-btn" href="%s" lang="%s" hreflang="%s">%s</a>'
            '<button class="theme-btn" id="themeBtn" type="button">%s</button></div>\n</div>\n</div></header>') % (
        p["home"], t["brand"], t["menu"], t["main_nav"], nav, PATHS[other][ok], other, other, t["other"], t["theme_to_dark"])

def footer(lang, key):
    t, p = L[lang], PATHS[lang]
    links = ""
    for k, label in t["foot_links"]:
        cur = ' aria-current="page"' if key == k else ""
        links += '<a href="%s"%s>%s</a>\n' % (p[k], cur, label)
    return ('<footer><div class="wrap foot">\n<div class="foot-id"><a class="foot-brand" href="%s">%s</a><p>%s</p></div>\n'
            '<nav class="foot-links" aria-label="%s">\n%s</nav>\n<p class="copy">&copy; <span id="year">2026</span> %s</p>\n</div></footer>') % (
        p["home"], t["brand"], t["foot_p"], t["foot_site"], links, t["brand"])

def breadcrumb(lang, trail):
    t = L[lang]
    items = '<li><a href="%s">%s</a></li>' % (PATHS[lang]["home"], t["home"])
    for i, (label, path) in enumerate(trail):
        if i == len(trail) - 1:
            items += '<li aria-current="page">%s</li>' % label
        else:
            items += '<li><a href="%s">%s</a></li>' % (path, label)
    return '<div class="wrap"><nav class="breadcrumb" aria-label="%s"><ol>%s</ol></nav></div>' % (t["crumb"], items)

def breadcrumb_ld(lang, trail):
    t = L[lang]
    els = [{"@type": "ListItem", "position": 1, "name": t["home"], "item": url(PATHS[lang]["home"])}]
    for i, (label, path) in enumerate(trail):
        els.append({"@type": "ListItem", "position": i + 2, "name": plain(label), "item": url(path)})
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": els}

def pager(lang, items, idx):
    t = L[lang]
    prev = items[idx - 1] if idx > 0 else None
    nxt = items[idx + 1] if idx < len(items) - 1 else None
    h = '<div class="wrap"><div class="pager">'
    if prev:
        h += '<a class="prev" href="%s"><small>%s</small><span>%s</span></a>' % (prev[1], t["prev"], prev[0])
    if nxt:
        h += '<a class="next" href="%s"><small>%s</small><span>%s</span></a>' % (nxt[1], t["next"], nxt[0])
    return h + '</div></div>'

def page_html(lang, key, body, active=None, trail=None, noindex=False, extra_ld=None, ptype="website", og_title=None):
    t = L[lang]
    title, desc = META[lang][key]
    path = PATHS[lang][key]
    other = "fr" if lang == "en" else "en"
    canon = url(path)
    head = ['<meta charset="utf-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
            '<title>%s</title>' % esc(title),
            '<meta name="description" content="%s">' % esc(desc),
            '<link rel="canonical" href="%s">' % canon]
    if noindex:
        head.append('<meta name="robots" content="noindex,follow">')
    else:
        head.append('<meta name="robots" content="index,follow,max-image-preview:large">')
        # hreflang
        head.append('<link rel="alternate" hreflang="%s" href="%s">' % (lang, canon))
        head.append('<link rel="alternate" hreflang="%s" href="%s">' % (other, url(PATHS[other][key])))
        xd = "/" if key == "home" else PATHS["en"][key]
        head.append('<link rel="alternate" hreflang="x-default" href="%s">' % url(xd))
    head += ['<meta property="og:site_name" content="%s">' % esc(t["brand"]),
             '<meta property="og:type" content="%s">' % ("article" if ptype == "article" else "website"),
             '<meta property="og:title" content="%s">' % esc(og_title or title),
             '<meta property="og:description" content="%s">' % esc(desc),
             '<meta property="og:url" content="%s">' % canon,
             '<meta property="og:locale" content="%s">' % t["locale"],
             '<meta property="og:locale:alternate" content="%s">' % L[other]["locale"],
             '<meta property="og:image" content="%s">' % url("/assets/og-%s.png" % lang),
             '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">',
             '<meta property="og:image:alt" content="%s">' % esc(t["brand"]),
             '<meta name="twitter:card" content="summary_large_image">',
             '<meta name="theme-color" content="#ffffff">',
             '<link rel="preconnect" href="https://fonts.googleapis.com">',
             '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
             '<link href="https://fonts.googleapis.com/css2?family=Karla:ital,wght@0,400;0,700;1,400&family=Young+Serif&display=swap" rel="stylesheet">',
             '<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">',
             '<link rel="stylesheet" href="/assets/style.css">',
             '<script>try{if(localStorage.getItem("vt-theme")==="dark")document.documentElement.setAttribute("data-theme","dark")}catch(e){}</script>']
    lds = []
    if key == "home":
        lds.append({"@context": "https://schema.org", "@type": "WebSite", "name": t["brand"], "url": canon, "inLanguage": lang,
                    "description": desc})
    if trail:
        lds.append(breadcrumb_ld(lang, trail))
    if extra_ld:
        lds += extra_ld
    head += [jsonld(x) for x in lds]
    bc = breadcrumb(lang, trail) if trail else ""
    doc = ('<!DOCTYPE html>\n<html lang="%s">\n<head>\n%s\n</head>\n<body>\n<a class="skip" href="#main">%s</a>\n%s\n<main id="main">\n%s\n%s\n</main>\n%s\n<script src="/assets/app.js" defer></script>\n</body>\n</html>\n') % (
        lang, '\n'.join(head), t["skip"], header(lang, key, active), bc, body, footer(lang, key))
    return tidy(doc)

def write(path, content):
    fp = os.path.join(OUT, path.lstrip("/"))
    if fp.endswith("/"):
        fp += "index.html"
    os.makedirs(os.path.dirname(fp), exist_ok=True)
    open(fp, "w", encoding="utf-8").write(content)

def render_blocks(blocks, lang):
    """Convertit les blocs JSON d'une page de bibliothèque en HTML. Retourne (html, [(id, titre h2)])."""
    out, toc, n = [], [], 0
    for b in blocks:
        t = b["t"]
        if t == "h2":
            n += 1
            toc.append(("s%d" % n, typo(b["x"], lang)))
            out.append('<h2 id="s%d">%s</h2>' % (n, typo(b["x"], lang)))
        elif t == "h3":
            out.append('<h3>%s</h3>' % typo(b["x"], lang))
        elif t == "p":
            out.append('<p>%s</p>' % typo(b["x"], lang))
        elif t == "list":
            out.append('<ul class="plain">%s</ul>' % ''.join('<li>%s</li>' % typo(x, lang) for x in b["items"]))
        elif t == "dishes":
            out.append('<ul class="src">%s</ul>' % ''.join(
                '<li><span class="what">%s</span><span class="how">%s</span></li>' % (typo(a, lang), typo(c, lang)) for a, c in b["items"]))
        else:
            raise ValueError("bloc inconnu : %s" % t)
    return '\n'.join(out), toc

# ------------------------------------------------------------------ construction
shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT + "/assets")
open(OUT + "/assets/style.css", "w", encoding="utf-8").write(CSS)
open(OUT + "/assets/favicon.svg", "w", encoding="utf-8").write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#4F6F47"/><text x="32" y="46" font-size="42" text-anchor="middle" fill="#fff" font-family="Georgia,serif">C</text></svg>')
js = re.sub(r'/\*.*?\*/', '', APP_JS, flags=re.S)
open(OUT + "/assets/app.js", "w", encoding="utf-8").write('\n'.join(l.strip() for l in js.split('\n') if l.strip()))

sitemap_entries = []   # (key)
for lang in ("en", "fr"):
    t, p, data, src = L[lang], PATHS[lang], DATA[lang], SRC[lang]
    recipes = {r["id"]: r for r in data["recipes"]}
    rtitle = {rid: recipes[rid]["title"] for rid in RECIPE_IDS}
    lib = LIB[lang]
    lib_items = lib["items"]

    # ---- pages statiques extraites du site actuel
    static_keys = ["manifesto", "history", "essay", "village", "faq", "legal", "sources"]
    pager_items = [(t["nav"][k], p[k]) for k in ORDER]
    for k in static_keys:
        block = rewrite_links(extract_page(src, k), lang)
        block = re.sub(r'\s+hidden(?=[\s>])', '', block) if 'id="listenBtn"' not in block else block
        extra, ptype = None, "website"
        if k == "sources" and lib_items:
            libsec = '<h2>%s</h2>\n<ul class="src">%s</ul>\n' % (t["lib_sources_h"], ''.join(
                '<li><span class="what"><a href="%s">%s</a></span><span class="how">%s</span></li>' % (
                    p["lib_" + it["id"]], typo(it["title"], lang), typo(it["source"], lang)) for it in lib_items))
            block = re.sub(r'(<h2>(?:Recettes|Recipes)</h2>)', lambda m: libsec + m.group(1), block, count=1)
        if k == "essay":
            ptype = "article"
            art = {"@context": "https://schema.org", "@type": "Article", "headline": plain(META[lang][k][0]),
                   "description": META[lang][k][1], "inLanguage": lang, "datePublished": BUILD_DATE, "dateModified": BUILD_DATE,
                   "mainEntityOfPage": url(p[k]), "image": url("/assets/og-%s.png" % lang)}
            if AUTHOR_NAME:
                art["author"] = {"@type": "Person", "name": AUTHOR_NAME}
            extra = [art]
        if k == "faq":
            qs = re.findall(r'<summary>(.*?)</summary><div class="a">(.*?)</div></details>', block, flags=re.S)
            extra = [{"@context": "https://schema.org", "@type": "FAQPage", "inLanguage": lang,
                      "mainEntity": [{"@type": "Question", "name": plain(q), "acceptedAnswer": {"@type": "Answer", "text": plain(a)}} for q, a in qs]}]
        body = block
        if k in ORDER:
            body += "\n" + pager(lang, pager_items, ORDER.index(k))
        trail = [(t["nav"][k] if k in t["nav"] else dict(t["foot_links"])[k], p[k])]
        write(p[k], page_html(lang, k, body, active=k if k in ORDER else None, trail=trail,
                              noindex=(k == "village"), extra_ld=extra, ptype=ptype))

    # ---- terroirs
    tb = extract_page(src, "terroirs")
    sec_head = re.search(r'<div class="sec-head">.*?</div>', tb, flags=re.S).group(0)
    sec_head = re.sub(r'<h1>.*?</h1>', '<h1>%s</h1>' % t["regions_h1"], sec_head, flags=re.S)
    sec_head = re.sub(r'<p>.*?</p>', '<p>%s</p>' % t["regions_p"], sec_head, flags=re.S)
    jump = ''.join('<a class="tab" href="#%s">%s</a>' % (r["id"], r["name"]) for r in data["regions"])
    arts = ""
    for r in data["regions"]:
        cta = ""
        if r.get("recipe"):
            cta = '<a class="btn small" href="%s">%s%s</a>' % (p["r_" + r["recipe"]], t["cook"], r["recipeName"])
        arts += ('<article class="region" id="%s"><div class="panel"><div><h2>%s</h2><p class="lead">%s</p>%s</div>'
                 '<div><h3>%s</h3><ul>%s</ul><h3>%s</h3><p class="habit">%s</p></div></div></article>\n') % (
            r["id"], r["name"], r["lead"], cta, t["tastes"], ''.join('<li>%s</li>' % x for x in r["tastes"]), t["habit"], r["habit"])
    body = '<section><div class="wrap">%s<nav class="tabs" aria-label="%s">%s</nav>\n%s</div></section>' % (sec_head, t["jump"], jump, arts)
    body += "\n" + pager(lang, pager_items, ORDER.index("terroirs"))
    write(p["terroirs"], page_html(lang, "terroirs", body, active="terroirs", trail=[(t["nav"]["terroirs"], p["terroirs"])]))

    # ---- index des recettes (avec filtre)
    F = FACETS[lang]
    rows = ""
    counts = {}
    for rid in RECIPE_IDS:
        r = recipes[rid]
        fa = dict(RECIPE_FACETS[rid]); fa["n"] = str(len(r["ingredients"]))
        for k, v in fa.items():
            for tok in v.split():
                counts[(k, tok)] = counts.get((k, tok), 0) + 1
        qtxt = plain(" ".join([r["title"], r["sub"]] + [(it.get("n") or it.get("t") or "") for it in r["ingredients"]]))
        rows += ('<a class="row" href="%s" data-moment="%s" data-type="%s" data-main="%s" data-terroir="%s" data-n="%s" data-q="%s">'
                 '<span class="t">%s</span><span class="d">%s (%s)</span></a>\n') % (
            p["r_" + rid], fa["moment"], fa["type"], fa["main"], fa["terroir"], fa["n"], esc(qtxt), r["title"], r["sub"], t["count"] % len(r["ingredients"]))
    groups = ""
    for fk, ftitle, vals in F["groups"]:
        chips = ""
        for v, lab in vals:
            c = counts.get((fk, v), 0)
            if c:
                chips += '<button type="button" class="tab" data-facet="%s" data-value="%s" aria-pressed="false">%s<span class="n">%d</span></button>' % (fk, v, lab, c)
        hint = ('<p class="hint">%s</p>' % HINTS[lang][fk]) if fk in HINTS[lang] else ""
        groups += '<fieldset class="facet"><legend>%s</legend><div class="tabs">%s</div>%s</fieldset>\n' % (ftitle, chips, hint)
    filt = ('<div class="filters" id="filters" hidden><details id="filterBox"><summary>%s<span id="activeCount"></span></summary>'
            '<div class="filter-body"><div class="field"><label for="rsearch">%s</label><input id="rsearch" type="search" placeholder="%s" autocomplete="off"></div>\n%s'
            '<button class="btn ghost small" id="clearFilters" type="button">%s</button></div></details>'
            '<p id="resultCount" class="status" role="status" aria-live="polite"></p></div>') % (
        F["title"], F["search"], F["ph"], groups, F["clear"])
    body = ('<section><div class="wrap"><div class="sec-head"><h1>%s</h1><p>%s</p></div>'
            '<p class="rule" style="margin-bottom:1.6rem">%s</p>%s'
            '<div class="explore-list" id="recipeRows">\n%s</div>'
            '<p class="noresult" id="noResult" hidden>%s</p></div></section>') % (
        t["recipes_h1"], t["explore_recipes_intro"], t["rule"], filt, rows, F["none"])
    body += "\n" + pager(lang, pager_items, ORDER.index("recipes"))
    itemlist = {"@context": "https://schema.org", "@type": "ItemList", "name": plain(META[lang]["recipes"][0]),
                "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": url(p["r_" + rid]), "name": plain(rtitle[rid])} for i, rid in enumerate(RECIPE_IDS)]}
    write(p["recipes"], page_html(lang, "recipes", body, active="recipes", trail=[(t["nav"]["recipes"], p["recipes"])], extra_ld=[itemlist]))

    # ---- pages recettes
    for i, rid in enumerate(RECIPE_IDS):
        r = recipes[rid]
        key = "r_" + rid
        n = len(r["ingredients"])
        dots = ''.join('<i class="%s"></i>' % ("on" if j < n else "") for j in range(6))
        lis = ""
        for it in r["ingredients"]:
            if it.get("q") is None:
                lis += "<li>%s</li>\n" % esc(it["t"])
            else:
                lis += '<li data-q="%s" data-u="%s" data-n="%s"%s>%s</li>\n' % (
                    it["q"], esc(it.get("u", "")), esc(it["n"]),
                    (' data-p="%s"' % esc(it["p"])) if it.get("p") else "", esc(fmt(it, 4, lang)))
        steps = ''.join('<li>%s</li>\n' % s for s in r["steps"])
        mom_txt = ("Moment&nbsp;: " if lang == "fr" else "Occasion: ") + ", ".join(MOMENT_LABEL[lang][x] for x in RECIPE_FACETS[rid]["moment"].split())
        seg = ''.join('<button type="button" data-n="%d" aria-pressed="%s">%d</button>' % (v, "true" if v == 4 else "false", v) for v in (2, 4, 6))
        body = ('<article class="recipe-page"><section><div class="wrap"><div class="sec-head"><h1>%s</h1><p>%s</p></div>'
                '<div class="r-meta"><span class="dots" aria-hidden="true">%s</span><span>%s</span><span>%s</span></div>'
                '<div class="recipe-tools" style="margin-top:1.4rem"><div><div style="font-weight:700;margin-bottom:.4rem">%s</div>'
                '<div class="seg" id="servings" role="group" aria-label="%s">%s</div></div><p class="rule">%s</p></div>'
                '<div class="r-body"><div><h2 class="r-h">%s <span id="serv-n">4</span> %s</h2><ul id="ingredients">\n%s</ul></div>'
                '<div><h2 class="r-h">%s</h2><ol>\n%s</ol></div>'
                '<p class="changed"><strong>%s</strong> %s</p></div></div></section></article>') % (
            r["title"], r["sub"], dots, t["count"] % n, mom_txt, t["cook_for"], t["servings_aria"], seg, t["rule"],
            t["ing"], t["people"], lis, t["method"], steps, t["changed"], r["changed"])
        others = [x for x in RECIPE_IDS if x != rid]
        more = ''.join('<a class="row" href="%s"><span class="t">%s</span><span class="d">%s</span></a>\n' % (p["r_" + o], recipes[o]["title"], recipes[o]["sub"]) for o in others)
        body += '\n<section class="more-recipes"><div class="wrap"><h2>%s</h2><div class="explore-list">\n%s</div></div></section>' % (t["more"], more)
        # lien vers la région liée
        reg = [g for g in data["regions"] if g.get("recipe") == rid]
        if reg:
            body += '\n<div class="wrap"><p style="margin-top:2rem">%s <a href="%s#%s" style="text-decoration:underline;text-underline-offset:3px">%s</a></p></div>' % (
                ("From the terroir:" if lang == "en" else "Du terroir&nbsp;:"), p["terroirs"], reg[0]["id"], reg[0]["name"])
        ld = {"@context": "https://schema.org", "@type": "Recipe", "name": plain(r["title"]), "description": plain(r["sub"]),
              "inLanguage": lang, "recipeCuisine": "French", "recipeYield": "4", "recipeCategory": TYPE_LABEL[lang][RECIPE_FACETS[rid]["type"]],
              "recipeIngredient": [plain(fmt(it, 4, lang)) for it in r["ingredients"]],
              "recipeInstructions": [{"@type": "HowToStep", "text": plain(s)} for s in r["steps"]],
              "datePublished": BUILD_DATE, "mainEntityOfPage": url(p[key])}
        if AUTHOR_NAME:
            ld["author"] = {"@type": "Person", "name": AUTHOR_NAME}
        trail = [(t["nav"]["recipes"], p["recipes"]), (r["title"], p[key])]
        write(p[key], page_html(lang, key, body, active="recipes", trail=trail, extra_ld=[ld]))

    # ---- bibliothèque : index + une page par ouvrage
    if lib_items:
        lib_pager = [(t["nav"]["library"], p["library"])] + [(typo(it["title"], lang), p["lib_" + it["id"]]) for it in lib_items]
        lrows = ''.join('<a class="row" href="%s"><span class="t">%s</span><span class="d">%s</span></a>\n' % (
            p["lib_" + it["id"]], typo(it["title"], lang), typo(it["sub"], lang)) for it in lib_items)
        body = ('<section><div class="wrap"><div class="sec-head"><h1>%s</h1><p>%s</p></div>'
                '<div class="explore-list">\n%s</div></div></section>') % (lib["h1"], typo(lib["intro"], lang), lrows)
        body += "\n" + pager(lang, pager_items, ORDER.index("library"))
        ilist = {"@context": "https://schema.org", "@type": "ItemList", "name": plain(META[lang]["library"][0]),
                 "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": url(p["lib_" + it["id"]]), "name": plain(it["title"])} for i, it in enumerate(lib_items)]}
        write(p["library"], page_html(lang, "library", body, active="library", trail=[(t["nav"]["library"], p["library"])], extra_ld=[ilist]))
        for i, it in enumerate(lib_items):
            key = "lib_" + it["id"]
            inner, toc = render_blocks(it["blocks"], lang)
            jumpnav = ('<nav class="tabs" aria-label="%s">%s</nav>' % (t["lib_jump"], ''.join('<a class="tab" href="#%s">%s</a>' % (a, b) for a, b in toc))) if len(toc) > 1 else ""
            body = ('<article class="lib-page"><section><div class="wrap"><div class="sec-head"><h1>%s</h1><p>%s</p></div>%s'
                    '<div class="prose lib">\n%s\n</div><p class="lib-source"><strong>%s&nbsp;:</strong> %s</p></div></section></article>') % (
                typo(it["title"], lang), typo(it["sub"], lang), jumpnav, inner, t["lib_source"] if lang == "fr" else t["lib_source"], typo(it["source"], lang))
            if lang == "en":
                body = body.replace("<strong>Source&nbsp;:</strong>", "<strong>Source:</strong>")
            body += "\n" + pager(lang, lib_pager, i + 1)
            art = {"@context": "https://schema.org", "@type": "Article", "headline": plain(it["title"]),
                   "description": META[lang][key][1], "inLanguage": lang, "datePublished": BUILD_DATE, "dateModified": BUILD_DATE,
                   "mainEntityOfPage": url(p[key]), "image": url("/assets/og-%s.png" % lang)}
            if AUTHOR_NAME:
                art["author"] = {"@type": "Person", "name": AUTHOR_NAME}
            trail = [(t["nav"]["library"], p["library"]), (typo(it["title"], lang), p[key])]
            write(p[key], page_html(lang, key, body, active="library", trail=trail, extra_ld=[art], ptype="article"))

    # ---- accueil
    hb = rewrite_links(extract_page(src, "home"), lang)
    hb = re.sub(r'\s+hidden(?=[\s>])', '', hb)
    if lib_items:
        lrow = '<a class="row" href="%s"><span class="t">%s</span><span class="d">%s</span></a>\n' % (
            p["library"], t["nav"]["library"], typo(t["lib_row_lead"], lang) + " · ".join(it["title"] for it in lib_items) + ".")
        hb = hb.replace('<a class="row" href="%s">' % p["village"], lrow + '<a class="row" href="%s">' % p["village"], 1)
    rrows = ''.join('<a class="row" href="%s"><span class="t">%s</span><span class="d">%s</span></a>\n' % (p["r_" + rid], recipes[rid]["title"], recipes[rid]["sub"]) for rid in RECIPE_IDS)
    hb += '\n<section class="explore" aria-label="%s"><div class="wrap"><h2>%s</h2><div class="explore-list">\n%s</div></div></section>' % (t["start_aria"], t["start"], rrows)
    write(p["home"], page_html(lang, "home", hb))

# ---- passerelle racine (x-default)
gw = ('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
      '<title>La Cuisine Française · The French Cuisine</title>\n'
      '<meta name="description" content="French village cooking, terroir and six-ingredient recipes. Cuisine de village, terroirs et recettes en six ingrédients.">\n'
      '<link rel="canonical" href="%s/">\n<meta name="robots" content="index,follow">\n'
      '<link rel="alternate" hreflang="en" href="%s">\n<link rel="alternate" hreflang="fr" href="%s">\n<link rel="alternate" hreflang="x-default" href="%s/">\n'
      '<meta property="og:title" content="La Cuisine Française · The French Cuisine">\n<meta property="og:description" content="Cuisine de village, terroirs et recettes en six ingrédients. Village cooking, terroir and six-ingredient recipes.">\n<meta property="og:type" content="website">\n<meta property="og:url" content="%s/">\n'
      '<meta property="og:image" content="%s">\n<meta name="twitter:card" content="summary_large_image">\n'
      '<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">\n<link rel="stylesheet" href="/assets/style.css">\n</head>\n<body>\n<main class="gateway">\n<h1>La Cuisine Française<br>The French Cuisine</h1>\n'
      '<p>Cuisine de village, terroirs et recettes en six ingrédients.<br>Village cooking, terroir and six-ingredient recipes.</p>\n'
      '<div class="links"><a class="btn" href="/fr/" hreflang="fr" lang="fr">Lire en français</a><a class="btn ghost" href="/en/" hreflang="en" lang="en">Read in English</a></div>\n'
      '</main>\n</body>\n</html>\n') % (SITE_URL, url("/en/"), url("/fr/"), SITE_URL, SITE_URL, url("/assets/og-en.png"))
write("/", tidy(gw))

# ---- 404
nf = ('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
      '<title>Page not found · Page introuvable</title>\n<meta name="robots" content="noindex,follow">\n<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">\n<link rel="stylesheet" href="/assets/style.css">\n</head>\n<body>\n'
      '<main class="gateway">\n<h1>404</h1>\n<p>This page does not exist. Cette page n\'existe pas.</p>\n'
      '<div class="links"><a class="btn" href="/fr/" lang="fr">Accueil</a><a class="btn ghost" href="/en/" lang="en">Home</a></div>\n</main>\n</body>\n</html>\n')
write("/404.html", tidy(nf))

# ---- sitemap (avec hreflang) : on exclut les pages noindex
keys = ["home"] + ORDER + ["faq", "legal", "sources"] + ["r_" + r for r in RECIPE_IDS] + ["lib_" + i for i in LIB_IDS]
keys = [k for k in keys if k != "village"]
sm = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
      '<url><loc>%s/</loc><lastmod>%s</lastmod></url>' % (SITE_URL, BUILD_DATE)]
for k in keys:
    for lang in ("en", "fr"):
        other = "fr" if lang == "en" else "en"
        xd = "/" if k == "home" else PATHS["en"][k]
        sm.append('<url><loc>%s</loc><lastmod>%s</lastmod>'
                  '<xhtml:link rel="alternate" hreflang="%s" href="%s"/><xhtml:link rel="alternate" hreflang="%s" href="%s"/>'
                  '<xhtml:link rel="alternate" hreflang="x-default" href="%s"/></url>' % (
                      url(PATHS[lang][k]), BUILD_DATE, lang, url(PATHS[lang][k]), other, url(PATHS[other][k]), url(xd)))
sm.append('</urlset>')
write("/sitemap.xml", '\n'.join(sm) + '\n')

write("/robots.txt", "User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n" % SITE_URL)

write("/.htaccess", """# Apache (OVH, o2switch, etc.)
RewriteEngine On
# Forcer HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
ErrorDocument 404 /404.html
DirectoryIndex index.html

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/xml text/plain application/ld+json
</IfModule>
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType text/html "access plus 10 minutes"
</IfModule>
<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set Referrer-Policy "strict-origin-when-cross-origin"
  Header set X-Frame-Options "SAMEORIGIN"
</IfModule>
""")

n = sum(1 for _ in (os.path.join(r, f) for r, _, fs in os.walk(OUT) for f in fs if f.endswith(".html")))
print("pages HTML :", n, "| site :", SITE_URL)
