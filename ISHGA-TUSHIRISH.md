# Ishga tushirish — 3 qadam

## 1. Papkani VS Code da oching
`File → Open Folder…` → **kozol** papkasini tanlang.

## 2. Terminalni oching (`Ctrl` + `` ` ``) va yozing:

```bash
npm install
```

## 3. Ishga tushiring:

```bash
npm start
```

Brauzerda oching: **http://localhost:3000**

> VS Code da **F5** bosib ham ishga tushirsa bo'ladi.

---

## Birinchi kirish

1. Ism va rasm tanlanadi — shu bilan hisobingiz yaratiladi (150 tanga sovg'a).
2. **O'ynash** → «Tezkor o'yin» yoki «Xona ochish».
3. Yolg'iz sinash uchun: «Bo'sh o'rinlarni darhol botlar egallasin» ni belgilang.

## Do'stlar bilan

* **Ommaviy xona** ochsangiz — hamma uni «Ommaviy» bo'limida ko'radi.
* **Faqat kod bilan** — 4 raqamli kodni yuborasiz.
* Do'stingizni **8 raqamli ID** orqali qo'shib, kutish xonasidan «Do'stni taklif qilish» mumkin.

Bir Wi-Fi da: kompyuteringiz IP si (`ipconfig` / `ifconfig`) → do'stlar `http://192.168.x.x:3000`
ga kiradi. **Ovozli chat** esa faqat `https` yoki `localhost` da ishlaydi — uni to'liq
sinash uchun Render'ga joylang (DEPLOY.md) yoki `npx localtunnel --port 3000`.

---

## Ikkita versiya

| | Qayerda | Nima uchun |
|---|---|---|
| **Papkali** | `server.js` + `lib/` + `public/` | Kodni tahrirlash uchun |
| **Bitta faylli** | `bitta-fayl/kozol-yagona.js` | Ko'chirib olib ketish, birovga yuborish oson |

Bitta faylli versiya endi papkali versiyadan **avtomatik yasaladi** — kodni
o'zgartirgach `npm run bundle` bosing, ikkalasi bir xil bo'lib qoladi.

```bash
node bitta-fayl/kozol-yagona.js
```

---

## Tez-tez uchraydigan muammolar

**`npm: command not found`** — Node.js o'rnatilmagan. https://nodejs.org dan LTS versiyasini yuklang.

**`EADDRINUSE: port 3000`** — port band. `PORT=3001 npm start` (Windows: `set PORT=3001 && npm start`).

**Ovozli chat: «faqat https:// manzilda ishlaydi»** — `http://192.168…` orqali kirilgan.
Render'dagi `https://` manzildan yoki `localhost` dan kiring.

**Hisobim yo'qoldi** — brauzer ma'lumotlari tozalangan bo'lsa, zaxira kodidan tiklang
(Sozlamalar → Hisob). Zaxira kodini oldindan saqlab qo'ying.
