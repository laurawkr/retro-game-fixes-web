import fs from "node:fs";
import path from "node:path";

const EBAY_APP_ID = process.env.EBAY_APP_ID;
const EBAY_SELLER = process.env.EBAY_SELLER;

if (!EBAY_APP_ID || !EBAY_SELLER) {
  console.error("Missing EBAY_APP_ID or EBAY_SELLER env vars.");
  process.exit(1);
}

const OUT_PATH = path.join(process.cwd(), "src", "data", "ebay.json");

// Build a Finding API URL (findItemsAdvanced + Seller filter)
const url = new URL("https://svcs.ebay.com/services/search/FindingService/v1");
url.searchParams.set("OPERATION-NAME", "findItemsAdvanced");
url.searchParams.set("SERVICE-VERSION", "1.13.0");
url.searchParams.set("SECURITY-APPNAME", EBAY_APP_ID);
url.searchParams.set("RESPONSE-DATA-FORMAT", "JSON");
url.searchParams.set("REST-PAYLOAD", "");

// Seller filter
url.searchParams.set("itemFilter(0).name", "Seller");
url.searchParams.set("itemFilter(0).value(0)", EBAY_SELLER);

// Only active listings (default is active, but keep it explicit-ish via outputSelector)
url.searchParams.set("outputSelector(0)", "SellerInfo");
url.searchParams.set("outputSelector(1)", "PictureURLLarge");
url.searchParams.set("outputSelector(2)", "PictureURLSuperSize");

// Pagination
url.searchParams.set("paginationInput.entriesPerPage", "50");
url.searchParams.set("paginationInput.pageNumber", "1");

async function fetchPage(pageNumber) {
  const pageUrl = new URL(url.toString());
  pageUrl.searchParams.set("paginationInput.pageNumber", String(pageNumber));

  const res = await fetch(pageUrl.toString());
  if (!res.ok) throw new Error(`eBay fetch failed: ${res.status} ${res.statusText}`);
  return res.json();
}

function normalize(apiJson) {
  const root = apiJson?.findItemsAdvancedResponse?.[0];
  const items = root?.searchResult?.[0]?.item ?? [];

  return items.map((it) => {
    const title = it?.title?.[0] ?? "";
    const viewItemURL = it?.viewItemURL?.[0] ?? "";
    const priceObj = it?.sellingStatus?.[0]?.currentPrice?.[0];
    const price = priceObj ? `${priceObj["@currencyId"] ?? ""} ${priceObj["__value__"] ?? ""}`.trim() : "";

    const img =
      it?.pictureURLLarge?.[0] ??
      it?.pictureURLSuperSize?.[0] ??
      it?.galleryURL?.[0] ??
      "";

    return {
      title,
      href: viewItemURL,
      price,
      img,
    };
  });
}

async function main() {
  // Page 1 to learn total pages
  const first = await fetchPage(1);
  const root = first?.findItemsAdvancedResponse?.[0];
  const totalPages = Number(root?.paginationOutput?.[0]?.totalPages?.[0] ?? 1);

  const all = [...normalize(first)];

  for (let p = 2; p <= totalPages; p++) {
    const data = await fetchPage(p);
    all.push(...normalize(data));
  }

  // Ensure directory exists
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });

  // Write JSON
  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        seller: EBAY_SELLER,
        fetchedAt: new Date().toISOString(),
        count: all.length,
        items: all,
      },
      null,
      2
    )
  );

  console.log(`Wrote ${all.length} listings -> ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
