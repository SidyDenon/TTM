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
  const allowed = /jpeg|jpg|png|gif/;
  const extname = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowed.test(file.mimetype);

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
  limits: { fileSize: 5 * 1024 * 1024 } // max 5 MB par fichier
});
