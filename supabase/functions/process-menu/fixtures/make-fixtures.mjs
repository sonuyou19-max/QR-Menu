import { chromium } from "playwright";
import { execSync } from "node:child_process";
const chrome = execSync(
  "ls -d /opt/pw-browsers/chromium-*/chrome-linux*/chrome | head -1",
)
  .toString()
  .trim();
const css = `body{margin:0;background:#5a4632;display:grid;place-items:center;height:100vh}
.paper{width:820px;padding:56px 64px;background:#fbf6ea;transform:rotate(-1.6deg);box-shadow:0 20px 60px #0008;font-family:Georgia,serif;color:#2b2118}
h1{text-align:center;font-size:44px;margin:0 0 4px;letter-spacing:2px}.sub{text-align:center;font-style:italic;margin-bottom:28px}
h2{font-size:30px;border-bottom:2px solid #2b2118;margin:28px 0 12px;font-variant:small-caps}
.d{display:flex;justify-content:space-between;font-size:23px;margin-top:14px;font-weight:bold}.x{font-size:18px;font-style:italic;margin-top:2px}`;
const dish = (n, p, x = "") =>
  `<div class="d"><span>${n}</span><span>${p}</span></div>${x ? `<div class="x">${x}</div>` : ""}`;
const pages = {
  "nl-1": `<h1>BRASSERIE DE LINDE</h1><div class="sub">Oude Markt · Leuven</div>
<h2>Voorgerechten</h2>${dish("Tomaat-garnaal", "€ 16,50", "Grijze Noordzeegarnalen, mayonaise, sla")}${dish("Kaaskroketten (2 st.)", "€ 13,00")}${dish("Soep van de dag", "€ 7,50")}
<h2>Hoofdgerechten</h2>${dish("Stoofvlees met frietjes", "€ 22,50")}${dish("Vol-au-vent", "€ 21,00", "Met kip, balletjes en champignons")}${dish("Waterzooi van kip", "€ 23,00")}`,
  "nl-2": `${dish("Konijn met pruimen", "€ 24,50")}${dish("Chef's Herfstdroom", "€ 26,00")}${dish("Tagliatelle al ragù", "€ 19,50")}
<h2>Huisgemaakte desserts</h2>${dish("Dame blanche", "€ 9,00")}${dish("Crème brûlée", "")}${dish("Brusselse wafel", "€ 8,50", "Met slagroom en poedersuiker")}
<h2>Bieren</h2>${dish("Stella Artois 25cl", "€ 3,20")}${dish("Westmalle Tripel", "€ 5,50")}`,
  "fr-1": `<h1>Le Petit Sablon</h1><div class="sub">Bistrot · Bruxelles</div>
<h2>Entrées</h2>${dish("Croquettes aux crevettes grises", "14,50 €")}${dish("Œuf cocotte aux chicons", "12 €")}
<h2>Plats</h2>${dish("Carbonnade flamande, frites", "21 €")}${dish("Moules marinière (selon arrivage)", "26 €", "Céleri, oignons, vin blanc")}${dish("Filet américain, frites", "19,50 €")}
<h2>Desserts</h2>${dish("Mousse au chocolat maison", "8 €")}${dish("Café gourmand", "9,50 €")}`,
};
const browser = await chromium.launch({ executablePath: chrome });
const page = await browser.newPage({ viewport: { width: 1000, height: 1300 } });
for (const [name, body] of Object.entries(pages)) {
  await page.setContent(
    `<style>${css}</style><div class="paper">${body}</div>`,
  );
  await page.screenshot({
    path: `fixtures/${name}.jpg`,
    type: "jpeg",
    quality: 82,
  });
}
await browser.close();
