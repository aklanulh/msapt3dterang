# MSA 3D Scroll Prototype

Prototipe landing page 3D (Three.js + GSAP ScrollTrigger) untuk PT Mitrajaya Selaras Abadi.
Animasi 3D bergerak mengikuti scroll: DNA helix → ring 4 kategori layanan → jaringan molekul → globe mitra → helix CTA.

Jalankan (butuh server statis karena ES modules):

```bash
python3 -m http.server 8080
# buka http://localhost:8080
```

Semua library sudah di-vendor di `vendor/` (tanpa build step).

## Catatan versi tema terang
- Warna tema: variabel di `style.css` (`:root`) dan konstanta `BG` di `main.js` (latar scene 3D).
- `assets/logo-nama.png` = teks navy untuk latar terang; versi teks putih asli ada di `assets/logo-nama-putih.png`.
- Mobile: menu hamburger, layout 1 kolom, pixel ratio dibatasi, partikel dikurangi.

## Latar bermotif & parallax mouse
- Latar dasar = shader di `main.js` (`bgMesh`): motif plus medis, titik, dan lingkaran yang bergerak terus, ikut bergeser saat scroll sampai footer, dan bereaksi pada kursor (membesar/berputar di dekat mouse, gelombang cincin).
- Parallax mouse: kamera 3D, semua objek 3D, galeri produk, dan elemen teks/kartu (daftar `PARALLAX` di `main.js`). Besaran gerak bisa diubah lewat angka pengali di `tick()` dan nilai kedalaman di `PARALLAX`.
- Di HP (tanpa mouse) latar & objek melayang pelan sendiri; sentuhan juga menggerakkannya.
