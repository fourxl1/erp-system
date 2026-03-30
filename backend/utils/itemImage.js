const fs = require("fs");
const path = require("path");

const ITEM_UPLOAD_ROUTE = "/uploads";
const ITEM_UPLOAD_DIRECTORY = path.resolve(__dirname, "..", "uploads", "items");
const SAFE_FILENAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function normalizeUrlPath(value) {
  if (!/^https?:\/\//i.test(value)) {
    return value;
  }

  try {
    return new URL(value).pathname;
  } catch {
    return value;
  }
}

function extractImageFilename(value, options = {}) {
  if (isBlank(value)) {
    return null;
  }

  const allowFilesystemPath = options.allowFilesystemPath === true;
  const rawValue = normalizeUrlPath(String(value).trim()).replace(/\\/g, "/");
  const cleanedValue = rawValue.split("?")[0].split("#")[0];
  const hasUploadPrefix =
    cleanedValue.toLowerCase().includes("/uploads/") ||
    cleanedValue.toLowerCase().includes("/uploads/items/");
  const hasPathSeparator = cleanedValue.includes("/");

  if (!allowFilesystemPath && hasPathSeparator && !hasUploadPrefix) {
    return null;
  }

  const filename = path.posix.basename(cleanedValue);

  if (!SAFE_FILENAME_PATTERN.test(filename)) {
    return null;
  }

  return filename;
}

function normalizeStoredItemImage(value) {
  return extractImageFilename(value, { allowFilesystemPath: true });
}

function parseItemImageInput(value) {
  return extractImageFilename(value, { allowFilesystemPath: false });
}

function buildItemImagePath(value) {
  const filename = normalizeStoredItemImage(value);
  return filename ? `${ITEM_UPLOAD_ROUTE}/${filename}` : null;
}

function buildItemImageUrl(req, value) {
  const imagePath = buildItemImagePath(value);

  if (!req || !imagePath) {
    return null;
  }

  const forwardedProtocol = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
  const protocol = forwardedProtocol || req.protocol;
  const host = forwardedHost || req.get("host");

  return `${protocol}://${host}${imagePath}`;
}

function resolveItemImageFilePath(value) {
  const filename = normalizeStoredItemImage(value);

  if (!filename) {
    return null;
  }

  const localPath = path.resolve(ITEM_UPLOAD_DIRECTORY, filename);
  const directoryPrefix = `${ITEM_UPLOAD_DIRECTORY}${path.sep}`;

  if (localPath !== path.join(ITEM_UPLOAD_DIRECTORY, filename) && !localPath.startsWith(directoryPrefix)) {
    return null;
  }

  return fs.existsSync(localPath) ? localPath : null;
}

module.exports = {
  ITEM_UPLOAD_ROUTE,
  ITEM_UPLOAD_DIRECTORY,
  normalizeStoredItemImage,
  parseItemImageInput,
  buildItemImagePath,
  buildItemImageUrl,
  resolveItemImageFilePath
};
