import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "..", "dist");
const indexPath = path.join(distDir, "index.html");

const mimeTypes = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

function getContentType(filePath) {
  return mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function startServer(port) {
  const server = http.createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      const safePath = urlPath === "/" ? "/index.html" : urlPath;
      const filePath = path.join(distDir, safePath);
      const exists = await fileExists(filePath);
      if (!exists) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const data = await fs.readFile(filePath);
      res.writeHead(200, { "Content-Type": getContentType(filePath) });
      res.end(data);
    } catch (err) {
      res.writeHead(500);
      res.end("Server error");
    }
  });

  await new Promise((resolve) => server.listen(port, resolve));
  return server;
}

async function prerender() {
  if ((process.env.NETLIFY && process.env.PRERENDER_FORCE !== "1") || process.env.PRERENDER_SKIP === "1") {
    console.log("[prerender] skipped (NETLIFY or PRERENDER_SKIP)");
    return;
  }
  const server = await startServer(4173);
  let browser;
  try {
    const chromePaths = [
      "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe",
      "C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe",
      "C:\\\\Program Files\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe",
      "C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe",
    ];
    let resolvedPath = null;
    for (const candidate of chromePaths) {
      try {
        await fs.access(candidate);
        resolvedPath = candidate;
        break;
      } catch {
        // try next
      }
    }

    browser = await puppeteer.launch({
      headless: true,
      executablePath: resolvedPath || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto("http://localhost:4173/", { waitUntil: "networkidle0" });
    await page.waitForSelector('main[data-prerender-ready="true"]', { timeout: 10000 });
    await page.evaluate(() => {
      document.querySelectorAll("[style]").forEach((el) => {
        const style = el.style;
        if (style && style.opacity === "0") {
          style.opacity = "1";
          style.transform = "none";
        }
      });
    });
    const html = await page.content();
    await fs.writeFile(indexPath, html, "utf8");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

prerender().catch((err) => {
  console.error("[prerender] failed", err);
  process.exit(1);
});
