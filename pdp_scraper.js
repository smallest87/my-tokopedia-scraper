(async function() {
  const CONFIG = window.PDP_CONFIG;
  if (!CONFIG) {
    console.error("PDP Config not found!");
    return;
  }

  // --- HELPER: TUNGGU ELEMEN MUNCUL ---
  // Fungsi ini akan mengecek keberadaan elemen setiap 500ms
  // sampai elemen ditemukan atau timeout (default 10 detik)
  function waitForSelector(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      // Jika elemen sudah ada, langsung resolve
      if (document.querySelector(selector)) {
        return resolve(document.querySelector(selector));
      }

      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve(document.querySelector(selector));
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Timeout safety agar tidak hang selamanya
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for selector: ${selector}`));
      }, timeout);
    });
  }

  // --- FUNGSI SCRAPING UTAMA ---
  function scrapePDP() {
    const sel = CONFIG.selectors;
    const details = {
      fullName: "",
      description: "",
      price: "",
      stock: "",
      rating: "",
      sold: "",
      images: [],
      shopName: "",
      shopLocation: ""
    };

    // 1. Nama Lengkap Produk
    const nameEl = document.querySelector(sel.productName);
    if (nameEl) details.fullName = nameEl.innerText;

    // 2. Deskripsi 
    const descEl = document.querySelector(sel.description);
    if (descEl) {
      let text = descEl.innerText;
      if (text.length > 500) text = text.substring(0, 500) + "... (Lihat selengkapnya di web)";
      details.description = text;
    }

    // 3. Harga Detail
    const priceEl = document.querySelector(sel.price);
    if (priceEl) details.price = priceEl.innerText;

    // 4. Stok
    const stockEl = document.querySelector(sel.stock);
    if (stockEl) {
      details.stock = stockEl.innerText.replace(/Stok:\s*/i, '').trim();
    }

    // 5. Gambar
    const imgEls = document.querySelectorAll(sel.images);
    imgEls.forEach(img => {
      // Filter gambar yang valid
      if (img.src && !img.src.startsWith('data:image/svg') && img.src.includes('http')) {
        details.images.push(img.src);
      }
    });

    // 6. Rating & Terjual
    const ratingEl = document.querySelector(sel.rating);
    if (ratingEl) details.rating = ratingEl.innerText;

    const soldEl = document.querySelector(sel.sold);
    if (soldEl) details.sold = soldEl.innerText.replace('Terjual', '').trim();

    // 7. Info Toko & Lokasi
    const shopEl = document.querySelector(sel.shopName);
    if (shopEl) details.shopName = shopEl.innerText;

    const shipmentDiv = document.querySelector(sel.shipmentContainer);
    if (shipmentDiv) {
      const cityBold = shipmentDiv.querySelector('b');
      if (cityBold) details.shopLocation = cityBold.innerText;
    }

    return details;
  }

  // --- EKSEKUSI ---
  try {
    // KITA TUNGGU DULU SAMPAI JUDUL PRODUK MUNCUL
    // Ini adalah indikator bahwa React sudah selesai render konten utama
    console.log("Menunggu render halaman detail...");
    await waitForSelector(CONFIG.selectors.productName);
    
    // Beri jeda ekstra 1 detik untuk gambar & elemen lain memuat sempurna
    await new Promise(r => setTimeout(r, 1000));

    console.log("Halaman siap, mulai scraping detail...");
    const result = scrapePDP();
    
    // Kirim pesan balik
    chrome.runtime.sendMessage({
      action: "pdp_scraped",
      url: window.location.href,
      data: result
    });

  } catch (error) {
    console.error("Gagal Scrape Detail:", error);
    // Opsional: Kirim pesan error ke sidepanel agar user tahu
    chrome.runtime.sendMessage({
      action: "pdp_scraped",
      url: window.location.href,
      data: { description: "Gagal mengambil data: Timeout atau Layout berubah." }
    });
  }

})();