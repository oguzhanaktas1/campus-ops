# Uygulama Guvenligi

## Uygulanan Kontroller

- input validation
  - Global `ValidationPipe` artik `whitelist + forbidNonWhitelisted + stopAtFirstError` ile calisiyor.
  - API body boyutu `1 MB` ile sinirlandi.

- server-side permission checks
  - `document-requests/inbox` sadece `ADMIN/STAFF`.
  - `equipment-requests/inbox` sadece `ADMIN/STAFF`.
  - `room-reservation-requests` ve `room-reservation-requests/inbox` sadece `ADMIN/STAFF`.
  - Generic `requests` yorum ve watcher endpointleri artik request erisim kurallarini server tarafinda zorunlu kilıyor.
  - Bir ogrenci baska bir kullaniciyi watcher olarak ekleyip veri gorunurlugu artiramaz.

- upload validation
  - Dosya boyutu `10 MB` ile sinirli.
  - Coklu yukleme `5` dosya ile sinirli.
  - Izinli MIME listesi disindaki dosyalar reddediliyor.
  - Dosya adlari sanitize edilip object key olarak saklaniyor.

- signed URLs for files
  - Yeni ve mevcut Supabase dosyalari kalici public URL yerine kisa omurlu signed URL ile sunuluyor.
  - Storage kaydinda public URL degil object path tutuluyor.

- rate limit
  - `auth/login` ve `auth/register` IP/email bazli attempt limiti ile korunuyor.
  - 5 hatali denemeden sonra gecici `429` blokaji uygulanıyor.

- audit trail
  - Basarili ve basarisiz auth denemeleri loglaniyor.
  - User create ve file upload islemleri audit kaydina dusuyor.

- transport / response hardening
  - `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `COOP`, `CORP` headerlari eklendi.
  - Production icin `HSTS` aktif.
  - `x-powered-by` kapatildi.
  - CORS artik izinli origin listesi ile calisiyor.

## Kalan Riskler

- webhook signature verification
  - Repo icinde aktif webhook endpoint implementasyonu yok.
  - Yeni webhook endpoint eklenirse HMAC tabanli imza dogrulamasi zorunlu olmalı.

- cookie session model
  - Oturum artik `httpOnly` cookie ile tasiniyor; frontend JWT saklamiyor.
  - Tarayicida sadece dusuk riskli oturum isareti ve profil cache'i tutuluyor.
  - Sonraki asama olarak CSRF korumasi icin state-changing endpointlerde origin kontrolu veya CSRF token eklenmeli.

- signed URL gecisi
  - Eski public bucket konfigurasyonu altyapi tarafinda halen acik olabilir.
  - Uygulama artik signed URL uretiyor, fakat bucket policy de private moda alinmali.

- advanced abuse protection
  - Auth rate limit su an process-memory tabanli.
  - Birden fazla backend replica / restart senaryosunda Redis tabanli distributed limiter tercih edilmeli.
