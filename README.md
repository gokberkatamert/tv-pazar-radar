# TV Radar v2.0 — TV fiyat ve ürün istihbaratı

Altı kategori kaynağından televizyon ilanlarını toplamayı amaçlayan, **gerçek fiyat uydurmayan**, haftalık fiyat, 28+ günlük fiyat trendi ve aynı modelin resmi fiyat karşılaştırmasını sağlayan React + Vite dashboard.

## Takip edilen kaynaklar

| Kaynak | URL | Tür |
|---|---|---|
| MediaMarkt | https://www.mediamarkt.com.tr/tr/category/televizyon-465019.html | Perakendeci |
| Teknosa | https://www.teknosa.com/televizyon-c-101001 | Perakendeci |
| Vatan Bilgisayar | https://www.vatanbilgisayar.com/televizyon/ | Perakendeci |
| Arçelik | https://www.arcelik.com.tr/televizyon | Resmi katalog |
| Beko | https://www.beko.com.tr/televizyon | Resmi katalog |
| Grundig | https://www.grundig.com.tr/televizyon | Resmi katalog |

Resmi kataloglardaki diğer marka ürünleri filtrelenir. Kategori sayfalarındaki ürünlerin **tamamının** elde edilmesi, sitelerin erişim ve sayfalama davranışına bağlıdır. Siteler otomasyona engel koyabilir; ilk çalıştırma sonrası her kaynağın `count`, `expectedCount`, `ok`, `error` alanları ve GitHub Actions logları gözden geçirilmelidir. Kontrol edilemeyen veriden kesin sonuç çıkarılmamalıdır.

## GitHub + Vercel kurulumu

1. ZIP içindeki klasörün **içindekileri** yeni bir GitHub repository'sinin köküne yükleyin. GitHub'da **Add file → Upload files** kolay yoldur. Alternatif olarak terminalde:

   ```bash
   git init
   git add .
   git commit -m "TV Radar v2"
   git branch -M main
   git remote add origin https://github.com/KULLANICI/REPO.git
   git push -u origin main
   ```

2. Vercel → Add New → Project → Import Git Repository. Framework **Vite**, build `npm run build`, output `dist`. Vercel, GitHub'a işlenen `data/latest.json` dosyasını da dağıtıma ekler.
3. GitHub → Actions → **Collect TV prices** → **Run workflow**. Workflow Node 22 ve Playwright Chromium kurar, altı kategoriyi taramaya çalışır, geçmiş JSON'ları kaydeder, haftalık rapor üretir ve otomatik commit/push yapar. Repository Actions permissions kısmında **Read and write permissions** seçili olmalıdır. `main` koruma kuralları otomatik push'a izin vermiyorsa ayrı bir data branch/PR yöntemi gerekir.
4. **Her pazar 13:00 İstanbul saati** için `.github/workflows/collect.yml` içinde `0 10 * * 0` UTC schedule yer alır. GitHub Actions yoğunlukta gecikebilir. İlk taramadan önce fiyat değişimi oluşmaz; 28+ günlük rapor ilk uygun tarihsel karşılaştırmadan sonra görünür.
5. İsterseniz GitHub → Settings → Secrets and variables → Actions bölümüne `RESEND_API_KEY`, `REPORT_EMAIL_TO`, `REPORT_EMAIL_FROM` secrets ekleyin. `DASHBOARD_URL` repository variable'ını Vercel adresine ayarlayın. Resend gönderici alan adını doğrulamanız gerekir. Bu bilgiler eklenmeden e-posta bildirimi gönderilmez.

## Yerelde çalıştırma

```bash
npm install
npm run dev
# Canlı veri toplamak için ayrıca:
npx playwright install chromium
npm run collect
npm run report
npm run build
```

Node.js **22** önerilir. İlk kez `npm run collect` çalıştırılana kadar dashboard boş kalır. Bu pakette gerçek tarama gerçekleştirilmiş değildir.

## Model kıyası ve raporlama

- `scripts/model.mjs`: aynı marka + tanımlanabilir **kesin model kodu** temel alınır. Farklı çapraz marka veya yalnızca ekran boyutu eşleşmesi yapılmaz. Eşleşmeyen ürünler kıyas listesinde gösterilmez; model ayrıştırması için gerçek sitelerle test ve gerektiğinde kural iyileştirmesi gerekir.
- `scripts/collect.mjs`: perakende ilanları + resmi marka katalogları, fiyat değişimi, yeni ilanlar, tarihi JSON kayıtları. Başarısız mağaza verileri korunur. 28+ günlük karşılaştırmada iki tarihte de güvenilir olan **aynı ilanlar** kullanılır. Genel trend, tüm perakende ilanlarının ortalamasıdır ve ürün karması etkisi içerir.
- `src/Reports.jsx`: dashboard içinde fiyat trend grafiği, aylık yönetici özeti, doğrudan resmi site/perakende fiyat linkleri ve PDF / `.docx` dışa aktarma.
- `scripts/report.mjs`: özet metin ve isteğe bağlı haftalık e-posta.
- `data/latest.json`, `data/history/YYYY-MM-DD.json`: Vercel tarafından sunulan güncel ve tarihsel veri. GitHub'ın depolama büyümesi için gerekirse ileri tarihte ayrı veritabanına geçilebilir.

## Kritik sınırlamalar

- Bunlar **ürün listeleme fiyatlarıdır**; ödeme, üyelik, taksit, kupon veya lokasyona göre değişebilir.
- Ürün listelerine satıcının bot koruması, gizli API kullanımı, sayfalama ve dinamik yükleme sınırlamaları uygulanabilir. Kod best-effort prototiptir; **tüm ürünlerin eksiksiz çekildiği veya ilk çalıştırmada sorunsuz veri geldiği garanti edilmez**. Özellikle resmi sitelerde kategori büyüklüğü marka filtresinden farklı olabilir.
- Dashboard'da "yeni ilan", piyasaya yeni çıkan modelin teyidi anlamına gelmez.
- 28+ günlük kıyas, son 28 gün içinde seçilen referansa göre ortak ilanların fiyatlarını kıyaslar; tam takvim ayı değildir.
- PDF çıktı tarayıcıda görsel tabanlı üretilir; Word `.docx` düzenlenebilir metindir. PDF/Word, katalogdaki her ilanı değil yönetici özetini ve ilk 25 resmi fiyat karşılaştırmasını içerir. Tüm ilanlar CSV olarak alınabilir.
- Resmi site/veri hakları, robots/şartlar ve kullanım kuralları kontrol edilmelidir; sitelerden izinli API/feed erişimi almanız uzun vadede daha güvenilirdir.
