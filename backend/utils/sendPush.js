import https from "https";

/**
 * Envoie une ou plusieurs notifications push via Expo
 * @param {string|string[]} expoPushTokens - Token(s) Expo (ex: "ExponentPushToken[xxxx]")
 * @param {string} title - Titre de la notification
 * @param {string} body - Message de la notification
 * @param {object} [data] - Données optionnelles
 */
export async function sendPushNotification(expoPushTokens, title, body, data = {}) {
  try {
    // 🧺 Normalisation en tableau
    const tokens = Array.isArray(expoPushTokens)
      ? expoPushTokens
      : [expoPushTokens];

    // 🔍 Filtrer les tokens valides
    const validTokens = tokens.filter(
      (t) =>
        typeof t === "string" &&
        t.startsWith("ExponentPushToken")
    );

    if (validTokens.length === 0) {
      console.log("❌ Aucun token Expo valide fourni à sendPushNotification");
      return;
    }

    // 📦 Tableau de messages pour l’API Expo
    const messages = validTokens.map((token) => ({
      to: token,
      sound: "default",
      title,
      body,
      data,
    }));

    // 🌐 Compat Node < 18 (fallback https)
    const fetchCompat = async (url, options) => {
      if (typeof fetch === "function") return fetch(url, options);
      return await new Promise((resolve, reject) => {
        try {
          const u = new URL(url);
          const req = https.request(
            {
              hostname: u.hostname,
              path: `${u.pathname}${u.search}`,
              method: options?.method || "GET",
              headers: options?.headers || {},
            },
            (resp) => {
              let raw = "";
              resp.on("data", (chunk) => (raw += chunk));
              resp.on("end", () => {
                resolve({
                  status: resp.statusCode,
                  ok: resp.statusCode >= 200 && resp.statusCode < 300,
                  json: async () => {
                    try {
                      return JSON.parse(raw || "{}");
                    } catch {
                      return { error: "Invalid JSON" };
                    }
                  },
                });
              });
            }
          );
          req.on("error", reject);
          if (options?.body) req.write(options.body);
          req.end();
        } catch (e) {
          reject(e);
        }
      });
    };

    const res = await fetchCompat("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await res.json();

    // 🧾 Logs
    if (res.ok) {
      console.log("📤 Notifications envoyées :", {
        tokens: validTokens,
        title,
        body,
      });
    } else {
      console.log("⚠️ Erreur API Expo :", result);
    }
  } catch (err) {
    console.error("❌ Erreur envoi notification Expo :", err);
  }
}
