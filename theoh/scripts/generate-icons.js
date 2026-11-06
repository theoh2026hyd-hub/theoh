/**
 * Generates circular favicon PNGs with transparent corners from the brand logo.
 * Run: node scripts/generate-icons.js
 */
const sharp = require("sharp");
const { join } = require("path");
const { mkdirSync, existsSync } = require("fs");

const ROOT = join(__dirname, "..");
const SOURCE_CANDIDATES = [
  join(ROOT, "public", "theoh-admin-logo.png"),
  join(ROOT, "public", "theoh!.jpg"),
  join(ROOT, "public", "favicon.png"),
];

function resolveSourceImage() {
  for (const candidate of SOURCE_CANDIDATES) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `No icon source image found. Expected one of: ${SOURCE_CANDIDATES.join(", ")}`
  );
}

const SOURCE = resolveSourceImage();

function circleMask(size) {
  return Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/>
    </svg>`
  );
}

async function makeRoundIcon(size, outputPath) {
  const resized = await sharp(SOURCE)
    .resize(size, size, {
      fit: "cover",
      position: "centre",
    })
    .png()
    .toBuffer();

  await sharp(resized)
    .composite([{ input: circleMask(size), blend: "dest-in" }])
    .png()
    .toFile(outputPath);

  console.log(`Created ${outputPath} (${size}x${size})`);
}

async function main() {
  console.log(`Using icon source: ${SOURCE}`);
  mkdirSync(join(ROOT, "app"), { recursive: true });
  await makeRoundIcon(32, join(ROOT, "app", "icon.png"));
  await makeRoundIcon(180, join(ROOT, "app", "apple-icon.png"));
  await makeRoundIcon(192, join(ROOT, "public", "favicon.png"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
