import { io, onlineUsers } from "../socket/index.js";
import { getSchemaColumns } from "../utils/schema.js";
import { sendPushNotification } from "../utils/sendPush.js";

const OPERATOR_ALERTS_ENABLED =
  String(process.env.OPERATOR_ALERTS_ENABLED || "1") !== "0";
const OPERATOR_ALERT_INTERVAL_MS = Number(
  process.env.OPERATOR_ALERT_INTERVAL_MS || 60000
);
const OPERATOR_ALERT_SUPPRESS_WITH_ACTIVE =
  String(process.env.OPERATOR_ALERT_SUPPRESS_WITH_ACTIVE_MISSION || "1") !== "0";

const ACTIVE_MISSION_STATUSES = [
  "assignee",
  "acceptee",
  "en_route",
  "sur_place",
  "remorquage",
];
const PENDING_MISSION_STATUSES = ["publiee"];

let hasDeviceTokensTable = null;
async function deviceTokensTableExists(db) {
  if (hasDeviceTokensTable !== null) return hasDeviceTokensTable;
  try {
    const [[row]] = await db.query(
      `SELECT COUNT(*) AS cnt
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'device_tokens'`
    );
    hasDeviceTokensTable = Number(row?.cnt || 0) > 0;
  } catch (err) {
    hasDeviceTokensTable = false;
  }
  return hasDeviceTokensTable;
}

function normalizeZoneKey(value) {
  return String(value || "").trim().toLowerCase();
}

function collectZoneMatches(zoneMap, keys = []) {
  const matches = new Set();
  const normKeys = keys.map(normalizeZoneKey).filter(Boolean);
  for (const key of normKeys) {
    if (zoneMap.has(key)) {
      matches.add(key);
      continue;
    }
    for (const z of zoneMap.keys()) {
      if (z.includes(key) || key.includes(z)) {
        matches.add(z);
      }
    }
  }
  return Array.from(matches);
}

async function fetchPendingByZone(db) {
  const [rows] = await db.query(
    `SELECT LOWER(TRIM(zone)) AS zone_key,
            COUNT(*) AS cnt,
            GROUP_CONCAT(id ORDER BY created_at ASC SEPARATOR ',') AS ids
     FROM requests
     WHERE status IN (${PENDING_MISSION_STATUSES.map(() => "?").join(",")})
       AND (operator_id IS NULL OR operator_id = 0)
       AND zone IS NOT NULL AND TRIM(zone) <> ''
     GROUP BY zone_key`,
    PENDING_MISSION_STATUSES
  );

  const map = new Map();
  for (const row of rows || []) {
    const key = normalizeZoneKey(row.zone_key);
    if (!key) continue;
    const ids = String(row.ids || "")
      .split(",")
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));
    map.set(key, { count: Number(row.cnt || 0), ids });
  }
  return map;
}

async function fetchActiveOperatorIds(db) {
  const [rows] = await db.query(
    `SELECT operator_id
     FROM requests
     WHERE operator_id IS NOT NULL
       AND status IN (${ACTIVE_MISSION_STATUSES.map(() => "?").join(",")})
     GROUP BY operator_id`,
    ACTIVE_MISSION_STATUSES
  );
  return new Set(rows.map((r) => Number(r.operator_id)));
}

async function fetchOperatorTargets(db) {
  const { operatorDispo, operatorAlerts } = await getSchemaColumns(db);
  const dispoSelect = operatorDispo ? `o.${operatorDispo} AS dispo` : "1 AS dispo";
  const alertsSelect = operatorAlerts
    ? `o.${operatorAlerts} AS alerts_enabled`
    : "1 AS alerts_enabled";
  const [rows] = await db.query(
    `SELECT o.user_id,
            o.ville,
            o.quartier,
            ${dispoSelect},
            ${alertsSelect},
            u.notification_token
     FROM operators o
     JOIN users u ON u.id = o.user_id`
  );
  return rows || [];
}

async function fetchPushTokensForUser(db, userId) {
  const tokens = new Set();
  const hasTable = await deviceTokensTableExists(db);
  if (hasTable) {
    try {
      const [rows] = await db.query(
        "SELECT token FROM device_tokens WHERE user_id = ?",
        [userId]
      );
      for (const row of rows || []) {
        if (row?.token) tokens.add(row.token);
      }
    } catch (err) {
      // ignore
    }
  }

  try {
    const [[row]] = await db.query(
      "SELECT notification_token FROM users WHERE id = ? LIMIT 1",
      [userId]
    );
    if (row?.notification_token) tokens.add(row.notification_token);
  } catch (err) {
    // ignore
  }

  return Array.from(tokens);
}

async function runPendingMissionAlerts(db) {
  if (!OPERATOR_ALERTS_ENABLED) return;
  if (!Number.isFinite(OPERATOR_ALERT_INTERVAL_MS) || OPERATOR_ALERT_INTERVAL_MS <= 0)
    return;

  const [zoneMap, activeSet, operators] = await Promise.all([
    fetchPendingByZone(db),
    fetchActiveOperatorIds(db),
    fetchOperatorTargets(db),
  ]);

  if (!zoneMap.size || !operators.length) return;

  for (const op of operators) {
    const operatorId = Number(op.user_id);
    if (!Number.isFinite(operatorId)) continue;

    if (OPERATOR_ALERT_SUPPRESS_WITH_ACTIVE && activeSet.has(operatorId)) {
      continue;
    }

    if (op.alerts_enabled != null && Number(op.alerts_enabled) === 0) {
      continue;
    }

    if (op.dispo != null && Number(op.dispo) === 0) continue;

    const zones = collectZoneMatches(zoneMap, [op.ville, op.quartier]);
    if (!zones.length) continue;

    let count = 0;
    const idSet = new Set();
    for (const zoneKey of zones) {
      const entry = zoneMap.get(zoneKey);
      if (!entry) continue;
      count += Number(entry.count || 0);
      for (const id of entry.ids || []) idSet.add(id);
    }

    if (count <= 0) continue;

    const payload = {
      count,
      zones,
      ids: Array.from(idSet).slice(0, 10),
      interval_ms: OPERATOR_ALERT_INTERVAL_MS,
      ts: Date.now(),
    };

    if (onlineUsers.operators.has(operatorId)) {
      io.to(`operator:${operatorId}`).emit("missions_pending", payload);
      continue;
    }

    const tokens = await fetchPushTokensForUser(db, operatorId);
    if (!tokens.length) continue;

    const title = "Missions en attente";
    const body =
      count === 1
        ? "1 mission en attente dans votre zone."
        : `${count} missions en attente dans votre zone.`;
    try {
      await sendPushNotification(tokens, title, body, {
        type: "missions_pending",
        count,
        zones,
      });
    } catch (err) {
      console.warn("⚠️ Push missions_pending échoué:", err?.message || err);
    }
  }
}

export function startOperatorAlerts(db) {
  if (!OPERATOR_ALERTS_ENABLED || !Number.isFinite(OPERATOR_ALERT_INTERVAL_MS)) {
    return null;
  }
  return setInterval(() => {
    runPendingMissionAlerts(db).catch((err) =>
      console.warn("⚠️ runPendingMissionAlerts:", err?.message || err)
    );
  }, OPERATOR_ALERT_INTERVAL_MS);
}
