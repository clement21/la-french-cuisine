#!/usr/bin/env python3
"""Audit SEO technique d'un site statique (dossier local).

Usage :  python3 tools/seo_check.py [dossier_du_site]
Sortie : liste des erreurs (E), avertissements (W) et un score. Code de sortie 1 s'il y a des erreurs.
Aucune dépendance : bibliothèque standard uniquement.
"""
import os, re, sys, json
from html.parser import HTMLParser
from urllib.parse import urlparse
from xml.etree import ElementTree as ET

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
TITLE_MIN, TITLE_MAX = 25, 65
DESC_MIN, DESC_MAX = 70, 160

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""; self._in_title = False
        self.meta = {}; self.links = []; self.h = []; self._h = None
        self.anchors = []; self.imgs = []; self.ld = []; self._ld = False
        self.lang = None; self.text_len = 0; self._skip = 0; self.ids = set()
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a: self.ids.add(a["id"])
        if tag == "html": self.lang = a.get("lang")
        elif tag == "title": self._in_title = True
        elif tag == "meta":
            k = a.get("name") or a.get("property")
            if k: self.meta[k] = a.get("content", "")
        elif tag == "link": self.links.append(a)
        elif tag in ("h1", "h2", "h3"): self._h = [tag, ""]
        elif tag == "a" and "href" in a: self.anchors.append(a["href"])
        elif tag == "img": self.imgs.append(a)
        elif tag == "script":
            if a.get("type") == "application/ld+json": self._ld = True; self.ld.append("")
            self._skip += 1
        elif tag == "style": self._skip += 1
    def handle_endtag(self, tag):
        if tag == "title": self._in_title = False
        elif tag in ("h1", "h2", "h3") and self._h: self.h.append(tuple(self._h)); self._h = None
        elif tag == "script": self._ld = False; self._skip -= 1
        elif tag == "style": self._skip -= 1
    def handle_data(self, d):
        if self._in_title: self.title += d
        if self._h is not None: self._h[1] += d
        if self._ld: self.ld[-1] += d
        if not self._skip: self.text_len += len(d.split())

errors, warns = [], []
def E(p, m): errors.append("E  %s: %s" % (p, m))
def W(p, m): warns.append("W  %s: %s" % (p, m))

files = []
for r, _, fs in os.walk(ROOT):
    for f in fs:
        if f.endswith(".html"): files.append(os.path.join(r, f))
rel = lambda f: "/" + os.path.relpath(f, ROOT).replace(os.sep, "/")
def url_of(f):
    p = rel(f)
    return p[:-10] if p.endswith("/index.html") else p
def target_exists(path):
    path = path.split("#")[0].split("?")[0]
    if not path: return True
    fp = os.path.join(ROOT, path.lstrip("/"))
    return os.path.isfile(fp) or os.path.isfile(os.path.join(fp, "index.html"))

pages = {}
for f in files:
    pg = Page(); pg.feed(open(f, encoding="utf-8").read()); pages[url_of(f)] = (f, pg)

# sitemap
sm_urls, sm_base = set(), None
smf = os.path.join(ROOT, "sitemap.xml")
if not os.path.isfile(smf): E("/sitemap.xml", "absent")
else:
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    for u in ET.parse(smf).getroot().findall("s:url/s:loc", ns):
        pu = urlparse(u.text.strip()); sm_urls.add(pu.path); sm_base = "%s://%s" % (pu.scheme, pu.netloc)
rb = os.path.join(ROOT, "robots.txt")
if not os.path.isfile(rb): E("/robots.txt", "absent")
elif "sitemap:" not in open(rb).read().lower(): E("/robots.txt", "ne référence pas le sitemap")

titles, descs = {}, {}
for u, (f, pg) in sorted(pages.items()):
    name = u
    if os.path.basename(f) == "404.html": continue
    robots = pg.meta.get("robots", "")
    noindex = "noindex" in robots
    if not pg.lang: E(name, "attribut lang manquant sur <html>")
    t = pg.title.strip()
    if not t: E(name, "<title> manquant")
    else:
        if not TITLE_MIN <= len(t) <= TITLE_MAX: W(name, "title de %d caractères (cible %d-%d)" % (len(t), TITLE_MIN, TITLE_MAX))
        titles.setdefault(t, []).append(name)
    d = pg.meta.get("description", "").strip()
    if not d: E(name, "meta description manquante")
    else:
        if not DESC_MIN <= len(d) <= DESC_MAX: W(name, "description de %d caractères (cible %d-%d)" % (len(d), DESC_MIN, DESC_MAX))
        descs.setdefault(d, []).append(name)
    h1 = [x for x in pg.h if x[0] == "h1"]
    if len(h1) != 1: E(name, "%d balises h1 (attendu : 1)" % len(h1))
    canon = [l for l in pg.links if l.get("rel") == "canonical"]
    if len(canon) != 1: E(name, "canonical manquant ou multiple")
    elif sm_base and urlparse(canon[0]["href"]).path != u: E(name, "canonical (%s) différent de l'URL (%s)" % (urlparse(canon[0]["href"]).path, u))
    if not noindex:
        if u not in sm_urls: E(name, "indexable mais absent du sitemap")
        for k in ("og:title", "og:description", "og:image", "og:url"):
            if not pg.meta.get(k): W(name, "balise %s manquante" % k)
        alts = {l.get("hreflang"): l.get("href") for l in pg.links if l.get("rel") == "alternate" and l.get("hreflang")}
        if u != "/" and alts:
            for lg, href in alts.items():
                tp = urlparse(href).path
                if tp not in pages: E(name, "hreflang %s pointe vers une page inexistante (%s)" % (lg, tp)); continue
                back = {l.get("hreflang"): urlparse(l.get("href")).path for l in pages[tp][1].links if l.get("rel") == "alternate" and l.get("hreflang")}
                if lg != "x-default" and back.get(pg.lang) != u: E(name, "hreflang non réciproque avec %s" % tp)
        if pg.text_len < 120: W(name, "contenu court (%d mots)" % pg.text_len)
    else:
        if u in sm_urls: E(name, "noindex mais présent dans le sitemap")
    for i in pg.imgs:
        if not i.get("alt") and i.get("alt") != "": E(name, "image sans attribut alt : %s" % i.get("src"))
    for blob in pg.ld:
        try: json.loads(blob)
        except Exception as ex: E(name, "JSON-LD invalide (%s)" % ex)
    for href in pg.anchors:
        if href.startswith(("http://", "https://", "mailto:", "tel:", "javascript:")):
            if sm_base and href.startswith(sm_base):
                if not target_exists(urlparse(href).path): E(name, "lien interne cassé : %s" % href)
            continue
        if href.startswith("#"):
            if href[1:] and href[1:] not in pg.ids: E(name, "ancre introuvable : %s" % href)
            continue
        if not target_exists(href): E(name, "lien interne cassé : %s" % href)
        elif "#" in href and href.split("#")[1]:
            tp = href.split("#")[0].rstrip("/") + "/" if not href.split("#")[0].endswith("/") else href.split("#")[0]
            if tp in pages and href.split("#")[1] not in pages[tp][1].ids: E(name, "ancre introuvable dans la cible : %s" % href)
    # pages orphelines
for u in sm_urls:
    if u not in pages: E("/sitemap.xml", "URL listée mais fichier introuvable : %s" % u)
linked = set()
for u, (f, pg) in pages.items():
    for h in pg.anchors: linked.add(h.split("#")[0])
for u in pages:
    if u not in ("/", "/404.html") and u not in linked and u + "index.html" not in linked:
        W(u, "page orpheline (aucun lien interne ne pointe vers elle)")
for t, us in titles.items():
    if len(us) > 1: E(", ".join(us), "title dupliqué : %s" % t)
for d, us in descs.items():
    if len(us) > 1: E(", ".join(us), "meta description dupliquée")

total = len(pages)
print("Pages analysées : %d | sitemap : %d URL" % (total, len(sm_urls)))
for m in errors + warns: print(m)
score = max(0, 100 - 5 * len(errors) - len(warns))
print("\nErreurs : %d | Avertissements : %d | Score : %d/100" % (len(errors), len(warns), score))
sys.exit(1 if errors else 0)
