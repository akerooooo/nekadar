# Nekadar – Harcama Takibi

iPhone'da (ve her telefonda) çalışan, **ücretsiz**, kurulum gerektirmeyen harcama takip uygulaması.
Veriler yalnızca kullanıcının kendi telefonunda saklanır: hesap, sunucu ya da reklam yoktur.

**Özellikler:** hızlı gider/gelir girişi · fişten tutar okuma · kategori grafikleri · son 6 ay karşılaştırması ·
aylık bütçe limitleri ve uyarılar · yedekleme (JSON) ve Excel tablosu (CSV) · açık/koyu tema · internetsiz çalışma

## Bilgisayarda çalıştırma

```bash
npm install
npm run dev
```

Tarayıcıda `http://localhost:5173/nekadar/` adresini aç.

## Herkesin kullanabilmesi için yayınlama (ücretsiz – GitHub Pages)

1. [github.com](https://github.com) üzerinde ücretsiz bir hesap aç.
2. `nekadar` adında yeni bir **public** depo oluştur.
3. Bu klasörde:
   ```bash
   git init
   git add .
   git commit -m "Nekadar ilk sürüm"
   git branch -M main
   git remote add origin https://github.com/KULLANICI_ADIN/nekadar.git
   git push -u origin main
   ```
4. GitHub'da depo → **Settings → Pages → Source: GitHub Actions** seç.
5. Birkaç dakika sonra uygulama `https://KULLANICI_ADIN.github.io/nekadar/` adresinde yayında olur.
   Her `git push` sonrası otomatik güncellenir.

## iPhone'a kurulum (kullanıcılar için)

1. Linki **Safari** ile aç.
2. Alttaki **Paylaş** düğmesine (kare ve yukarı ok) dokun.
3. **Ana Ekrana Ekle**'yi seç.

Uygulama kendi simgesiyle ana ekranda görünür, tam ekran açılır ve internetsiz çalışır.

> **Önemli:** Veriler telefonda durduğu için telefon değiştirirken **Ayarlar → Yedek al** ile dosyayı
> iCloud Drive'a kaydet, yeni telefonda **Yedekten geri yükle** ile aç.

## Hesap, eşitleme ve bildirimler (isteğe bağlı, Firebase Spark – ücretsiz)

Ayarlar yapılmazsa uygulama hesapsız çalışır ve Hesap bölümü görünmez.

1. Firebase konsolunda proje aç; Authentication > Google girişini aç; Authorized domains'e `akerooooo.github.io` ekle.
2. Firestore Database oluştur (production mode) ve Rules sekmesine `firestore.rules` içeriğini yapıştır.
3. Project settings > General > Web app ekle; çıkan `firebaseConfig` nesnesini JSON olarak GitHub'da
   Settings > Secrets and variables > Actions > **Variables** > `FIREBASE_CONFIG` adıyla kaydet.
4. Project settings > Cloud Messaging > Web Push certificates > Generate key pair; anahtarı `FIREBASE_VAPID_KEY` değişkeni olarak kaydet.
5. Project settings > Service accounts > Generate new private key; dosyanın içeriğini **Secrets** > `FIREBASE_SERVICE_ACCOUNT` olarak kaydet (bu gizlidir, kimseyle paylaşma).
6. Actions'ta "GitHub Pages'e yayınla" iş akışını yeniden çalıştır. Günlük bildirimleri `.github/workflows/notify.yml` her sabah 10:00'da gönderir.

## Teknik

Vite + React + TypeScript · Dexie (IndexedDB) · Recharts · Tesseract.js (fiş okuma, cihaz üzerinde) · vite-plugin-pwa

- Simgeleri yeniden üretmek için: `npm run icons`
- Fiş okuma ilk kullanımda Türkçe dil dosyasını (~2 MB) indirir, sonra önbellekten çalışır.
