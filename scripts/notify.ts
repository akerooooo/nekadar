// Gunluk bildirim gonderici. GitHub Actions'ta (.github/workflows/notify.yml) calisir.
// FIREBASE_SERVICE_ACCOUNT gizli anahtari yoksa hicbir sey yapmadan cikar.
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, type CollectionReference } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { buildMessages, istanbulToday, nextSent, type UserData } from './notify-lib.ts';

const key = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!key) {
  console.log('FIREBASE_SERVICE_ACCOUNT tanımlı değil, bildirim gönderilmedi.');
  process.exit(0);
}

initializeApp({ credential: cert(JSON.parse(key)) });
const fs = getFirestore();
const fcm = getMessaging();
const today = istanbulToday(new Date());
const month = today.slice(0, 7);

const live = async (ref: CollectionReference) => (await ref.get()).docs.map((d) => d.data()).filter((d) => !d.deleted);

let users = 0;
let sent = 0;
for (const user of await fs.collection('users').listDocuments()) {
  const devices = await user.collection('devices').get();
  if (devices.empty) continue; // bildirim acmamis kullanicinin verisi okunmaz (kota)
  users++;
  const notifyDoc = user.collection('server').doc('notify');
  const [subs, cats, budgets, total, txs, state] = await Promise.all([
    live(user.collection('subs')),
    live(user.collection('cats')),
    live(user.collection('budgets')),
    user.collection('meta').doc('totalBudget').get(),
    user.collection('entries').where('date', '>=', `${month}-01`).where('date', '<=', `${month}-31`).get(),
    notifyDoc.get(),
  ]);
  const data: UserData = {
    today,
    subs: subs as UserData['subs'],
    cats: cats as UserData['cats'],
    budgets: budgets as UserData['budgets'],
    totalBudget: total.data()?.deleted ? 0 : Number(total.data()?.value ?? 0),
    monthTxs: txs.docs.map((d) => d.data()).filter((d) => !d.deleted) as UserData['monthTxs'],
    sent: state.data()?.sent ?? {},
  };
  const messages = buildMessages(data);
  if (!messages.length) continue;

  for (const device of devices.docs) {
    for (const m of messages) {
      try {
        await fcm.send({ token: device.data().token, data: { title: m.title, body: m.body, tag: m.key }, webpush: { headers: { Urgency: 'high' } } });
        sent++;
      } catch (e) {
        const code = (e as { code?: string }).code ?? '';
        // Uygulama silinmis ya da izin kaldirilmis: cihaz kaydini temizle
        if (/registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code)) {
          await device.ref.delete();
          break;
        }
        console.error(code || e);
      }
    }
  }
  await notifyDoc.set({ sent: nextSent(data, messages) });
}
console.log(`${today}: ${users} kullanıcı, ${sent} bildirim gönderildi.`);
