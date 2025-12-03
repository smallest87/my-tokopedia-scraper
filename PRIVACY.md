# Kebijakan Privasi (Privacy Policy)

**TokoScraper** adalah ekstensi peramban (browser extension) yang beroperasi secara lokal di perangkat Anda. Kami menghargai privasi Anda dan transparansi adalah prioritas kami.

## Pengumpulan Data

1.  **Data Lokal:**
    Semua data yang diambil (*scraped*) oleh ekstensi ini (seperti nama produk, harga, gambar, dll) disimpan **hanya di dalam memori sementara (RAM)** peramban Anda saat ekstensi aktif.

2.  **Tidak Ada Pengiriman Data:**
    TokoScraper **tidak** mengirimkan data apa pun ke server eksternal, database cloud, atau pihak ketiga mana pun. Data hanya meninggalkan peramban Anda ketika Anda secara eksplisit menekan tombol **"Export JSON"**, yang akan mengunduh file langsung ke penyimpanan lokal komputer Anda.

3.  **Informasi Pengguna:**
    Kami tidak mengumpulkan, melacak, atau menyimpan informasi pribadi pengguna (seperti riwayat browsing, password, atau cookie sesi) selain yang diperlukan untuk fungsi *scraping* (misalnya menggunakan sesi aktif untuk membuka halaman detail produk).

## Izin (Permissions) yang Digunakan

Ekstensi ini memerlukan izin berikut agar dapat berfungsi:

* `sidePanel`: Untuk menampilkan antarmuka pengguna di sisi browser.
* `activeTab` & `scripting`: Untuk membaca data (DOM) pada halaman Tokopedia yang sedang Anda buka.
* `tabs`: Untuk membuka tab baru saat fitur "Auto Detail Scraper" dijalankan.
* `host_permissions` (`https://www.tokopedia.com/*`): Membatasi ekstensi agar hanya bisa berjalan di domain Tokopedia, mencegah akses ke situs lain yang tidak relevan.

## Perubahan Kebijakan

Kebijakan privasi ini dapat diperbarui seiring dengan penambahan fitur baru. Setiap perubahan akan didokumentasikan di halaman ini.

---
*Terakhir diperbarui: Desember 2025*
