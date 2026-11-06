// Firebase eşitleme. Yalnizca giris yapan kullanicilar icin tembel yuklenir (cloud.ts).
// Yerel Dexie esas kaynaktir; buluta users/{uid}/{tablo}/{anahtar} olarak yazilir.
// Cakismada updatedAt'i buyuk olan kazanir; silinenler "deleted" isaretiyle kalir.
import { initializeApp } from 'firebase/app';
import {
  deleteUser,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { liveQuery } from 'dexie';
import { db, defaultCategories, markRemote, SYNCED, syncState } from '../db';
import { markRedirect } from './cloud';

const app = initializeApp(JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG));
const auth = getAuth(app);
const fs = initializeFirestore(app, { ignoreUndefinedProperties: true });
const TABLES = Object.keys(SYNCED);

let uid: string | null = null;
let stops: (() => void)[] = [];
let started = false;

export function init() {
  if (started) return;
  started = true;
  onAuthStateChanged(auth, (user) => (user ? start(user) : stop()).catch(console.error));
}

export async function signIn() {
  init();
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    if ((e as { code?: string }).code !== 'auth/popup-blocked') throw e;
    markRedirect();
    await signInWithRedirect(auth, provider);
  }
}

export const signOut = () => fbSignOut(auth);

/** Buluttaki tum verileri ve hesabi siler. Yereldeki kayitlar kalir. */
export async function deleteAccount() {
  const user = auth.currentUser;
  if (!user) return;
  await reauthenticateWithPopup(user, new GoogleAuthProvider()); // Firebase yakin zamanda giris ister
  stopListeners();
  for (const name of [...TABLES, 'devices', 'server']) { // devices/server: eski bildirim surumunden kalan veriler
    const snap = await getDocs(collection(fs, 'users', user.uid, name));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(fs);
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  await deleteUser(user);
}

async function start(user: User) {
  stopListeners();
  uid = user.uid;
  // Hesap hemen gorunsun; ilk eşitleme arkadan gelir
  await db.meta.put({ key: 'syncEmail', value: user.email ?? '' });
  if ((await db.meta.get('syncUid'))?.value !== uid) {
    await db.meta.put({ key: 'syncBusy', value: '1' });
    try {
      await firstSync(uid);
    } finally {
      await db.meta.delete('syncBusy');
    }
  }
  await db.meta.put({ key: 'ownerUid', value: uid }); // v1.3'te girenler icin de
  syncState.on = true;
  for (const name of TABLES) {
    const since = Number((await db.meta.get(`pull:${name}`))?.value ?? 0);
    const q = query(collection(fs, 'users', uid, name), where('su', '>=', Timestamp.fromMillis(since)));
    stops.push(
      onSnapshot(
        q,
        (snap) => {
          // Kendi bekleyen yazmalarimizin yankisi atlanir
          const docs = snap.docChanges().filter((c) => c.type !== 'removed' && !c.doc.metadata.hasPendingWrites);
          apply(name, docs.map((c) => c.doc)).catch(console.error);
        },
        console.error,
      ),
    );
  }
  const sub = liveQuery(() => db.outbox.count()).subscribe((n) => n && push());
  stops.push(() => sub.unsubscribe());
}

/** Bu cihazda ilk giris: once buluttakini cek, sonra yalnizca yerelde daha yeni olanlari gonder */
async function firstSync(id: string) {
  // Bu cihaz daha once baska bir hesaba aitse onun kayitlari yeni hesaba tasinmaz:
  // yerel veri silinir, yalnizca yeni hesabin bulut verisi gelir.
  const owner = (await db.meta.get('ownerUid'))?.value;
  if (owner && owner !== id) {
    await db.transaction('rw', TABLES.map((n) => db.table(n)), async (tx) => {
      markRemote(tx);
      for (const name of TABLES) if (name !== 'meta') await db.table(name).clear();
      await db.meta.delete('totalBudget');
      await db.cats.bulkAdd(defaultCategories()); // bulutta duzenlenmis hali varsa o kazanir
    });
  }
  const remote = new Map<string, number>();
  const snaps = await Promise.all(TABLES.map((name) => getDocs(collection(fs, 'users', id, name))));
  for (const [i, name] of TABLES.entries()) {
    snaps[i].docs.forEach((d) => remote.set(`${name}/${d.id}`, d.data().updatedAt ?? 0));
    await apply(name, snaps[i].docs);
  }
  await db.transaction('rw', [db.outbox, ...TABLES.map((n) => db.table(n))], async () => {
    await db.outbox.clear();
    const at = Date.now();
    for (const name of TABLES) {
      const rows: Record<string, unknown>[] = await db.table(name).toArray();
      const keys = rows
        .filter((r) => name !== 'meta' || r.key === 'totalBudget')
        .filter((r) => {
          const prev = remote.get(`${name}/${r[SYNCED[name]]}`);
          return prev == null || ((r.updatedAt as number) ?? 0) > prev;
        })
        .map((r) => ({ key: `${name}/${r[SYNCED[name]]}`, at }));
      await db.outbox.bulkPut(keys);
    }
    await db.meta.bulkPut([
      { key: 'syncUid', value: id },
      { key: 'ownerUid', value: id }, // cikista silinmez
    ]);
  });
}

/** Buluttan gelen kayitlari uygular; yerelde daha yeni olan korunur */
async function apply(name: string, docs: QueryDocumentSnapshot<DocumentData>[]) {
  if (!docs.length) return;
  const table = db.table(name);
  const pk = SYNCED[name];
  await db.transaction('rw', [table, db.meta], async (tx) => {
    markRemote(tx);
    const rows = docs.map((d) => d.data());
    const local = await table.bulkGet(rows.map((r) => r[pk]));
    const put: DocumentData[] = [];
    const del: unknown[] = [];
    let maxSu = 0;
    rows.forEach((r, i) => {
      const { su, deleted, ...rec } = r;
      maxSu = Math.max(maxSu, (su as Timestamp | null)?.toMillis() ?? 0);
      if (local[i] && (local[i].updatedAt ?? 0) >= (rec.updatedAt ?? 0)) return;
      if (deleted) del.push(rec[pk]);
      else put.push(rec);
    });
    await table.bulkPut(put);
    await table.bulkDelete(del as string[]);
    const prev = Number((await db.meta.get(`pull:${name}`))?.value ?? 0);
    if (maxSu > prev) await db.meta.put({ key: `pull:${name}`, value: String(maxSu) });
  });
}

let pushing = false;
async function push() {
  if (pushing || !uid) return;
  pushing = true;
  try {
    for (;;) {
      const items = await db.outbox.limit(200).toArray();
      if (!items.length || !uid) break;
      const batch = writeBatch(fs);
      for (const { key } of items) {
        const i = key.indexOf('/');
        const [name, id] = [key.slice(0, i), key.slice(i + 1)];
        const rec = await db.table(name).get(id);
        // su: sunucu saati; cihaz saatleri farkli olsa da "son cekimden beri" sorgusu dogru calisir
        const data = rec ?? { [SYNCED[name]]: id, deleted: true, updatedAt: Date.now() };
        batch.set(doc(fs, 'users', uid, name, id), { ...data, su: serverTimestamp() });
      }
      await batch.commit(); // internet yoksa gelene kadar bekler; uygulama kapanirsa outbox'ta kalir
      await db.transaction('rw', db.outbox, async () => {
        // Gonderim sirasinda yeniden degisen kayit kuyrukta kalsin
        for (const it of items) if ((await db.outbox.get(it.key))?.at === it.at) await db.outbox.delete(it.key);
      });
    }
  } catch (e) {
    console.error('Eşitleme hatası', e); // sonraki degisiklikte yeniden denenir
  } finally {
    pushing = false;
  }
}

function stopListeners() {
  stops.forEach((f) => f());
  stops = [];
}

/** Cikis: yerel kayitlar kalir, eşitleme durumu sifirlanir */
async function stop() {
  stopListeners();
  uid = null;
  syncState.on = false;
  await db.transaction('rw', [db.outbox, db.meta], async () => {
    await db.outbox.clear();
    await db.meta.where('key').startsWith('pull:').delete();
    await db.meta.bulkDelete(['syncUid', 'syncEmail', 'pushOn', 'syncBusy']);
  });
}
