let collectedData = []; 
let uniqueUrls = new Set(); 

const btnScrape = document.getElementById('btnScrape');
const btnExport = document.getElementById('btnExport');
const statusMsg = document.getElementById('status-msg');
const countLabel = document.getElementById('count');
const resultsContainer = document.getElementById('results');

// --- HANDLER TOMBOL SCRAPE ---
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

// --- PEMROSESAN DATA ---
function processNewData(items) {
  let newCount = 0;
  items.forEach(item => {
    if (item.productUrl && !uniqueUrls.has(item.productUrl)) {
      uniqueUrls.add(item.productUrl);
      collectedData.push(item);
      renderItem(item);
      newCount++;
    }
  });
  countLabel.innerText = collectedData.length;
  
  if (newCount > 0) {
    updateStatus(`+${newCount} produk ditambahkan.`, "green");
    btnExport.disabled = false;
  } else {
    updateStatus("Tidak ada produk baru.", "#666");
  }
}

// --- RENDER UI ---
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
      
      <div style="display: flex; align-items: center; margin-top: 4px; gap: 5px;">
        <a href="${item.productUrl}" target="_blank" style="text-decoration: none; font-size: 10px; background: #eee; padding: 2px 5px; border-radius: 3px; color: #333;">🔗 Buka</a>
        <span style="font-size: 10px; color: #888;">${item.shopLocation.substring(0, 15)}...</span>
      </div>

    </div>
  `;
  resultsContainer.appendChild(div); 
}

// --- EXPORT CSV ---
btnExport.addEventListener('click', () => {
  if (collectedData.length === 0) return;
  
  const headers = ["Nama Produk", "Harga", "Rating", "Terjual", "Toko & Lokasi", "Link Gambar", "Link Produk"];
  
  const csvRows = collectedData.map(item => {
    return [
      escapeCsv(item.name),
      escapeCsv(item.price),
      escapeCsv(item.rating),
      escapeCsv(item.sold),
      escapeCsv(item.shopLocation),
      escapeCsv(item.imageUrl),
      escapeCsv(item.productUrl) // Pastikan URL masuk sini
    ].join(",");
  });

  const csvContent = [headers.join(","), ...csvRows].join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  link.setAttribute("href", url);
  link.setAttribute("download", `tokopedia_scrape_${timestamp}.csv`);
  link.click();
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