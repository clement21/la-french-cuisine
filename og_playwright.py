# Génère les images de partage 1200x630 (og-en.png, og-fr.png) avec Playwright (Python). Usage : python3 og_playwright.py <dossier_du_projet>
# Alternative à og.js quand puppeteer n est pas installé. À lancer APRÈS build_site.py (qui vide le dossier site/).
import sys, os
from playwright.sync_api import sync_playwright
cards={'en':['Village Table','Village cooking, terroir and six-ingredient recipes'],'fr':['Village Table','Cuisine de village, terroirs et recettes en six ingrédients']}
root=sys.argv[1]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox'])
    for l,(a,c) in cards.items():
        pg=b.new_page(viewport={'width':1200,'height':630})
        pg.set_content(f"""<html><body style="margin:0;background:#fff;color:#0a0a0a;font-family:Georgia,'Times New Roman',serif;display:flex;flex-direction:column;justify-content:center;height:630px;padding:0 90px;box-sizing:border-box;border-left:18px solid #4F6F47"><div style="font-size:92px;line-height:1.05;letter-spacing:-1px">{a}</div><div style="font-family:Arial,Helvetica,sans-serif;font-size:38px;color:#4a4a4a;margin-top:34px;max-width:900px;line-height:1.3">{c}</div><div style="margin-top:46px;width:140px;border-top:6px solid #D9A520"></div></body></html>""")
        pg.screenshot(path=os.path.join(root,'site','assets',f'og-{l}.png'))
    b.close()
print('og ok')
