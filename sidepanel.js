// ==========================================
// 1. SETUP & STATE MANAGEMENT
// ==========================================
let collectedData = []; 
let uniqueUrls = new Set(); 
let isAutoRunning = false;

// Elemen DOM
const btnScrape = document.getElementById('btnScrape');
const btnExport = document.getElementById('btnExport');
const statusMsg = document.getElementById('status-msg');
const countLabel = document.getElementById('count');
const resultsContainer = document.getElementById('results');
const pageTypeIndicator = document.getElementById('page-type-indicator');

// Elemen DOM Otomasi
const btnAutoStart = document.getElementById('btnAutoStart');
const btnAutoStop = document.getElementById('btnAutoStop');
const inputDelayMin = document.getElementById('delayMin');
const inputDelayMax = document.getElementById('delayMax');
const autoStatusLabel = document.getElementById('auto-status');

if(btnExport) btnExport.innerText = "Export JSON";

// ==========================================
// 2. LISTENERS GLOBAL
// ==========================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "pdp_scraped") {
    handlePDPData(message.url, message.data, sender.tab ? sender.tab.id : null);
  }
});

(async function initPageCheck() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) updatePageIndicator(tab.url);
  } catch (e) { console.log(e); }
})();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id === tabId) updatePageIndicator(tabs[0].url);
    });
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab && tab.url) updatePageIndicator(tab.url);
});

// ==========================================
// 3. LOGIKA OTOMASI
// ==========================================
btnAutoStart.addEventListener('click', async () => {
  // Hanya ambil tombol yang ada di DOM (artinya item yang belum dihapus user)
  const buttons = Array.from(document.querySelectorAll('.btn-open-scrape:not(.processed)'));

  if (buttons.length === 0) {
    autoStatusLabel.innerText = "Tidak ada item (atau semua sudah selesai).";
    return;
  }

  isAutoRunning = true;
  updateAutoUI(true);
  autoStatusLabel.innerText = `Menyiapkan ${buttons.length} item...`;

  const shuffledButtons = shuffleArray(buttons);
  let processedCount = 0;
  
  for (const btn of shuffledButtons) {
    if (!isAutoRunning) break; 

    // Cek apakah item masih ada di DOM (jaga-jaga jika user menghapus saat bot jalan)
    if (document.body.contains(btn)) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      btn.click();
      
      processedCount++;
      autoStatusLabel.innerText = `Memproses ${processedCount} dari ${buttons.length}...`;

      const min = parseFloat(inputDelayMin.value) * 1000;
      const max = parseFloat(inputDelayMax.value) * 1000;
      const randomDelay = Math.floor(Math.random() * (max - min + 1) + min);

      await sleep(randomDelay);
    }
  }

  isAutoRunning = false;
  updateAutoUI(false);
  autoStatusLabel.innerText = isAutoRunning ? "Berhenti." : "Selesai antrean.";
});

btnAutoStop.addEventListener('click', () => {
  isAutoRunning = false;
  updateAutoUI(false);
  autoStatusLabel.innerText = "Berhenti paksa...";
});

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
function updateAutoUI(running) {
  btnAutoStart.disabled = running;
  btnAutoStop.disabled = !running;
  btnScrape.disabled = running;
  btnExport.disabled = running;
}

// ==========================================
// 4. HANDLER SCRAPING (LISTING)
// ==========================================
btnScrape.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('tokopedia.com')) {
    updateStatus("Error: Bukan Tokopedia", "red");
    return;
  }

  updatePageIndicator(tab.url);
  updateStatus("Sedang memindai...", "orange");

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['patterns.js', 'content.js'] 
  }, () => {
    if (chrome.runtime.lastError) return updateStatus("Gagal inject.", "red");
    
    chrome.tabs.sendMessage(tab.id, { action: "scrape_visible" }, (response) => {
      if (chrome.runtime.lastError) return updateStatus("Koneksi putus.", "red");
      if (response && response.status === "success") {
        processNewData(response.data);
      } else {
        updateStatus("Gagal baca data.", "red");
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
    updateStatus(`+${newCount} produk.`, "green");
    btnExport.disabled = false;
  }
}

// Helpers
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
function detectPageType(urlString) {
  try {
    const url = new URL(urlString);
    const path = url.pathname;
    if (path.startsWith('/search')) return { code: 'search', label: "🔍 Pencarian" };
    if (/\/[\w\-\.]+\/(product|etalase)/i.test(path)) return { code: 'shop_list', label: "🏪 Toko" };
    return { code: 'other', label: "📄 Tokopedia" };
  } catch (e) { return { code: 'unknown', label: "?" }; }
}
function updatePageIndicator(url) {
  if(!pageTypeIndicator) return;
  const type = detectPageType(url);
  pageTypeIndicator.innerText = type.label;
  if(type.code === 'search') pageTypeIndicator.style.backgroundColor = "#fff3e0";
  else if(type.code === 'shop_list') pageTypeIndicator.style.backgroundColor = "#e8f5e9";
  else pageTypeIndicator.style.backgroundColor = "#f5f5f5";
}
function updateStatus(text, color) {
  statusMsg.innerText = text;
  statusMsg.style.color = color;
}

// ==========================================
// 6. RENDER UI & DELETE LOGIC (UPDATED)
// ==========================================
function renderItem(item) {
  const div = document.createElement('div');
  div.className = 'item-preview';
  
  const uniqueId = btoa(item.productUrl).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  div.setAttribute('data-url', item.productUrl); 

  let badgeColor = "#999"; let badgeText = "Regular";
  if (item.shopBadge === "Mall") { badgeColor = "#D6001C"; badgeText = "Mall"; }
  else if (item.shopBadge === "Power Shop") { badgeColor = "#00AA5B"; badgeText = "Power Pro"; }

  div.innerHTML = `
    <img src="${item.imageUrl}" alt="img" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #eee;">
    <div style="flex: 1; overflow: hidden; padding-left: 10px; display: flex; flex-direction: column; justify-content: center;">
      <div style="font-weight:600; font-size: 11px; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.name}">${item.name}</div>
      <div style="color: #00AA5B; font-weight: bold; font-size: 12px; margin-top: 2px;">${item.price}</div>
      <div style="font-size: 10px; color: #fa591d; margin-top: 2px;">${item.rating} ⭐ | ${item.sold}</div>
      
      <div class="action-row" style="margin-top: 4px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display:flex; align-items:center;">
           <span style="background:${badgeColor}; color:white; padding: 1px 4px; border-radius:3px; font-weight:bold; font-size:9px; margin-right:5px;">${badgeText}</span>
           <span style="font-size: 10px; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60px;">${item.cleanShopName}</span>
        </div>
        
        <div style="display:flex; gap:3px;">
          <button class="btn-delete" title="Hapus Item" style="border:1px solid #ffcdd2; background:#ffebee; color:#c62828; border-radius:3px; cursor:pointer; font-size:9px; padding:2px 5px;">
            🗑️
          </button>
          
          <button class="btn-open-scrape" style="border:1px solid #00AA5B; background:white; color:#00AA5B; border-radius:3px; cursor:pointer; font-size:9px; padding:2px 6px;">
             🔗 Buka
          </button>
        </div>
      </div>
      
      <div style="font-size: 9px; color: #888; margin-top: 2px;">
         📍 ${item.cleanLocation} (${item.shopUsername})
      </div>
    </div>

    <div id="detail-${uniqueId}" class="detail-box">
      <div class="status-loading">⏳ Memuat...</div>
      <div class="content-detail" style="display:none;">
         <div class="detail-images"></div>
         <p style="margin:2px 0;"><b>Stok:</b> <span class="val-stock">-</span></p>
         <p style="margin:2px 0;"><b>Deskripsi:</b> <span class="val-desc">-</span></p>
      </div>
    </div>
  `;

  // --- LOGIKA TOMBOL HAPUS ---
  const btnDelete = div.querySelector('.btn-delete');
  btnDelete.onclick = () => {
    // 1. Hapus dari DOM (Tampilan)
    div.remove();

    // 2. Hapus dari Memory (Data Array)
    collectedData = collectedData.filter(d => d.productUrl !== item.productUrl);

    // 3. Hapus dari Unique Set (Agar bisa discrape ulang jika mau)
    uniqueUrls.delete(item.productUrl);

    // 4. Update Counter UI
    countLabel.innerText = collectedData.length;
    
    // 5. Update status
    if (collectedData.length === 0) {
      btnExport.disabled = true;
      updateStatus("List kosong.", "#666");
    }
  };

  // --- LOGIKA TOMBOL BUKA & SCRAPE (Sama) ---
  const btnOpen = div.querySelector('.btn-open-scrape');
  const detailBox = div.querySelector(`#detail-${uniqueId}`);

  btnOpen.onclick = () => {
    btnOpen.classList.add('processed');
    btnOpen.innerText = "⏳...";
    btnOpen.disabled = true;
    detailBox.classList.add('visible');
    
    const isActive = !isAutoRunning; 

    chrome.tabs.create({ url: item.productUrl, active: isActive }, (newTab) => {
      const listener = (tabId, changeInfo, tab) => {
        if (tabId === newTab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
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

// --- Handler Data Detail + AUTO CLOSE ---
function handlePDPData(url, data, senderTabId) {
  const cleanUrl = url.split('?')[0];
  // Gunakan pencarian DOM yang aman
  // Karena user mungkin sudah menghapus item saat tab loading
  const itemDiv = document.querySelector(`div[data-url^="${cleanUrl}"]`);
  
  if (senderTabId) chrome.tabs.remove(senderTabId);

  if (!itemDiv) return; // Jika item sudah dihapus user, abaikan data yang masuk

  const uniqueId = btoa(itemDiv.getAttribute('data-url')).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const detailBox = document.getElementById(`detail-${uniqueId}`);
  const btnOpen = itemDiv.querySelector('.btn-open-scrape');

  if (btnOpen) {
    btnOpen.innerText = "✔";
    btnOpen.style.borderColor = "#ccc";
    btnOpen.style.color = "#ccc";
  }

  if (!detailBox) return;

  const loading = detailBox.querySelector('.status-loading');
  const content = detailBox.querySelector('.content-detail');
  const imgContainer = detailBox.querySelector('.detail-images');
  
  loading.style.display = 'none';
  content.style.display = 'block';
  
  detailBox.querySelector('.val-desc').innerText = data.description || "-";
  detailBox.querySelector('.val-stock').innerText = data.stock || "-";

  imgContainer.innerHTML = '';
  if (data.images && data.images.length > 0) {
    data.images.slice(0, 5).forEach(src => {
      const img = document.createElement('img');
      img.src = src;
      imgContainer.appendChild(img);
    });
  }

  if (data.shopLocation) {
    const locInfo = document.createElement('div');
    locInfo.style.cssText = "font-size: 9px; color: #555; margin-top: 5px; border-top: 1px dashed #ccc; padding-top: 4px;";
    locInfo.innerHTML = `<b>Pengiriman:</b> ${data.shopLocation}`;
    content.appendChild(locInfo);
  }

  const dataIndex = collectedData.findIndex(d => d.productUrl === itemDiv.getAttribute('data-url'));
  if (dataIndex !== -1) {
    collectedData[dataIndex].details = data;
  }
}

// ==========================================
// 7. EXPORT NESTED JSON
// ==========================================
btnExport.addEventListener('click', () => {
  if (collectedData.length === 0) return updateStatus("Kosong", "red");
  
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

    const productEntry = {
      name: item.name,
      price: typeof DataFormatter !== 'undefined' ? DataFormatter.price(item.price) : item.price,
      rating: typeof DataFormatter !== 'undefined' ? DataFormatter.rating(item.rating) : item.rating,
      sold: typeof DataFormatter !== 'undefined' ? DataFormatter.sold(item.sold) : item.sold,
      imageUrl: item.imageUrl,
      link: item.productUrl,
      detail: null
    };

    if (item.details) {
      productEntry.detail = {
        fullName: item.details.fullName,
        description: item.details.description,
        stock: item.details.stock,
        images: item.details.images,
        shopLocationFromDetail: item.details.shopLocation
      };
    }

    shopsMap.get(shopKey).products.push(productEntry);
  });

  const finalJsonData = Array.from(shopsMap.values());
  const jsonString = JSON.stringify(finalJsonData, null, 2); 
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  link.setAttribute("href", url);
  link.setAttribute("download", `tokopedia_data_${timestamp}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

// ==========================================
// 8. REALTIME SEARCH & FILTER
// ==========================================
const searchInput = document.getElementById('searchInput');
const toggleNot = document.getElementById('toggleNot');
const filteredCountLabel = document.getElementById('filtered-count');

// Event Listener untuk Input Ketik & Toggle Klik
searchInput.addEventListener('input', runFilter);
toggleNot.addEventListener('change', runFilter);

function runFilter() {
  const query = searchInput.value.toLowerCase().trim();
  const isNotMode = toggleNot.checked;
  
  // Ambil semua elemen item di DOM saat ini
  const itemElements = document.querySelectorAll('.item-preview');
  let visibleCount = 0;

  itemElements.forEach(el => {
    // Kita cari teks di dalam elemen tersebut (Nama, Toko, Harga, dll)
    const textContent = el.innerText.toLowerCase();
    
    // Logika Pencarian
    const isMatch = textContent.includes(query);
    
    let shouldShow = true;

    if (query === "") {
      shouldShow = true; // Jika kosong, tampilkan semua
    } else {
      if (isNotMode) {
        // Mode NOT: Tampilkan jika TIDAK COCOK
        shouldShow = !isMatch;
      } else {
        // Mode Normal: Tampilkan jika COCOK
        shouldShow = isMatch;
      }
    }

    // Terapkan visibility
    el.style.display = shouldShow ? 'flex' : 'none';
    
    if (shouldShow) visibleCount++;
  });

  // Update UI Counter Kecil
  if (query !== "") {
    filteredCountLabel.style.display = 'inline';
    filteredCountLabel.innerText = `(Filtered: ${visibleCount})`;
  } else {
    filteredCountLabel.style.display = 'none';
  }
}

// Update fungsi renderItem sedikit agar filter tetap jalan saat item baru masuk
// (Opsional, tapi bagus untuk UX)
const originalRenderItem = renderItem; 
renderItem = function(item) {
  // Panggil render asli
  originalRenderItem(item);
  
  // Jika sedang ada search query aktif, langsung jalankan filter ulang
  // agar item baru yang tidak sesuai query langsung tersembunyi
  if (searchInput.value.trim() !== "") {
    runFilter();
  }
}