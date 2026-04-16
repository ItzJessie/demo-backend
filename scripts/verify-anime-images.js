/**
 * Verify anime image references and their availability
 * Checks that all anime records have valid image paths
 */

const fs = require("fs/promises");
const path = require("path");

const ANIME_FILE = path.join(__dirname, "..", "data", "animeSeries.json");
const PUBLIC_IMAGES_DIR = path.join(__dirname, "..", "public", "images");

async function verifyAnimeImages() {
  console.log("🔍 Verifying anime image references...\n");

  try {
    const raw = await fs.readFile(ANIME_FILE, "utf8");
    const animeList = JSON.parse(raw);

    if (!Array.isArray(animeList)) {
      console.error("❌ Anime data is not an array");
      process.exit(1);
    }

    let validCount = 0;
    let missingCount = 0;
    let urlCount = 0;
    const issues = [];

    for (const anime of animeList) {
      const id = anime._id || "unknown";
      const title = anime.title || "Untitled";
      const imgName = anime.img_name || "";

      // Check if image path is a URL
      if (/^https?:\/\//i.test(imgName)) {
        urlCount++;
        console.log(`✓ ${id}: "${title}" -> External URL`);
        validCount++;
        continue;
      }

      // Check if image path is relative
      if (!imgName) {
        issues.push(`⚠️  ${id}: "${title}" -> No image specified (uses fallback)`);
        missingCount++;
        continue;
      }

      // Construct full path for file-based images
      if (imgName.startsWith("images/")) {
        const fullPath = path.join(PUBLIC_IMAGES_DIR, imgName.replace(/^images\//, ""));
        try {
          await fs.access(fullPath);
          console.log(`✓ ${id}: "${title}" -> ${imgName}`);
          validCount++;
        } catch (_err) {
          issues.push(`❌ ${id}: "${title}" -> File not found: ${fullPath}`);
          missingCount++;
        }
      } else {
        issues.push(`⚠️  ${id}: "${title}" -> Invalid image format: ${imgName}`);
        missingCount++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log(`Total anime records: ${animeList.length}`);
    console.log(`Valid local images: ${validCount - urlCount}`);
    console.log(`External URLs: ${urlCount}`);
    console.log(`Missing/Invalid: ${missingCount}`);
    console.log("=".repeat(60));

    if (issues.length > 0) {
      console.log("\n📋 Issues found:");
      issues.forEach((issue) => console.log(issue));
      console.log();
    } else {
      console.log("\n✅ All anime image references are valid!\n");
    }

    process.exit(issues.length > 0 ? 1 : 0);
  } catch (err) {
    console.error("❌ Error verifying images:", err.message);
    process.exit(1);
  }
}

verifyAnimeImages();
