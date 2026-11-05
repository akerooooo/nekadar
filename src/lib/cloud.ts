import { db, syncState } from '../db';

/** Firebase ayarlari yayin sirasinda GitHub Variables'tan gelir; yoksa hesap ozelligi gizlenir */
export const cloudEnabled = !!import.meta.env.VITE_FIREBASE_CONFIG;

export const loadSync = () => import('./sync');

const REDIRECT_FLAG = 'nekadar.signinRedirect';
export const markRedirect = () => sessionStorage.setItem(REDIRECT_FLAG, '1');

/** Daha once giris yapildiysa (ya da Google'dan donuluyorsa) eşitlemeyi baslatir */
export async function initCloud() {
  if (!cloudEnabled) return;
  const signedIn = !!(await db.meta.get('syncUid'));
  if (!signedIn && !sessionStorage.getItem(REDIRECT_FLAG)) return;
  sessionStorage.removeItem(REDIRECT_FLAG);
  syncState.on = signedIn; // internet yokken yapilan degisiklikler de kuyruga girsin
  (await loadSync()).init();
}
