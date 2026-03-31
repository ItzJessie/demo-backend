const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const dataPath = path.join(projectRoot, "data", "animeSeries.json");
const imagesDir = path.join(projectRoot, "public", "images");

function normalizeText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function toKeywords(value) {
    const stopWords = new Set([
        "the",
        "a",
        "an",
        "of",
        "and",
        "to",
        "in",
        "on",
        "for",
        "with",
        "x",
    ]);

    return normalizeText(value)
        .split(" ")
        .filter((token) => token.length > 2 && !stopWords.has(token));
}

function readJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
        console.error(`Failed to read JSON from ${filePath}`);
        console.error(error.message);
        process.exit(1);
    }
}

function verify() {
    const anime = readJson(dataPath);

    if (!Array.isArray(anime)) {
        console.error("Expected animeSeries.json to contain an array.");
        process.exit(1);
    }

    const imageFiles = fs.readdirSync(imagesDir);
    const imageSet = new Set(imageFiles);

    const missingImageRefs = [];
    const duplicateMap = new Map();
    const suspiciousMappings = [];

    anime.forEach((record) => {
        const id = record._id;
        const title = String(record.title || "");
        const rawImg = String(record.img_name || "").trim();
        const fileName = rawImg.replace(/^images\//, "");

        if (!rawImg) {
            missingImageRefs.push({ id, title, reason: "img_name is empty" });
            return;
        }

        if (!imageSet.has(fileName)) {
            missingImageRefs.push({ id, title, reason: `${fileName} not found in public/images` });
        }

        if (!duplicateMap.has(fileName)) {
            duplicateMap.set(fileName, []);
        }
        duplicateMap.get(fileName).push({ id, title });

        const titleKeywords = toKeywords(title);
        const fileKeywords = toKeywords(path.parse(fileName).name);
        const hasKeywordOverlap = titleKeywords.some((keyword) => fileKeywords.includes(keyword));

        if (!hasKeywordOverlap) {
            suspiciousMappings.push({ id, title, img_name: rawImg });
        }
    });

    const duplicateImageRefs = [];
    for (const [fileName, records] of duplicateMap.entries()) {
        if (records.length > 1) {
            duplicateImageRefs.push({ fileName, records });
        }
    }

    const normalizedRefs = new Set(
        anime.map((record) => String(record.img_name || "").trim().replace(/^images\//, "")).filter(Boolean)
    );
    const unreferencedImages = imageFiles.filter((file) => !normalizedRefs.has(file));

    const summary = {
        totalAnimeRecords: anime.length,
        totalImageFiles: imageFiles.length,
        uniqueReferencedImages: normalizedRefs.size,
        missingImageRefs: missingImageRefs.length,
        duplicateImageRefs: duplicateImageRefs.length,
        unreferencedImages: unreferencedImages.length,
        suspiciousTitleToFileMappings: suspiciousMappings.length,
    };

    console.log("\nAnime image verification summary");
    console.log("--------------------------------");
    console.log(JSON.stringify(summary, null, 2));

    if (missingImageRefs.length) {
        console.log("\nMissing image references");
        console.log("------------------------");
        missingImageRefs.forEach((item) => {
            console.log(`#${item.id} ${item.title}: ${item.reason}`);
        });
    }

    if (duplicateImageRefs.length) {
        console.log("\nDuplicate image references");
        console.log("--------------------------");
        duplicateImageRefs.forEach((group) => {
            const labels = group.records.map((record) => `#${record.id} ${record.title}`).join(", ");
            console.log(`${group.fileName} -> ${labels}`);
        });
    }

    if (suspiciousMappings.length) {
        console.log("\nSuspicious title-to-image mappings");
        console.log("---------------------------------");
        suspiciousMappings.forEach((item) => {
            console.log(`#${item.id} ${item.title} -> ${item.img_name}`);
        });
        console.log("\nNote: This check is heuristic. Verify each flagged item manually.");
    }

    if (unreferencedImages.length) {
        console.log("\nUnreferenced images (sample)");
        console.log("----------------------------");
        unreferencedImages.slice(0, 25).forEach((item) => console.log(item));
        if (unreferencedImages.length > 25) {
            console.log(`...and ${unreferencedImages.length - 25} more`);
        }
    }

    const hasHardFailures = missingImageRefs.length > 0;
    process.exit(hasHardFailures ? 1 : 0);
}

verify();