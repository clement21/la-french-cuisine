import os, re, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
SRC, DST = os.path.join(HERE, "site"), os.path.join(HERE, "apercu-hors-ligne")
shutil.rmtree(DST, ignore_errors=True)
shutil.copytree(SRC, DST, ignore=shutil.ignore_patterns(".htaccess", "robots.txt", "sitemap.xml"))

def fix(path, depth):
    prefix = "../" * depth if depth else "./"
    frag = ""
    if "#" in path:
        path, frag = path.split("#", 1); frag = "#" + frag
    p = path.lstrip("/")
    if p == "" or p.endswith("/"):
        p += "index.html"
    return prefix + p + frag

n = 0
for r, _, fs in os.walk(DST):
    for f in fs:
        if not f.endswith(".html"): continue
        fp = os.path.join(r, f)
        depth = os.path.relpath(fp, DST).count(os.sep)
        s = open(fp, encoding="utf-8").read()
        def sub(m):
            global n; n += 1
            return '%s="%s"' % (m.group(1), fix(m.group(2), depth))
        s = re.sub(r'\b(href|src)="(/(?!/)[^"]*)"', sub, s)
        open(fp, "w", encoding="utf-8").write(s)
open(os.path.join(DST, "LISEZMOI-APERCU.txt"), "w", encoding="utf-8").write(
"APERÇU HORS LIGNE\n\nDécompressez ce dossier, puis double-cliquez sur index.html.\n"
"Cette version sert uniquement à voir le site sur votre ordinateur (liens relatifs).\n"
"Ne la mettez PAS en ligne : utilisez l'archive la-cuisine-francaise-site.zip pour l'hébergement.\n"
"Les polices Google (Young Serif, Karla) ne s'affichent qu'avec une connexion Internet ; sinon des polices système les remplacent.\n")
print(n, "liens réécrits")
