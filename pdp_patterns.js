window.PDP_CONFIG = {
  selectors: {
    // 1. Nama Produk
    // Source: <h1 ... data-testid="lblPDPDetailProductName">MIC MAONO...</h1>
    productName: '[data-testid="lblPDPDetailProductName"]',

    // 2. Deskripsi
    // Source: <div data-testid="lblPDPDescriptionProduk">Mic MAONO...</div>
    description: '[data-testid="lblPDPDescriptionProduk"]',

    // 3. Harga
    // Source: <div ... data-testid="lblPDPDetailProductPrice">Rp350.000</div>
    price: '[data-testid="lblPDPDetailProductPrice"]',

    // 4. Gambar (Thumbnail)
    // Source: <button ... data-testid="PDPImageThumbnail"><img ...></button>
    images: '[data-testid="PDPImageThumbnail"] img',

    // 5. Stok
    // Source: <p ... data-testid="stock-label">Stok: <b>67</b> </p>
    stock: '[data-testid="stock-label"]',

    // 6. Rating (Angka)
    // Source: <span ... data-testid="lblPDPDetailProductRatingNumber">5</span>
    rating: '[data-testid="lblPDPDetailProductRatingNumber"]',

    // 7. Terjual
    // Source: <p ... data-testid="lblPDPDetailProductSoldCounter">Terjual 9</p>
    sold: '[data-testid="lblPDPDetailProductSoldCounter"]',

    // 8. Nama Toko (Footer PDP)
    // Source: <div data-testid="llbPDPFooterShopName">...</div>
    shopName: '[data-testid="llbPDPFooterShopName"]',

    // 9. Lokasi (Pengiriman)
    // Area ini agak tricky karena teks biasa, kita ambil container-nya
    // Source: <div id="pdp_comp-shipment_v4">...Dikirim dari <b>Kota...</b></div>
    shipmentContainer: '#pdp_comp-shipment_v4'
  }
};