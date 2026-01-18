import fs from "node:fs";
import path from "node:path";

const siteRoot = process.cwd();
const imagesRoot = path.join(siteRoot, "public", "images");
const outRoot = path.join(siteRoot, "src", "data", "carousels");

fs.mkdirSync(outRoot, { recursive: true });

const isImage = (f) => /\.(png|jpe?g|webp|gif)$/i.test(f);

const folders = fs.existsSync(imagesRoot)
  ? fs.readdirSync(imagesRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [];

for (const folder of folders) {
  const folderPath = path.join(imagesRoot, folder);
  const files = fs
    .readdirSync(folderPath)
    .filter((f) => isImage(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const payload = {
    folder,
    files,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(outRoot, `${folder}.json`), JSON.stringify(payload, null, 2));
}

console.log(`Generated ${folders.length} carousel file(s) in src/data/carousels/`);
