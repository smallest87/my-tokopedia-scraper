// ==========================================
// 1. SETUP & STATE MANAGEMENT
// ==========================================
let collectedData = []; // Menyimpan state seluruh data
let uniqueUrls = new Set(); // Mencegah duplikasi URL produk

// Elemen DOM
const btnScrape = document.getElementById('btnScrape');
const btnExport = document.getElementById('btnExport');
const statusMsg = document.getElementById('status-msg');
const countLabel = document.getElementById('count');
const resultsContainer = document.getElementById('results');
const pageTypeIndicator = document.getElementById('page-type-indicator');

// Set text tombol export sesuai format baru
if(btnExport) btnExport.innerText = "Export JSON";

// ==========================================
// 2. GLOBAL LISTENERS (Message & Tabs)
// ==========================================

// Listener Pesan dari Content Scripts (PDP Scraper)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Menangani data detail yang dikirim dari tab produk yang baru dibuka
  if (message.action === "pdp_scraped") {
    handlePDPData(message.url, message.data);
  }
});

// Auto-Detect: Saat Sidepanel dibuka
(async function initPageCheck() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) updatePageIndicator(tab.url);
  } catch (e) { console.log(e); }
})();

// Auto-Detect: Saat URL berubah (Navigasi SPA)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id === tabId) updatePageIndicator(tabs[0].url);
    });
  }
});

// Auto-Detect: Saat ganti Tab Browser
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab && tab.url) updatePageIndicator(tab.url);
});

// ==========================================
// 3. LOGIKA DETEKSI HALAMAN
// ==========================================
function updatePageIndicator(url) {
  if (!url.includes('tokopedia.com')) {
    setIndicator("❌ Bukan Halaman Tokopedia", "#ffebee", "#c62828", "#ffcdd2");
    if(btnScrape) btnScrape.disabled = true;
    return;
  }

  if(btnScrape) btnScrape.disabled = false;
  const type = detectPageType(url);
  
  switch (type.code) {
    case 'search': setIndicator(type.label, "#fff3e0", "#e65100", "#ffe0b2"); break;
    case 'shop_home':
    case 'shop_list':
    case 'shop_review': setIndicator(type.label, "#e8f5e9", "#1b5e20", "#c8e6c9"); break;
    case 'pdp': setIndicator(type.label, "#e3f2fd", "#0d47a1", "#bbdefb"); break;
    default: setIndicator(type.label, "#f5f5f5", "#616161", "#e0e0e0");
  }
}

function setIndicator(text, bg, color, border) {
  if(!pageTypeIndicator) return;
  pageTypeIndicator.innerText = text;
  pageTypeIndicator.className = 'page-info';
  pageTypeIndicator.style.backgroundColor = bg;
  pageTypeIndicator.style.color = color;
  pageTypeIndicator.style.borderColor = border;
}

function detectPageType(urlString) {
  try {
    const url = new URL(urlString);
    const path = url.pathname;
    const segments = path.split('/').filter(s => s.length > 0);

    if (path.startsWith('/search')) return { code: 'search', label: "🔍 Halaman Hasil Pencarian" };

    if (segments.length >= 1) {
      const reservedRoot = ['about', 'promo', 'help', 'cart', 'user', 'login', 'discovery', 'category'];
      if (reservedRoot.includes(segments[0])) return { code: 'other', label: "📄 Halaman Tokopedia Umum" };

      if (segments.length === 1) return { code: 'shop_home', label: "🏠 Halaman Beranda Toko" };

      if (segments.length >= 2) {
        const secondSegment = segments[1].toLowerCase();
        if (secondSegment === 'review') return { code: 'shop_review', label: "⭐ Halaman Review Toko" };
        if (secondSegment === 'product' || secondSegment === 'etalase') return { code: 'shop_list', label: "🏪 Halaman Produk Toko" };
        
        const reservedSecond = ['review', 'product', 'etalase', 'info', 'catatan', 'delivery'];
        if (!reservedSecond.includes(secondSegment)) return { code: 'pdp', label: "📦 Halaman Detail Produk" };
      }
    }
    return { code: 'other', label: "📄 Halaman Tokopedia Umum" };
  } catch (e) {
    return { code: 'unknown', label: "❓ URL Tidak Valid" };
  }
}

// ==========================================
// 4. HANDLER TOMBOL SCRAPE (MAIN)
// ==========================================
btnScrape.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('tokopedia.com')) {
    updateStatus("Error: Buka halaman Tokopedia dulu!", "red");
    return;
  }

  updatePageIndicator(tab.url);
  updateStatus("Sedang memindai halaman...", "orange");

  // Injeksi file berurutan: Patterns -> Content Script
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['patterns.js', 'content.js'] 
  }, () => {
    
    if (chrome.runtime.lastError) {
      updateStatus("Gagal inject script. Refresh halaman.", "red");
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: "scrape_visible" }, (response) => {
      if (chrome.runtime.lastError) {
        updateStatus("Koneksi terputus. Refresh halaman.", "red");
        return;
      }

      if (response && response.status === "success") {
        processNewData(response.data);
      } else {
        updateStatus("Gagal membaca data.", "red");
      }
    });
  });
});

// ==========================================
// 5. PROCESSING & PARSING DATA
// ==========================================
function processNewData(items) {
  let newCount = 0;

  items.forEach(item => {
    if (item.productUrl && !uniqueUrls.has(item.productUrl)) {
      
      // Parse Data Tambahan
      item.shopUsername = extractUsername(item.productUrl);
      const parsedShop = parseShopData(item.shopLocation);
      item.cleanShopName = parsedShop.name;
      item.cleanLocation = parsedShop.location;

      uniqueUrls.add(item.productUrl);
      collectedData.push(item);
      renderItem(item); // Render ke UI
      newCount++;
    }
  });

  countLabel.innerText = collectedData.length;
  
  if (newCount > 0) {
    updateStatus(`+${newCount} produk baru. Scroll lagi!`, "green");
    btnExport.disabled = false;
  } else {
    updateStatus("Tidak ada produk baru di layar.", "#666");
  }
}

// --- Helper Functions ---
function parseShopData(combinedString) {
  if (!combinedString) return { name: "-", location: "-" };
  const parts = combinedString.split(" - ");
  if (parts.length === 1) return { name: parts[0], location: "-" };
  const location = parts.pop(); 
  const name = parts.join(" - "); 
  return { name, location };
}

function extractUsername(urlString) {
  try {
    const url = new URL(urlString);
    const segments = url.pathname.split('/');
    if (segments.length > 1 && segments[1]) return segments[1];
    return "-";
  } catch (e) { return "-"; }
}

function updateStatus(text, color) {
  statusMsg.innerText = text;
  statusMsg.style.color = color;
}

// ==========================================
// 6. RENDER UI (ITEM + DETAIL LOGIC)
// ==========================================
function renderItem(item) {
  const div = document.createElement('div');
  div.className = 'item-preview';
  
  // ID Unik untuk Container Detail (menggunakan Base64 dari URL agar safe)
  const uniqueId = btoa(item.productUrl).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  div.setAttribute('data-url', item.productUrl); // Penanda untuk pencarian balik

  // Logika Warna Badge
  let badgeColor = "#999"; let badgeText = "Regular";
  if (item.shopBadge === "Mall") { badgeColor = "#D6001C"; badgeText = "Mall"; }
  else if (item.shopBadge === "Power Shop") { badgeColor = "#00AA5B"; badgeText = "Power Pro"; }

  div.innerHTML = `
    <img src="${item.imageUrl}" alt="img" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #eee;">
    <div style="flex: 1; overflow: hidden; padding-left: 10px; display: flex; flex-direction: column; justify-content: center;">
      
      <div style="font-weight:600; font-size: 11px; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.name}">${item.name}</div>
      <div style="color: #00AA5B; font-weight: bold; font-size: 12px; margin-top: 2px;">${item.price}</div>
      
      <div style="font-size: 10px; color: #fa591d; margin-top: 2px;">
        ${item.rating ? `⭐ ${item.rating}` : ''} ${item.sold ? ` | ${item.sold}` : ''}
      </div>

      <div class="action-row" style="margin-top: 4px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display:flex; align-items:center;">
           <span style="background:${badgeColor}; color:white; padding: 1px 4px; border-radius:3px; font-weight:bold; font-size:9px; margin-right:5px;">${badgeText}</span>
           <span style="font-size: 10px; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;">${item.cleanShopName}</span>
        </div>
        
        <button class="btn-open-scrape" style="border:1px solid #00AA5B; background:white; color:#00AA5B; border-radius:3px; cursor:pointer; font-size:9px; padding:2px 6px;">
           🔗 Buka & Detail
        </button>
      </div>
      
      <div style="font-size: 9px; color: #888; margin-top: 2px;">
         📍 ${item.cleanLocation} (${item.shopUsername})
      </div>
    </div>

    <div id="detail-${uniqueId}" class="detail-box">
      <div class="status-loading">⏳ Membuka tab & mengambil detail...</div>
      <div class="content-detail" style="display:none;">
         <div class="detail-images"></div>
         <p style="margin:2px 0;"><b>Stok:</b> <span class="val-stock">-</span></p>
         <p style="margin:2px 0;"><b>Deskripsi:</b> <span class="val-desc">-</span></p>
      </div>
    </div>
  `;

  // --- Attach Event Listener ke Tombol Buka ---
  const btnOpen = div.querySelector('.btn-open-scrape');
  const detailBox = div.querySelector(`#detail-${uniqueId}`);

  btnOpen.onclick = () => {
    detailBox.classList.add('visible'); // Tampilkan box detail
    
    // Buka Tab Baru
    chrome.tabs.create({ url: item.productUrl, active: true }, (newTab) => {
      
      // Listener: Tunggu tab selesai loading (status: complete)
      const listener = (tabId, changeInfo, tab) => {
        if (tabId === newTab.id && changeInfo.status === 'complete') {
          
          chrome.tabs.onUpdated.removeListener(listener); // Hapus listener agar hemat memori
          
          // Inject PDP Patterns & PDP Scraper
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['pdp_patterns.js', 'pdp_scraper.js']
          });
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  };

  resultsContainer.appendChild(div); 
}

// --- Handler Data Detail yang Diterima ---
function handlePDPData(url, data) {
  // Normalisasi URL untuk pencarian (remove query params)
  const cleanUrl = url.split('?')[0];
  
  // Cari elemen di sidepanel yang cocok dengan URL ini
  // Menggunakan selector contains attribute (^=)
  const itemDiv = document.querySelector(`div[data-url^="${cleanUrl}"]`);
  
  if (!itemDiv) {
    console.warn("Item tidak ditemukan untuk detail:", url);
    return;
  }

  // Generate ulang ID unik
  const uniqueId = btoa(itemDiv.getAttribute('data-url')).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const detailBox = document.getElementById(`detail-${uniqueId}`);
  if (!detailBox) return;

  // Update UI Detail
  const loading = detailBox.querySelector('.status-loading');
  const content = detailBox.querySelector('.content-detail');
  const imgContainer = detailBox.querySelector('.detail-images');
  
  loading.style.display = 'none';
  content.style.display = 'block';
  
  detailBox.querySelector('.val-desc').innerText = data.description || "-";
  detailBox.querySelector('.val-stock').innerText = data.stock || "-";

  // Render Gambar Thumbnail
  imgContainer.innerHTML = '';
  if (data.images && data.images.length > 0) {
    data.images.slice(0, 5).forEach(src => {
      const img = document.createElement('img');
      img.src = src;
      imgContainer.appendChild(img);
    });
  }

  // Tampilkan Lokasi Pengiriman jika ada (data dari detail lebih akurat)
  if (data.shopLocation) {
    const locInfo = document.createElement('div');
    locInfo.style.cssText = "font-size: 9px; color: #555; margin-top: 5px; border-top: 1px dashed #ccc; padding-top: 4px;";
    locInfo.innerHTML = `<b>Pengiriman:</b> ${data.shopLocation}`;
    content.appendChild(locInfo);
  }

  // MERGE DATA KE MEMORI (Untuk Export JSON)
  const dataIndex = collectedData.findIndex(d => d.productUrl === itemDiv.getAttribute('data-url'));
  if (dataIndex !== -1) {
    collectedData[dataIndex].details = data;
  }
}

// ==========================================
// 7. EXPORT NESTED JSON
// ==========================================
btnExport.addEventListener('click', () => {
  if (collectedData.length === 0) {
    updateStatus("Belum ada data untuk diekspor!", "red");
    return;
  }
  
  // Transformasi Data ke Struktur Toko > Produk
  const shopsMap = new Map();

  collectedData.forEach(item => {
    const shopKey = item.shopUsername || "unknown_shop";

    if (!shopsMap.has(shopKey)) {
      shopsMap.set(shopKey, {
        shopInfo: {
          username: item.shopUsername,
          name: item.cleanShopName,
          location: item.cleanLocation,
          badge: item.shopBadge,
          rawLocationString: item.shopLocation
        },
        products: [] 
      });
    }

    // Gunakan DataFormatter untuk membersihkan tipe data
    const productEntry = {
      name: item.name,
      price: typeof DataFormatter !== 'undefined' ? DataFormatter.price(item.price) : item.price,
      rating: typeof DataFormatter !== 'undefined' ? DataFormatter.rating(item.rating) : item.rating,
      sold: typeof DataFormatter !== 'undefined' ? DataFormatter.sold(item.sold) : item.sold,
      
      originalPrice: item.price, // Simpan raw string
      originalSold: item.sold,   // Simpan raw string
      
      imageUrl: item.imageUrl,
      link: item.productUrl,
      
      // Data Detail (Jika sudah discrape)
      detail: null
    };

    if (item.details) {
      productEntry.detail = {
        fullName: item.details.fullName,
        description: item.details.description,
        stock: item.details.stock, // Angka/String stok
        images: item.details.images,
        shopLocationFromDetail: item.details.shopLocation
      };
    }

    shopsMap.get(shopKey).products.push(productEntry);
  });

  const finalJsonData = Array.from(shopsMap.values());

  // Download File JSON
  const jsonString = JSON.stringify(finalJsonData, null, 2); 
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  link.setAttribute("href", url);
  link.setAttribute("download", `tokopedia_data_${timestamp}.json`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});