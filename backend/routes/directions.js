import express from "express";
import https from "https";

const router = express.Router();

const fetchJsonCompat = async (targetUrl) => {
  if (typeof fetch === "function") {
    const r = await fetch(targetUrl);
    let json;
    try {
      json = await r.json();
    } catch {
      json = { error: "Réponse non-JSON depuis Google" };
    }
    return { ok: r.ok, status: r.status, json };
  }
  return await new Promise((resolve) => {
    https
      .get(targetUrl, (resp) => {
        let data = "";
        resp.on("data", (chunk) => (data += chunk));
        resp.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = { error: "Réponse non-JSON depuis Google" };
          }
          resolve({
            ok: resp.statusCode >= 200 && resp.statusCode < 300,
            status: resp.statusCode,
            json: parsed,
          });
        });
      })
      .on("error", (err) => {
        resolve({
          ok: false,
          status: 500,
          json: { error: err.message },
        });
      });
  });
};

export default () => {
  router.get("/", async (req, res) => {
    try {
      const { origin, destination, mode = "driving", provider } = req.query;
      if (!origin || !destination) {
        return res
          .status(400)
          .json({ error: "Paramètres requis: origin, destination" });
      }

      const key = process.env.GOOGLE_API_KEY;

      let googleTried = false;
      if (key && provider !== "osrm") {
        googleTried = true;
        const gUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
          origin
        )}&destination=${encodeURIComponent(
          destination
        )}&mode=${encodeURIComponent(mode)}&key=${key}`;
        const { ok, status, json } = await fetchJsonCompat(gUrl);
        if (ok && json?.routes?.length) {
          return res.status(200).json(json);
        }
        console.warn(
          "⚠️ Directions Google non OK ou sans route:",
          status,
          json?.status,
          json?.error_message || json?.error || ""
        );
      }

      const [oLatStr, oLngStr] = String(origin).split(",");
      const [dLatStr, dLngStr] = String(destination).split(",");
      const oLat = Number(oLatStr),
        oLng = Number(oLngStr);
      const dLat = Number(dLatStr),
        dLng = Number(dLngStr);
      if (
        !Number.isFinite(oLat) ||
        !Number.isFinite(oLng) ||
        !Number.isFinite(dLat) ||
        !Number.isFinite(dLng)
      ) {
        return res
          .status(400)
          .json({ error: "Coordonnées invalides pour origin/destination" });
      }

      const osrmProfile =
        mode === "walking"
          ? "foot"
          : mode === "bicycling"
          ? "bike"
          : "driving";
      const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=polyline`;
      const {
        ok: okOsrm,
        status: statusOsrm,
        json: osrm,
      } = await fetchJsonCompat(osrmUrl);
      if (!okOsrm || osrm?.code !== "Ok" || !osrm?.routes?.length) {
        const msg = `OSRM échec: ${statusOsrm} ${osrm?.code || ""}`.trim();
        console.warn("⚠️ Fallback OSRM sans route:", msg);
        return res.status(502).json({
          error: googleTried ? "Aucune route Google et OSRM" : "Aucune route OSRM",
          detail: msg,
        });
      }

      const r0 = osrm.routes[0];
      const geometry = r0.geometry;
      const distance = Math.round(r0.distance || 0);
      const duration = Math.round(r0.duration || 0);

      const normalized = {
        status: "OK",
        routes: [
          {
            overview_polyline: { points: geometry },
            legs: [
              {
                distance: { value: distance },
                duration: { value: duration },
              },
            ],
          },
        ],
      };
      return res.status(200).json(normalized);
    } catch (err) {
      console.error("❌ Proxy Directions erreur:", err);
      res.status(500).json({ error: "Erreur proxy Directions" });
    }
  });

  return router;
};
