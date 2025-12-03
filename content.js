// content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrape_visible") {
    if (!window.SCRAPER_CONFIG) {
      sendResponse({ status: "error", message: "Config missing" });
      return;
    }
    const data = scrapeWithHeuristics();
    sendResponse({ status: "success", data: data });
  }
  return true;
});

function scrapeWithHeuristics() {
  const CONFIG = window.SCRAPER_CONFIG;
  const products = [];
  const cards = document.querySelectorAll(CONFIG.cardContainer);

  cards.forEach((card) => {
    try {
      let itemData = {
        name: "", price: "", rating: "", sold: "", shopLocation: "", imageUrl: "", productUrl: ""
      };

      // 1. AMBIL LINK (FOKUS UTAMA)
      // Kita cari tag anchor <a> pertama di dalam kartu
      const anchor = card.querySelector('a');
      
      // Validasi: Jika tidak ada anchor atau href kosong, skip item ini
      if (!anchor || !anchor.href) return;
      
      // Membersihkan URL (Opsional: menghapus query param kotor jika mau, tapi kita ambil mentah dulu)
      itemData.productUrl = anchor.href;

      // 2. AMBIL GAMBAR
      const img = card.querySelector('img');
      itemData.imageUrl = img ? img.src : "";

      // 3. HEURISTIC TEXT (Harga, Nama, dll)
      const rawText = card.innerText; 
      const textLines = rawText.split('\n').map(t => t.trim()).filter(t => t.length > 0);
      const potentialTitles = [];
      const potentialShops = [];

      textLines.forEach(text => {
        if (CONFIG.patterns.price.test(text)) {
          itemData.price = text;
          return;
        }
        if (CONFIG.patterns.rating.test(text)) {
          itemData.rating = text;
          return;
        }
        if (CONFIG.patterns.sold.test(text)) {
          itemData.sold = text;
          return;
        }
        if (CONFIG.patterns.discount.test(text)) return;

        if (text.length > 20) {
          potentialTitles.push(text);
        } else {
          if (text.length > 3) potentialShops.push(text);
        }
      });

      itemData.name = potentialTitles.length > 0 ? potentialTitles[0] : (textLines[0] || "No Name");
      itemData.shopLocation = potentialShops.join(" - ");

      products.push(itemData);

    } catch (e) {
      console.error("Error heuristic:", e);
    }
  });

  return products;
}