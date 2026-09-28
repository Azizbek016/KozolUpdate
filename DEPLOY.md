# Do'stlar bilan onlayn o'ynash

Ikkita yo'l bor. Birinchisi — 2 daqiqada, ikkinchisi — doimiy manzil bilan.

---

## A. Hoziroq sinash (deploy qilmasdan)

Kompyuteringizda server ishlab tursin:

```bash
npm start
```

Yangi terminal oching va yozing:

```bash
npx localtunnel --port 3000
```

Chiqqan havolani (`https://...loca.lt`) do'stlaringizga yuboring. Ular kirib,
siz bergan **4 raqamli xona kodini** kiritadi.

> Kompyuteringiz o'chsa yoki terminal yopilsa — havola ishlamay qoladi.
> Bir Wi-Fi da bo'lsangiz `npx localtunnel` ham shart emas: `http://192.168.x.x:3000`
> yetarli (IP ni `ipconfig` / `ifconfig` bilan bilib olasiz).

---

## B. Doimiy server — Render (bepul)

Kodda hech narsa o'zgartirilmaydi. Loyihada `render.yaml` allaqachon bor.

1. **GitHub'ga yuklang**

```bash
cd kozol
git init
git add .
git commit -m "Kozol"
git branch -M main
git remote add origin https://github.com/FOYDALANUVCHI/kozol.git
git push -u origin main
```

2. **render.com** ga kiring → *New* → *Web Service* → repozitoriyni ulang.

3. Render `render.yaml` ni o'zi o'qiydi. Qo'lda kiritsangiz:
   - Runtime: **Node**
   - Region: **Frankfurt** (O'zbekistonga eng yaqini)
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: **Free**

4. *Create Web Service* → 2–3 daqiqada `https://kozol-xxxx.onrender.com` tayyor.

Shu havolani do'stlaringizga tashlang. Boshqa hech narsa kerak emas —
`PORT` ni server o'zi Render'dan oladi.

### Bepul rejaning ikkita xususiyati

| Nima | Ta'siri |
|---|---|
| 15 daqiqa harakatsizlikdan keyin uxlaydi | Birinchi kirish ~30–60 soniya sekin, keyin normal |
| Qayta ishga tushganda xotira tozalanadi | Ochiq xonalar yo'qoladi. Hisoblar (level, tanga, do'stlar) esa o'yinchi kirganda brauzerdagi imzolangan nusxadan avtomatik tiklanadi |

O'yin davomida server uxlamaydi — har bir yurish so'rov hisoblanadi.

---

## C. Server uxlamasligi uchun

Render bepul rejada **oyiga 750 soat** beradi (butun workspace uchun, har bir
servis uchun alohida emas). Uxlab yotgan servis bu soatlarni sarflamaydi.

31 kunlik oyda tinimsiz ishlash = 24 × 31 = **744 soat**. Ya'ni chegaraga
sig'adi, lekin atigi 6 soat zaxira bilan — va faqat bu yagona bepul servisingiz
bo'lsa. Soatlar tugasa, barcha bepul servislar oy oxirigacha to'xtatiladi.

### 1-usul: faqat o'ynaydigan vaqtingizda uyg'oq tutish ⭐

Eng oqilona yo'l. Loyihada `/ping` manzili tayyor turibdi.

1. **cron-job.org** (yoki UptimeRobot / Better Stack) da ro'yxatdan o'ting
2. Yangi job: `https://kozol-xxxx.onrender.com/ping`
3. Interval: **10 daqiqa**
4. Jadval: masalan har kuni **18:00–01:00** (siz o'ynaydigan vaqt)

Kuniga 7 soat × 31 kun = ~217 soat. 750 dan ancha kam — xotirjam ishlaydi,
va o'ynash vaqtida server hech qachon uxlamaydi.

> Ping `/ping` ga borsin, `/robots.txt` ga emas — Render bu manzilni servisga
> umuman yetkazmaydi va uni uyg'otmaydi.

### 2-usul: uyg'otuvchi sahifa (pul to'lamasdan, chegarasiz)

`warmup/` papkasida tayyor sahifa bor. Uni GitHub Pages yoki Vercel'ga qo'ying
(u oddiy statik HTML — u yerda hech qachon uxlamaydi). Ichidagi `SERVER`
o'zgaruvchisiga Render manzilingizni yozing.

Do'stlaringizga **shu sahifaning** havolasini bering. Ular kirganda:
chiroyli "Server uyg'onmoqda" ekrani + progress ko'rsatkich chiqadi, sahifa
har 2.5 soniyada serverni tekshiradi va tayyor bo'lishi bilan o'zi o'yinga
o'tkazadi.

Server baribir uxlaydi, lekin **kutish endi tushunarli** — kimdir "havola
ishlamayapti" deb o'ylamaydi. Bu 1-usul bilan birga ishlatilsa eng yaxshi natija.

### 3-usul: pul to'lash

Render **Starter** rejasi (~$7/oy) — hech qachon uxlamaydi, chegara yo'q.
Agar o'yin doimiy ishlashini xohlasangiz, eng sodda yechim shu.

### 4-usul: umuman uxlamaydigan bepul server

**Oracle Cloud Always Free** — haqiqiy virtual server (ARM, 24 GB RAM gacha),
muddatsiz bepul va hech qachon uxlamaydi. Evaziga: o'zingiz Node o'rnatasiz,
`pm2` bilan ishga tushirasiz, domen va SSL ni ham o'zingiz sozlaysiz.
Ro'yxatdan o'tishda karta so'raydi (pul yechilmaydi).

### Ishlamaydigan usul

Serverning o'z ichidan `setInterval` bilan o'ziga ping yuborish — ishonchsiz.
Servis uxlab qolgach protsess to'xtaydi, ping yuboradigan kod ham o'ladi.
Ping **tashqaridan** kelishi kerak.

---

## Qaysi usulni tanlash

| Vaziyat | Tavsiya |
|---|---|
| Do'stlar bilan kelishib o'ynaysiz | Hech narsa qilmang — birinchi odam 40 soniya kutadi, xolos |
| Kechqurunlari muntazam o'ynaysiz | **1-usul** (jadvalli ping) + **2-usul** (uyg'otuvchi sahifa) |
| Havolani ko'pchilikka tarqatmoqchisiz | **3-usul** (Starter) yoki **4-usul** (Oracle) |

**Alternativalar:** Railway, Fly.io, Koyeb, Northflank yoki oddiy VPS
(`pm2 start server.js`). Barchasida bir xil ishlaydi, chunki loyiha oddiy
Node protsessi — hech qanday maxsus sozlash talab qilmaydi.

---

## Vercel haqida

Vercel'ga qo'ysangiz sahifa ochiladi, lekin o'yin buziladi: xonalar server
xotirasida (`const rooms = new Map()`) saqlanadi, Vercel esa har bir ulanishni
boshqa nusxaga yo'naltirishi mumkin — do'stingiz "xona topilmadi" xatosini oladi.
Shuning uchun doimiy protsessli platforma kerak.

---

## 2.0 uchun muhim sozlamalar

| O'zgaruvchi | Nima uchun |
|---|---|
| `KOZOL_SECRET` | Hisob nusxalarini imzolaydi. `render.yaml` orqali joylasangiz Render o'zi yaratadi. Qo'lda yaratgan bo'lsangiz — *Environment* bo'limiga istalgan uzun tasodifiy matn yozing va **hech qachon o'zgartirmang** |
| `TURN_URL`, `TURN_USER`, `TURN_PASS` | Ixtiyoriy. Ovozli chat ba'zi mobil tarmoqlarda ulanmasa kerak bo'ladi (masalan Metered, Twilio yoki o'zingizning coturn serveringiz) |

Ovozli chat faqat `https://` da ishlaydi — Render manzili avtomatik https.

---

## Barqarorlik uchun nima qilingan

**Qayta ulanish.** Har bir o'yinchiga maxfiy token beriladi va brauzerda
saqlanadi. Internet uzilsa:

1. Pastda qizil chiziq chiqadi — *"Aloqa uzildi — qayta ulanmoqda…"*
2. O'rin band qoladi, vaqtincha bot o'ynab turadi (o'yin to'xtamaydi)
3. Aloqa tiklanishi bilan o'yinchi **o'z o'rniga, o'z kartalari bilan** qaytadi
4. Sahifani yangilasa yoki brauzerni yopib ochsa ham — o'sha xonaga qaytadi

Boshqa o'yinchilar uzilib qolganni 🔌 belgisi bilan, haqiqiy botni 🤖 bilan ko'radi.

**Xona kutadi.** Hamma birdan uzilib qolsa, xona darhol o'chmaydi — 5 daqiqa
saqlanib turadi.

**Chiqish ikki xil.** O'yin paytida chiqish tugmasi so'raydi:
«O'rnimga bot qoldirish» (istalgan payt menyudagi «Qaytish» bilan qaytasiz, natija
sizga yoziladi) yoki «O'yinni to'liq tark etish» (mag'lubiyat, o'rningiz butunlay botga
o'tadi va ommaviy xonada boshqa odam uni egallashi mumkin).
