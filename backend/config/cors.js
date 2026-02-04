import os from "os";

function normalizeOrigin(u) {
  if (!u) return "";
  let s = String(u).trim();
  // supprime espaces après http(s)://
  s = s.replace(/^(https?:\/\/)\s+/, "$1");
  // supprime les / finaux
  s = s.replace(/\/+$/g, "");
  return s;
}

function getLocalIPv4() {
  try {
    const nics = os.networkInterfaces();
    for (const name of Object.keys(nics)) {
      for (const info of nics[name] || []) {
        if (info && info.family === "IPv4" && !info.internal) {
          return info.address;
        }
      }
    }
  } catch {}
  return "127.0.0.1";
}

const LAN_IP = process.env.LOCAL_IP || getLocalIPv4();

const rawOrigins = (process.env.CORS_ORIGINS ||
  `http://localhost:5173,http://localhost:3000,http://${LAN_IP}:5173,http://${LAN_IP}:3000,http://${LAN_IP}:5000,http://10.0.2.2:5000,http://192.168.11.241:5173,http://192.168.11.103,https://ttm-production-d022.up.railway.app,https://ttmadmin.netlify.app,https://towtruckmali.com,https://www.towtruckmali.com`)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = rawOrigins.map(normalizeOrigin);
const allowedOriginsSet = new Set(allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // curl / apps natives
    const o = normalizeOrigin(origin);
    if (allowedOriginsSet.has(o)) return callback(null, true);
    console.warn("CORS refusé pour origin:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

export { corsOptions, allowedOrigins, normalizeOrigin, getLocalIPv4, LAN_IP };
