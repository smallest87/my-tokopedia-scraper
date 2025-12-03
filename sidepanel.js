// ==========================================
// 1. SETUP & VARIABEL GLOBAL
// ==========================================
let collectedData = []; 
let uniqueUrls = new Set(); 

// Referensi Elemen DOM
const btnScrape = document.getElementById('btnScrape');
const btnExport = document.getElementById('btnExport');
const statusMsg = document.getElementById('status-msg');
const countLabel = document.getElementById('count');
const resultsContainer = document.getElementById('results');
const pageTypeIndicator = document.getElementById('page-type-indicator');

// ==========================================
// 2. AUTO-DETECT LISTENERS
// ==========================================

// Init check
(async function initPageCheck() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) updatePageIndicator(tab.url);
  } catch (e) { console.log(e); }
})();

// URL Change check
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id === tabId) updatePageIndicator(tabs[0].url);
    });
  }
});

// Tab Switch check
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab && tab.url) updatePageIndicator(tab.url);
});

// ==========================================
// 3. LOGIKA DETEKSI HALAMAN (UPDATED)
// ==========================================
function updatePageIndicator(url) {
  if (!url.includes('tokopedia.com')) {
    setIndicator("❌ Bukan Halaman Tokopedia", "#ffebee", "#c62828", "#ffcdd2");
    btnScrape.disabled = true;
    return;
  }

  btnScrape.disabled = false;
  const type = detectPageType(url);
  
  // Set tampilan berdasarkan kode tipe halaman
  switch (type.code) {
    case 'search':
      setIndicator(type.label, "#fff3e0", "#e65100", "#ffe0b2"); // Oranye
      break;
    case 'shop_home':
    case 'shop_list':
    case 'shop_review':
      setIndicator(type.label, "#e8f5e9", "#1b5e20", "#c8e6c9"); // Hijau
      break;
    case 'pdp':
      setIndicator(type.label, "#e3f2fd", "#0d47a1", "#bbdefb"); // Biru
      break;
    default:
      setIndicator(type.label, "#f5f5f5", "#616161", "#e0e0e0"); // Abu-abu
  }
}

function setIndicator(text, bg, color, border) {
  pageTypeIndicator.innerText = text;
  pageTypeIndicator.className = 'page-info';
  pageTypeIndicator.style.backgroundColor = bg;
  pageTypeIndicator.style.color = color;
  pageTypeIndicator.style.borderColor = border;
}

// LOGIKA UTAMA: Parsing Struktur URL
function detectPageType(urlString) {
  try {
    const url = new URL(urlString);
    const path = url.pathname;
    
    // Memecah path menjadi segmen dan membuang string kosong
    // Contoh: "/ghmusic/product" -> ["ghmusic", "product"]
    const segments = path.split('/').filter(s => s.length > 0);

    // 1. CEK HALAMAN SEARCH
    if (path.startsWith('/search')) {
      return { code: 'search', label: "🔍 Halaman Hasil Pencarian" };
    }

    // 2. CEK STRUKTUR TOKO & PRODUK
    if (segments.length >= 1) {
      // Daftar kata kunci yang BUKAN nama toko (Reserved words)
      const reservedRoot = ['about', 'promo', 'help', 'cart', 'user', 'login', 'discovery', 'category'];
      
      // Jika segmen pertama adalah kata kunci sistem, anggap halaman umum
      if (reservedRoot.includes(segments[0])) {
        return { code: 'other', label: "📄 Halaman Tokopedia Umum" };
      }

      // --- LOGIKA SEGMENTASI ---
      
      // A. Halaman Beranda Toko: /{username} (Hanya 1 segmen)
      if (segments.length === 1) {
        return { code: 'shop_home', label: "🏠 Halaman Beranda Toko" };
      }

      // B. Cek Sub-halaman Toko (Segmen ke-2)
      if (segments.length >= 2) {
        const secondSegment = segments[1].toLowerCase();

        // /{username}/review
        if (secondSegment === 'review') {
          return { code: 'shop_review', label: "⭐ Halaman Review Toko" };
        }

        // /{username}/product atau /{username}/etalase
        if (secondSegment === 'product' || secondSegment === 'etalase') {
          return { code: 'shop_list', label: "🏪 Halaman Produk Toko" };
        }

        // C. Halaman Detail Produk: /{username}/{produk-slug}
        // Syarat: Segmen ke-2 BUKAN review, product, info, catatan, dll.
        const reservedSecond = ['review', 'product', 'etalase', 'info', 'catatan', 'delivery'];
        if (!reservedSecond.includes(secondSegment)) {
          return { code: 'pdp', label: "📦 Halaman Detail Produk" };
        }
      }
    }
    
    return { code: 'other', label: "📄 Halaman Tokopedia Umum" };

  } catch (e) {
    return { code: 'unknown', label: "❓ URL Tidak Valid" };
  }
}

// ==========================================
// 4. HANDLER TOMBOL SCRAPE
// ==========================================
btnScrape.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('tokopedia.com')) {
    updateStatus("Error: Bukan Tokopedia", "red");
    return;
  }

  updatePageIndicator(tab.url); // Refresh indicator saat klik
  updateStatus("Sedang memindai...", "orange");

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
// 5. PROCESSING DATA
// ==========================================
function processNewData(items) {
  let newCount = 0;
  items.forEach(item => {
    if (item.productUrl && !uniqueUrls.has(item.productUrl)) {
      item.shopUsername = extractUsername(item.productUrl);
      const parsedShop = parseShopData(item.shopLocation);
      item.cleanShopName = parsedShop.name;
      item.cleanLocation = parsedShop.location;

      uniqueUrls.add(item.productUrl);
      collectedData.push(item);
      renderItem(item);
      newCount++;
    }
  });

  countLabel.innerText = collectedData.length;
  if (newCount > 0) {
    updateStatus(`+${newCount} produk baru. Scroll lagi!`, "green");
    btnExport.disabled = false;
  } else {
    updateStatus("Tidak ada produk baru.", "#666");
  }
}

// --- Helpers ---
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
// 6. RENDER UI
// ==========================================
function renderItem(item) {
  const div = document.createElement('div');
  div.className = 'item-preview';
  
  div.innerHTML = `
    <img src="${item.imageUrl}" alt="img" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #eee;">
    <div style="flex: 1; overflow: hidden; padding-left: 10px; display: flex; flex-direction: column; justify-content: center;">
      <div style="font-weight:600; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #333;" title="${item.name}">
        ${item.name}
      </div>
      <div style="color: #00AA5B; font-weight: bold; font-size: 12px; margin-top: 2px;">
        ${item.price}
      </div>
      <div style="font-size: 10px; color: #fa591d; margin-top: 2px;">
        ${item.rating ? `⭐ ${item.rating}` : ''} ${item.sold ? ` | ${item.sold}` : ''}
      </div>
      <div class="action-row" style="margin-top: 4px; display: flex; align-items: center; justify-content: space-between;"></div>
      <div style="font-size: 9px; color: #888; margin-top: 2px;">
         📍 ${item.cleanLocation} (${item.shopUsername})
      </div>
    </div>
  `;

  const actionRow = div.querySelector('.action-row');

  // Badge
  let badgeColor = "#999"; let badgeText = "Regular";
  if (item.shopBadge === "Mall") { badgeColor = "#D6001C"; badgeText = "Mall"; }
  else if (item.shopBadge === "Power Shop") { badgeColor = "#00AA5B"; badgeText = "Power Pro"; }

  const badgeSpan = document.createElement('span');
  badgeSpan.style.cssText = `background:${badgeColor}; color:white; padding: 1px 4px; border-radius:3px; font-weight:bold; font-size:9px; margin-right:5px;`;
  badgeSpan.innerText = badgeText;
  
  const shopNameSpan = document.createElement('span');
  shopNameSpan.style.cssText = "font-size: 10px; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px;";
  shopNameSpan.innerText = item.cleanShopName;

  const leftSide = document.createElement('div');
  leftSide.style.display = "flex";
  leftSide.style.alignItems = "center";
  leftSide.appendChild(badgeSpan);
  leftSide.appendChild(shopNameSpan);
  actionRow.appendChild(leftSide);

  // Link Button
  const btnLink = document.createElement('button');
  btnLink.innerText = "🔗 Buka";
  btnLink.style.cssText = "border: 1px solid #ccc; background: #fff; border-radius: 3px; cursor: pointer; font-size: 9px; padding: 1px 5px; margin-left: 5px;";
  
  if (typeof LinkHelper !== 'undefined') LinkHelper.attach(btnLink, item.productUrl);
  else btnLink.onclick = () => window.open(item.productUrl, '_blank');

  actionRow.appendChild(btnLink);
  resultsContainer.appendChild(div); 
}

// ==========================================
// 7. EXPORT CSV
// ==========================================
btnExport.addEventListener('click', () => {
  if (collectedData.length === 0) return;
  const headers = ["Jenis Toko", "Username Toko", "Nama Toko", "Lokasi Toko", "Nama Produk", "Harga", "Rating", "Terjual", "Link Gambar", "Link Produk"];
  const csvRows = collectedData.map(item => {
    return [
      escapeCsv(item.shopBadge), escapeCsv(item.shopUsername), escapeCsv(item.cleanShopName), escapeCsv(item.cleanLocation),
      escapeCsv(item.name), escapeCsv(item.price), escapeCsv(item.rating), escapeCsv(item.sold),
      escapeCsv(item.imageUrl), escapeCsv(item.productUrl)
    ].join(",");
  });
  const csvContent = [headers.join(","), ...csvRows].join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  link.setAttribute("href", url);
  link.setAttribute("download", `tokopedia_scrape_${timestamp}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

function escapeCsv(text) {
  if (!text) return '""';
  const str = String(text);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
  return `"${str}"`;
}