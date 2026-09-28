# O'zbek Kozol (Zot) — onlayn karta o'yini · 2.0

Real vaqtda ishlaydigan ko'p o'yinchili veb-o'yin. Server — Node.js + Socket.io,
mijoz — toza HTML/CSS/JS (hech qanday build kerak emas).

```bash
npm install
npm start          # http://localhost:3000
npm test           # qoidalar testi
npm run bundle     # bitta faylli versiyani yangilash
```

---

## 2.0 da nima o'zgardi

| Bo'lim | Nima qilindi |
|---|---|
| **Qoida xatosi** | Endi stoldagi **har bir** kartani alohida urish kerak (pastda batafsil) |
| **Chat** | O'yin ichida istalgan xabarni qo'lda yozish, tayyor iboralar, stol ustida pufakchalar, o'qilmagan xabarlar soni |
| **Ovozli chat** | Qo'ng'iroqdek: ulanish, vaqt, mikrofonni o'chirish, ovozni o'chirish, tugatish, kim gapirayotgani avatar atrofida yashil halqa bilan ko'rinadi, alohida o'yinchini o'chirib qo'yish |
| **Chiqish** | O'yin paytida chiqishdan oldin so'raydi: «O'rnimga bot qoldirish» yoki «O'yinni to'liq tark etish» |
| **Ommaviy xonalar** | Hamma ochgan ommaviy xonalar ro'yxati (jonli yangilanadi), istalganiga kirish, bot o'ynayotgan o'ringa o'tish |
| **Do'stlar** | 8 raqamli ID orqali qo'shish, so'rovlar, onlayn holati, qaysi xonada ekani, «Qo'shilish», o'yinga taklif qilish, yaqinda birga o'ynaganlar |
| **Profil** | PUBG uslubidagi kartochka: level, daraja (Bronza → Afsona), ramka, statistika, kiyilgan qo'lqop/skin, olgan sovg'alar, bio, hudud, sevimli masta |
| **Level** | Boshida tez ko'tariladi (1-levelda 1 g'alaba = +1 level), keyin sekinlashadi. Yutqazsa LP kamayadi. 100-level juda qiyin |
| **Tangalar** | G'alaba 15–20, mag'lubiyat 3–5, kunlik bonus 25, har yangi level uchun bonus |
| **Do'kon** | 26 ta qo'lqop, 15 ta karta skini, 28 ta stiker, 23 ta sovg'a |
| **Stiker/sovg'alar** | O'yin paytida o'yinchiga uchib boradi va o'z ovozini chiqaradi (❤️ — «I love you!», 👍 — «Nice move!», 🐐 — «Meeeeh!»…) |
| **Moslashuv** | Kompyuter, planshet, telefon (tik va yotiq), 300px gacha |

---

## Asosiy qoida (tuzatilgan)

**Stoldagi har bir kartani alohida urish kerak** — o'sha mastaning kattarog'i
yoki zot bilan. Bitta karta faqat bitta kartani uradi.

Misol — zot ♥ (tappon), birinchi o'yinchi **8♣ 9♣** yurdi:

| Ikkinchi o'yinchi | Natija | Nega |
|---|---|---|
| 10♣ + V♣ | ✅ uradi | 10 > 9, V > 8 |
| 7♥ + 10♣ | ✅ uradi | zot 8♣ ni, 10♣ esa 9♣ ni uradi |
| 6♥ + 7♥ | ✅ uradi | ikkalasi zot |
| T♥ + 6♣ | ❌ **urolmaydi** | 6♣ hech qaysi kartani urmaydi |

Urolmasangiz — kartalarni **yopib berasiz** (teskari qo'yiladi). 4 kishilik
o'yinda keyingi o'yinchi endi eng oxirgi urgan kartalarni urishi kerak.
Qo'lni kim oxirgi bo'lib urgan bo'lsa, o'sha oladi.

Mantiq `public/shared.js` dagi `matchBeat()` funksiyasida — server ham, brauzer
ham aynan shu kodni ishlatadi, shuning uchun ekrandagi maslahat (yashil halqa)
va serverdagi tekshiruv har doim bir xil.

**Kuch tartibi:** Tuz → 10 → Karol → Dama → Valet → 9 → 8 → 7 → 6
**Ochko:** Tuz 11 · 10 → 10 · Karol 4 · Dama 3 · Valet 2 · qolgani 0 — jami 120
**Hisob:** 60 dan kam −2, 30 dan kam −4, 0 — −6 (sof kozol)

---

## Fayllar

```
kozol/
├── server.js              ← xonalar, o'yin oqimi, botlar, mukofotlar, socket
├── lib/accounts.js        ← hisoblar, do'stlar, do'kon, level, saqlash
├── public/
│   ├── index.html         ← barcha ekranlar
│   ├── style.css          ← dizayn + @media (1200px → 300px)
│   ├── shared.js          ← qoidalar + level + do'kon katalogi (server bilan umumiy)
│   ├── app.js             ← menyu, profil, do'stlar, ommaviy xonalar, do'kon, sozlamalar
│   ├── game.js            ← o'yin stoli, chat, stikerlar, ovozli chat UI, chiqish
│   ├── cards.js           ← kartalar SVG + skinlar
│   ├── gloves.js          ← qo'lqoplar SVG
│   ├── avatars.js         ← 12 ta tayyor avatar
│   ├── sfx.js             ← barcha tovushlar (fayl kerak emas) + ovoz chiqarib aytish
│   └── voice.js           ← WebRTC ovozli chat
├── scripts/bundle.js      ← bitta faylli versiyani yasaydi
├── test/rules.test.js     ← qoidalar testi
└── bitta-fayl/kozol-yagona.js
```

---

## Hisoblar qayerda saqlanadi

* Server hisoblarni `data/accounts.json` faylida saqlaydi.
* Har o'yinchining brauzerida **imzolangan nusxa** turadi. Render bepul rejasida
  server qayta ishga tushsa disk tozalanadi — lekin o'yinchi kirishi bilan hisob
  shu nusxadan **avtomatik tiklanadi** (level, tangalar, do'kondan olinganlar,
  do'stlar). Imzo tufayli nusxadagi tangalarni qo'lda o'zgartirib bo'lmaydi.
* Buning uchun `KOZOL_SECRET` doimiy bo'lishi kerak — `render.yaml` uni o'zi yaratadi.
* **Boshqa qurilmada o'ynash:** Sozlamalar → «Zaxira kodini nusxalash», keyin
  ikkinchi qurilmada «Zaxira koddan tiklash».

Katta auditoriya uchun keyinchalik haqiqiy ma'lumotlar bazasiga (masalan
MongoDB Atlas bepul) o'tish mumkin — faqat `lib/accounts.js` dagi `load` va
`markDirty` o'zgaradi.

---

## Ovozli chat

* Ovoz o'yinchilar o'rtasida to'g'ridan-to'g'ri (WebRTC) o'tadi, server faqat
  ulanishni tashkil qiladi.
* **Faqat `https://`** (yoki `localhost`) da ishlaydi — Render'da avtomatik https.
* Ko'p tarmoqlarda STUN yetarli. Ba'zi mobil operatorlarda ulanmasa, TURN server
  qo'shing: `TURN_URL`, `TURN_USER`, `TURN_PASS` muhit o'zgaruvchilari.
* Birinchi bosganda brauzer mikrofonga ruxsat so'raydi.

---

## Level va mukofotlar

| Level | G'alaba | Mag'lubiyat |
|---|---|---|
| 1 | +100 LP (darhol yangi level) | −1 |
| 10 | +47 | −2 |
| 30 | +13 | −4 |
| 60 | +6 | −7 |
| 90 | +6 | −10 |

Har level = 100 LP. Level pastga tushmaydi, faqat LP kamayadi. Raqiblar faqat bot
bo'lsa — mukofot yarmi (botlar bilan level «fermerlik» qilmaslik uchun).
O'yinni to'liq tark etish — 2 barobar LP jarimasi. Har «sof kozol» uchun +3 LP bonus.

Darajalar (ramka rangi): Bronza 1 · Kumush 10 · Oltin 25 · Platina 45 · Olmos 65 · Toj 85 · Afsona 100.

---

## Sozlash

| Nima | Qayerda |
|---|---|
| Qoidalar, level egri chizig'i, mukofotlar | `public/shared.js` — `winLp`, `lossLp`, `REWARD` |
| Do'kon narxlari va buyumlar | `public/shared.js` — `SKINS`, `GLOVES`, `GIFTS`, `STICKERS` |
| Stiker ovozlari | `public/shared.js` (`say`, `sfx`) + `public/sfx.js` (retseptlar) |
| Bot tezligi | `server.js` — `maybeBot()` |
| Ranglar, karta o'lchami | `public/style.css` — `:root` |

## Boshqaruv

| Amal | Qanday |
|---|---|
| Karta tanlash | Kartani bosing yoki **1…4** |
| Yurish / urish | **Yurish** / **Urish** yoki **Enter** |
| Yopib berish | **Yopib berish** yoki **Probel** |
| O'yinchi profili | Stol atrofidagi ismini bosing |
