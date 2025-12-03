# Changelog

Semua perubahan penting pada proyek ini akan didokumentasikan dalam file ini.

Format ini didasarkan pada [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), dan proyek ini mematuhi [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Planned
- Fitur auto-scroll untuk memuat lebih banyak produk secara otomatis sebelum scraping.
- Integrasi dengan database eksternal (opsional).

## [1.0.0] - 2025-12-04
### Added
- **Side Panel Interface:** UI utama berbasis Side Panel Chrome (Manifest V3).
- **Heuristic Scraping:** Algoritma pengenalan pola (`patterns.js`) untuk mendeteksi Harga, Rating, dan Terjual tanpa bergantung pada *class* CSS acak.
- **Manual Listing Scraper:** Kemampuan memindai produk yang tampil di layar halaman Pencarian dan Halaman Toko.
- **Auto Detail Scraper (Bot):** Fitur otomatisasi untuk membuka tab produk satu per satu, mengambil data detail (Stok, Deskripsi, Gambar HD), lalu menutup tab secara otomatis.
- **Realtime Filter & Search:** Kotak pencarian di panel untuk menyaring hasil *scrape* dengan logika `NOT` (negasi).
- **Sorting Logic:** Pengurutan data berdasarkan Harga (Termurah/Termahal), Rating, dan Waktu Masuk.
- **Data Cleaning:** Konversi otomatis format "Rp10.500" menjadi `10500` (Integer) dan rating menjadi Float untuk akurasi data.
- **Bi-directional Highlight:** Klik item di panel akan menyorot (scroll & highlight merah) produk asli di halaman web.
- **Export Nested JSON:** Output data terstruktur dengan relasi `Toko > Produk > Detail`.
- **Bulk Delete:** Fitur menghapus massal item yang sedang ditampilkan di hasil filter.
- **Page Context Indicator:** Deteksi otomatis jenis halaman (Search, Shop Home, PDP).

### Fixed
- Memperbaiki masalah urutan item di panel agar sesuai dengan urutan visual di halaman web (menggunakan `appendChild`).
- Menangani *crash* browser dengan membatasi proses tab detail menggunakan antrean (queue) dan delay acak.
