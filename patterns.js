if (typeof window.SCRAPER_CONFIG === 'undefined') {
  window.SCRAPER_CONFIG = {
    // UPDATED: Selector Container Dinamis
    containers: {
      search: '.css-5wh65g', // Halaman Pencarian
      shop: '.css-79elbk'    // Halaman Produk Toko
    },

    // Pola Regex (Tetap sama)
    patterns: {
      price: /^Rp\s?[\d\.]+/i,
      rating: /^[1-5]\.\d$/,
      sold: /(\d+[rbjt\+]?)\s+(terjual|sold)/i,
      discount: /^\d{1,2}%$/
    },

    // Pola Badge (Tetap sama)
    badgePatterns: [
      { id: "Mall", regex: /badge_os\.png/i },
      { id: "Power Shop", regex: /Power%20Merchant%20Pro|Power_Merchant_Pro/i },
      { id: "Power Merchant", regex: /Power%20Merchant(?!%20Pro)|Power_Merchant(?!_Pro)/i }
    ]
  };
}
console.log("Pattern Config Loaded:", window.SCRAPER_CONFIG);