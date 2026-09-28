'use strict';
/* Qoidalar testi:  npm test */
const assert = require('assert');
process.env.DATA_DIR = require('path').join(require('os').tmpdir(), 'kozol-test-' + process.pid);
const K = require('../public/shared.js');
const S = require('../server.js');

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; console.log('  ✓ ' + msg); };

// --- Foydalanuvchi keltirgan misol: zot ♥, 8♣ 9♣ yurilgan ---
const t = ['8C', '9C'];
ok(!K.beatsAll(['AH', '6C'], t, 'H'), 'Zot + 6♣ bilan urib BO\'LMAYDI (6 hech narsani urmaydi)');
ok(!K.beatsAll(['10H', '6C'], t, 'H'), '10♥ + 6♣ ham bo\'lmaydi');
ok(K.beatsAll(['10C', 'JC'], t, 'H'), '10♣ + V♣ — ikkalasini uradi');
ok(K.beatsAll(['7H', '10C'], t, 'H'), '7♥(zot) + 10♣ — bo\'ladi');
ok(K.beatsAll(['6H', '7H'], t, 'H'), 'Ikki zot — bo\'ladi');
ok(K.beatsAll(['JC', '10C'], t, 'H'), 'Kartalar tartibi muhim emas (V♣ + 10♣)');
ok(!K.beatsAll(['9S', '10S'], t, 'H'), 'Boshqa masta (qarg\'a) urolmaydi');
ok(!K.beatsAll(['9C', 'JC'], ['9C', '10C'].map((c) => c), 'H') , '10 ni V urolmaydi');
ok(K.beatsAll(['AC'], ['10C'], 'H'), 'Tuz 10 ni uradi');
ok(!K.beatsAll(['KC'], ['10C'], 'H'), 'Karol 10 ni urolmaydi');
ok(!K.beatsAll(['6H'], ['7H'], 'H'), 'Kichik zot katta zotni urolmaydi');

// --- Server tomonidagi tekshiruv ---
const room = S.createRoom({ mode: 2, target: -6, isPublic: false });
S.fillBots(room);
S.startRound(room, 0);
room.hands[0] = ['8C', '9C', 'KS', '7D'];
room.hands[1] = ['AH', '6C', '10C', 'JC'];
room.trump = 'H';
S.doPlay(room, 0, ['8C', '9C'], false);
ok(S.validatePlay(room, 1, ['AH', '6C'], false) !== null, 'Server: T♥+6♣ ochiq yurish rad etiladi');
ok(S.validatePlay(room, 1, ['AH', '6C'], true) === null, 'Server: o\'sha kartalar bilan YOPIB berish mumkin');
ok(S.validatePlay(room, 1, ['10C', 'JC'], false) === null, 'Server: 10♣+V♣ qabul qilinadi');
const li = S.legalInfo(room, 1);
ok(li.canOpen && li.openable.includes('10C') && !li.openable.includes('6C'), 'Maslahat: 6♣ yoritilmaydi');
const mv = S.botMove(room, 1);
ok(mv && (mv.hidden || K.beatsAll(mv.cards, ['8C', '9C'], 'H')), 'Bot faqat qoidaga mos yuradi');

// --- Level egri chizig'i ---
ok(K.winLp(1) === 100, '1-levelda bitta g\'alaba = +1 level');
ok(K.winLp(60) < K.winLp(10), 'Level oshgan sari LP kamayadi');
ok(K.lossLp(90) > K.lossLp(5), 'Yuqori levelda mag\'lubiyat qimmatroq');
ok(K.applyLp(99, 95, 50).level === 100, '100-levelda to\'xtaydi');
ok(K.applyLp(5, 3, -20).lp === 0 && K.applyLp(5, 3, -20).level === 5, 'Level pastga tushmaydi');
ok(K.GLOVES.length >= 21, 'Kamida 20 xil qo\'lqop bor (' + (K.GLOVES.length - 1) + ')');

console.log(`\n  ${n} ta test o'tdi.`);
process.exit(0);
