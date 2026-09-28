'use strict';
/* ============================================================
   scripts/bundle.js — bitta faylli versiyani yasaydi
   Ishga tushirish:  npm run bundle
   Natija:           bitta-fayl/kozol-yagona.js
   Ichida server.js, lib/ va public/ fayllari joylashgan bo'ladi.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const files = {};
function add(rel) {
  const abs = path.join(ROOT, rel);
  if (fs.statSync(abs).isDirectory()) {
    for (const f of fs.readdirSync(abs)) add(path.join(rel, f));
  } else {
    files[rel.split(path.sep).join('/')] = fs.readFileSync(abs).toString('base64');
  }
}
['server.js', 'lib', 'public'].forEach(add);

const out = `#!/usr/bin/env node
/* ==============================================================
   O'ZBEK KOZOL (ZOT) — HAMMASI BITTA FAYLDA
   ==============================================================
   Bu fayl avtomatik yasalgan (npm run bundle). Qo'lda o'zgartirmang —
   asl kod: server.js, lib/, public/.

   Ishga tushirish:
       npm install express socket.io
       node kozol-yagona.js
   So'ng brauzerda: http://localhost:3000

   Ishga tushganda fayllar yonidagi .kozol/ papkasiga ochiladi.
   ============================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const FILES = ${JSON.stringify(files)};
const DIR = path.join(__dirname, '.kozol');
for (const [rel, b64] of Object.entries(FILES)) {
  const p = path.join(DIR, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, Buffer.from(b64, 'base64'));
}
process.env.KOZOL_RUN = '1';
require(path.join(DIR, 'server.js'));
`;
fs.mkdirSync(path.join(ROOT, 'bitta-fayl'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'bitta-fayl', 'kozol-yagona.js'), out);
console.log(`bitta-fayl/kozol-yagona.js tayyor — ${Object.keys(files).length} ta fayl, ${Math.round(out.length / 1024)} KB`);
