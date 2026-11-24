import path from "node:path";

export function dataDir() {
  const configured = process.env.DATA_DIR || "data";
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

export function uploadDir() {
  return path.join(dataDir(), "uploads");
}
