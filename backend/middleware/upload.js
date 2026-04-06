import multer from "multer";
import path from "path";
import fs from "fs";

// 📂 Dossier de destination
const uploadDir = "uploads/requests";

// ⚠️ On crée le dossier s’il n’existe pas
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ⚙️ Config storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // 📂 sauvegarde dans /uploads/requests
  },
  filename: (req, file, cb) => {
    // génère un nom unique avec timestamp + extension
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

// 🔒 Filtre : accepter uniquement les images
const fileFilter = (req, file, cb) => {
  const allowedExt = /\.(jpeg|jpg|png|gif|webp)$/i;
  const allowedMime = /^(image\/(jpeg|png|gif|webp))$/i;
  const extname = allowedExt.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedMime.test(String(file.mimetype || ""));

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error("❌ Seules les images sont autorisées"));
  }
};

// 📦 Export du middleware
export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // max 10 MB par fichier
});

function collectUploadedFiles(req) {
  const out = [];
  if (req.file) out.push(req.file);
  if (Array.isArray(req.files)) {
    out.push(...req.files);
  } else if (req.files && typeof req.files === "object") {
    for (const list of Object.values(req.files)) {
      if (Array.isArray(list)) out.push(...list);
    }
  }
  return out.filter((f) => f && f.path);
}

async function readHeader(filePath, size = 16) {
  const fd = await fs.promises.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(size);
    await fd.read(buffer, 0, size, 0);
    return buffer;
  } finally {
    await fd.close();
  }
}

function isAllowedImageSignature(header) {
  if (!header || header.length < 12) return false;

  const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const isPng =
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a;
  const isGif =
    header[0] === 0x47 &&
    header[1] === 0x49 &&
    header[2] === 0x46 &&
    header[3] === 0x38 &&
    (header[4] === 0x37 || header[4] === 0x39) &&
    header[5] === 0x61;
  const isWebp =
    header[0] === 0x52 &&
    header[1] === 0x49 &&
    header[2] === 0x46 &&
    header[3] === 0x46 &&
    header[8] === 0x57 &&
    header[9] === 0x45 &&
    header[10] === 0x42 &&
    header[11] === 0x50;

  return isJpeg || isPng || isGif || isWebp;
}

export async function validateUploadedFilesSignature(req, res, next) {
  try {
    const files = collectUploadedFiles(req);
    if (!files.length) return next();

    const invalid = [];
    for (const file of files) {
      try {
        const header = await readHeader(file.path);
        if (!isAllowedImageSignature(header)) {
          invalid.push(file);
        }
      } catch {
        invalid.push(file);
      }
    }

    if (!invalid.length) return next();

    await Promise.all(
      invalid.map((f) => fs.promises.unlink(f.path).catch(() => null))
    );

    return res.status(400).json({ error: "Fichier image invalide (signature non reconnue)" });
  } catch (err) {
    console.error("❌ validateUploadedFilesSignature:", err);
    return res.status(500).json({ error: "Erreur validation upload" });
  }
}
