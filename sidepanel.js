// Variabel Global
let collectedData = []; 
let uniqueUrls = new Set(); 

// Referensi Elemen UI
const btnScrape = document.getElementById('btnScrape');
const btnExport = document.getElementById('btnExport');
const statusMsg = document.getElementById('status-msg');
const countLabel = document.getElementById('count');
const resultsContainer = document.getElementById('results');

// ==========================================
// 1. HANDLER TOMBOL SCRAPE
// ==========================================
btnScrape.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('tokopedia.com')) {
    updateStatus("Error: Buka halaman Tokopedia dulu!", "red");
    return;
  }

  updateStatus("Sedang memindai...", "orange");

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['patterns.js', 'content.js'] 
  }, () => {
    if (chrome.runtime.lastError) {
      console.error("Injection Error:", chrome.runtime.lastError);
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
// 2. LOGIKA UTAMA (Processing + Extraction)
// ==========================================
function processNewData(items) {
  let newCount = 0;

  items.forEach(item => {
    if (item.productUrl && !uniqueUrls.has(item.productUrl)) {
      
      // --- LOGIKA EKSTRAKSI USERNAME ---
      item.shopUsername = extractUsername(item.productUrl);
      // ---------------------------------

      uniqueUrls.add(item.productUrl);
      collectedData.push(item);
      renderItem(item);
      newCount++;
    }
  });

  countLabel.innerText = collectedData.length;
  
  if (newCount > 0) {
    updateStatus(`+${newCount} produk. Scroll lagi!`, "green");
    btnExport.disabled = false;
  } else {
    updateStatus("Tidak ada produk baru. Scroll lagi.", "#666");
  }
}

// Fungsi Helper untuk mengambil username dari URL
function extractUsername(urlString) {
  try {
    const url = new URL(urlString);
    // Pathname contoh: /ghmusicgraharaya/nama-produk...
    const segments = url.pathname.split('/');
    
    // Segmen index 0 adalah string kosong (karena diawali /)
    // Segmen index 1 adalah username toko
    if (segments.length > 1 && segments[1]) {
      return segments[1];
    }
    return "-";
  } catch (e) {
    console.error("Gagal ekstrak username:", e);
    return "error";
  }
}

// ==========================================
// 3. RENDER UI
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
      
      <div style="font-size: 10px; color: #555; margin-top: 2px;">
        👤 <span style="background:#eee; padding: 1px 4px; border-radius:3px;">${item.shopUsername}</span>
      </div>

      <div style="font-size: 10px; color: #888; margin-top: 2px;">
        ${item.shopLocation || '-'}
      </div>
    </div>
  `;
  
  resultsContainer.appendChild(div); 
}

// ==========================================
// 4. EXPORT CSV (Updated Header)
// ==========================================
btnExport.addEventListener('click', () => {
  if (collectedData.length === 0) return;
  
  const headers = [
    "Username Toko", // Kolom Baru
    "Nama Produk", 
    "Harga", 
    "Rating", 
    "Terjual", 
    "Lokasi Manual", 
    "Link Gambar", 
    "Link Produk"
  ];
  
  const csvRows = collectedData.map(item => {
    return [
      escapeCsv(item.shopUsername), // Data Baru
      escapeCsv(item.name),
      escapeCsv(item.price),
      escapeCsv(item.rating),
      escapeCsv(item.sold),
      escapeCsv(item.shopLocation),
      escapeCsv(item.imageUrl),
      escapeCsv(item.productUrl)
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
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

function updateStatus(text, color) {
  statusMsg.innerText = text;
  statusMsg.style.color = color;
}