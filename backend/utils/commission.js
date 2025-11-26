// utils/commission.js
export async function getCommissionPercent(db, fallback = 10) {
  let percent = fallback;
  try {
    const [[row]] = await db.query("SELECT commission_percent FROM configurations LIMIT 1");
    if (row && row.commission_percent != null) {
      percent = Number(row.commission_percent);
    }
  } catch {
    // table absente ou requête impossible → fallback
  }

  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    percent = fallback;
  }
  return percent;
}
