// Génère les images de partage 1200x630 dans site/assets/ (og-en.png, og-fr.png).
// Prérequis : Node.js + puppeteer (npm i puppeteer). Variable CHROME_PATH optionnelle.
// Alternative sans puppeteer : python3 og_playwright.py .
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require(process.env.PUPPETEER_PATH); }
(async () => {
  const opts = { args: ['--no-sandbox'], headless: true };
  if (process.env.CHROME_PATH) opts.executablePath = process.env.CHROME_PATH;
  const b = await puppeteer.launch(opts);
  const cards = { en: ['Village Table', 'Village cooking, terroir and six-ingredient recipes'],
                  fr: ['Village Table', 'Cuisine de village, terroirs et recettes en six ingrédients'] };
  for (const l of ['en', 'fr']) {
    const p = await b.newPage(); await p.setViewport({ width: 1200, height: 630 });
    await p.setContent(`<html><body style="margin:0;background:#fff;color:#0a0a0a;font-family:Georgia,'Times New Roman',serif;display:flex;flex-direction:column;justify-content:center;height:630px;padding:0 90px;box-sizing:border-box;border-left:18px solid #4F6F47">
    <div style="font-size:92px;line-height:1.05;letter-spacing:-1px">${cards[l][0]}</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:38px;color:#4a4a4a;margin-top:34px;max-width:900px;line-height:1.3">${cards[l][1]}</div>
    <div style="margin-top:46px;width:140px;border-top:6px solid #D9A520"></div></body></html>`);
    await p.screenshot({ path: path.join(__dirname, 'site', 'assets', `og-${l}.png`) });
  }
  await b.close(); console.log('og ok');
})();
