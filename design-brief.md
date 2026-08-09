# Besici Takip — Sıradaki Tasarım İhtiyaçları

Mevcut durum: Hayvanlarım, Hayvan Detayı, Ekleme Formu, Pazar Yeri, İlan Detayı, Topluluk, Hesabım, Diğer, Hatırlatıcılar, Özet ve Admin ekranlarının hepsi "Organic" tasarım sistemiyle (turuncu-toprak `#c67139` + adaçayı yeşili `#7a8a5e` + krem `#f5ead8`, Caprasimo/Figtree fontları) tamamlandı ve canlıda. Aşağıdakiler HENÜZ tasarlanmadı, bunları istiyorum:

## 1. Uygulama İkonu / Logo
Şu an sadece düz turuncu bir daire (placeholder). Gerçek bir simge istiyorum:
- Basit, tek renkli/iki renkli, küçük boyutta (telefon ana ekranında) net okunabilir bir işaret
- Tema: küpe takılı bir inek/sığır başı silüeti, ya da bir küpe (ear tag) ikonu — hayvancılığı çağrıştıran ama karmaşık olmayan bir şekil
- Renkler: Organic paletiyle uyumlu (turuncu `#c67139` zemin üzerine krem `#f5ead8` şekil, ya da tam tersi)
- Boyutlar: 512x512, 192x192, ve iOS için 180x180 (köşeleri kare olsun, yuvarlatma sistem tarafından otomatik yapılıyor)

## 2. Boş Durum İllüstrasyonları (Empty States)
Şu an "Henüz hayvan eklenmemiş" gibi yerler sadece düz metin. Basit, sevimli çizgi illüstrasyonlar istiyorum (fotoğraf değil, ikon/çizim tarzı):
- Hayvanlarım listesi boşken: basit bir ahır/inek çizimi
- Pazar Yeri boşken: bir ilan tahtası/pazar çizimi
- Topluluk boşken: konuşma balonu / iki kişi çizimi
- Stil: Organic paletindeki adaçayı yeşili + krem tonlarında, kalın çizgili, aşırı detaysız (ikon büyüklüğünde, sayfayı doldurmayacak, 120-160px civarı)

## 3. Fotoğraf Yer Tutucusu (Photo Placeholder)
Mockup'ta kullanılan çapraz çizgili (hatched) desen sadece taslak niyetineydi. Gerçek üründe fotoğraf eklenmemiş hayvan/ilan/gönderi kartlarında görünecek kalıcı bir görsel istiyorum:
- Ortada basit bir kamera veya hayvan silüeti ikonu, adaçayı yeşili tonlarında yumuşak bir zemin üzerinde
- Hem yuvarlak (liste avatarı, 44-96px) hem dikdörtgen (kart üstü, 150-220px) versiyonları

## 4. Çoklu Fotoğraf Galerisi (İlan Detayı)
Şu an bir ilana sadece 1 fotoğraf eklenebiliyor. İleride 3-4 fotoğrafa çıkarmayı düşünüyorum, o zaman lazım olacak:
- Üstte kaydırmalı galeri (mockup'taki "1/4" nokta göstergesi gibi)
- Küçük resim şeridi (thumbnail strip) alternatifi de olabilir, ikisini de görmek isterim

## 5. Yükleniyor / Bekleme Durumu
Şu an "Yükleniyor..." düz yazı. Organic stiline uygun basit bir yükleme animasyonu/iskelet (skeleton) tasarımı istiyorum — abartılı olmasın, 1-2 saniyelik bekleme için sade bir nabız/dönen ikon yeterli.

## 6. Paylaşım Görseli (Sosyal Medya Önizleme)
Link WhatsApp/mesajlarda paylaşıldığında görünecek bir kapak görseli (1200x630): uygulama adı "Besici Takip", kısa slogan (ör. "Hayvanını takip et, sat, sor") ve Organic paleti kullanan sade bir arka plan.

---

**Not:** Renk/font sistemi ve tüm ekran düzenleri zaten sabit — bu 6 madde sadece eksik kalan görsel parçalar. Bunları tasarlarken mevcut palet ve komponent diline (yuvarlak köşeler, pill butonlar, Caprasimo başlıklar) sadık kal.
