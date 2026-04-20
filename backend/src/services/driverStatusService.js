export async function appendDriverStatusHistory(client, {
  driverId,
  status,
  startDate,
  endDate = null,
  notes = null
}) {
  const historyResult = await client.query(
    `SELECT id, status, start_date, end_date
     FROM driver_status_history
     WHERE driver_id = $1 AND end_date IS NULL
     ORDER BY start_date DESC, created_at DESC
     LIMIT 1`,
    [driverId]
  );

  const openEntry = historyResult.rows[0];
  if (openEntry && openEntry.status === status && String(openEntry.start_date) === String(startDate)) {
    if (notes) {
      await client.query(
        `UPDATE driver_status_history
         SET notes = COALESCE($1, notes)
         WHERE id = $2`,
        [notes, openEntry.id]
      );
    }
    return;
  }

  if (openEntry) {
    const closeDate = startDate < openEntry.start_date ? openEntry.start_date : startDate;
    await client.query(
      `UPDATE driver_status_history
       SET end_date = $1
       WHERE id = $2`,
      [closeDate, openEntry.id]
    );
  }

  await client.query(
    `INSERT INTO driver_status_history (driver_id, status, start_date, end_date, notes)
     VALUES ($1, $2, $3, $4, $5)`,
    [driverId, status, startDate, endDate, notes]
  );
}

export function todayDate() {
  return new Date().toISOString().slice(0, 10);
}
