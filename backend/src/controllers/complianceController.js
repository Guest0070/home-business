import { query } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';

function pdfEscape(value) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');
}

function buildSimplePdf(title, lines) {
  const pageWidth = 842;
  const pageHeight = 595;
  const marginX = 36;
  const lineHeight = 13;
  const maxLinesPerPage = 38;
  const pages = [];
  for (let index = 0; index < lines.length; index += maxLinesPerPage) {
    pages.push(lines.slice(index, index + maxLinesPerPage));
  }
  if (!pages.length) pages.push(['No records found.']);

  const objects = [];
  function addObject(content) {
    objects.push(content);
    return objects.length;
  }

  const fontObjectId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
  const pageObjectIds = [];
  const contentObjectIds = [];

  pages.forEach((pageLines, pageIndex) => {
    const textOps = [
      'BT',
      '/F1 14 Tf',
      `${marginX} ${pageHeight - 36} Td`,
      `(${pdfEscape(title)}) Tj`,
      '/F1 9 Tf',
      `0 -${lineHeight * 2} Td`,
      ...pageLines.flatMap((line) => [`(${pdfEscape(line)}) Tj`, `0 -${lineHeight} Td`]),
      '/F1 8 Tf',
      `0 -${lineHeight} Td`,
      `(Page ${pageIndex + 1} of ${pages.length}) Tj`,
      'ET'
    ].join('\n');
    const contentObjectId = addObject(`<< /Length ${Buffer.byteLength(textOps, 'utf8')} >>\nstream\n${textOps}\nendstream`);
    contentObjectIds.push(contentObjectId);
    pageObjectIds.push(null);
  });

  const pagesObjectId = objects.length + pages.length + 1;
  pages.forEach((_pageLines, index) => {
    const pageObjectId = addObject(`<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectIds[index]} 0 R >>`);
    pageObjectIds[index] = pageObjectId;
  });

  const kids = pageObjectIds.map((id) => `${id} 0 R`).join(' ');
  const realPagesObjectId = addObject(`<< /Type /Pages /Kids [${kids}] /Count ${pageObjectIds.length} >>`);
  const catalogObjectId = addObject(`<< /Type /Catalog /Pages ${realPagesObjectId} 0 R >>`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((content, index) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${index + 1} 0 obj\n${content}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

export async function getComplianceSummary(_req, res, next) {
  try {
    const result = await query(
      `SELECT
        COUNT(*) FILTER (WHERE reminder_state = 'overdue')::INT AS overdue,
        COUNT(*) FILTER (WHERE reminder_state = 'due_soon')::INT AS due_soon,
        COUNT(*) FILTER (WHERE reminder_state = 'ok')::INT AS active,
        COUNT(*)::INT AS total
       FROM compliance_reminders
       WHERE status <> 'completed'`
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function listComplianceItems(req, res, next) {
  try {
    const values = [];
    const clauses = [];

    if (req.query.vehicleId) {
      values.push(req.query.vehicleId);
      clauses.push(`vehicle_id = $${values.length}`);
    }
    if (req.query.from) {
      values.push(req.query.from);
      clauses.push(`due_date >= $${values.length}`);
    }
    if (req.query.to) {
      values.push(req.query.to);
      clauses.push(`due_date <= $${values.length}`);
    }

    const result = await query(
      `SELECT *
       FROM compliance_reminders
       ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
       ORDER BY due_date ASC, vehicle_no`,
      values
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createComplianceItem(req, res, next) {
  try {
    const vehicleResult = await query('SELECT id FROM vehicles WHERE id = $1', [req.body.vehicle_id]);
    if (!vehicleResult.rows[0]) throw new ApiError(400, 'Selected vehicle was not found');

    const result = await query(
      `INSERT INTO vehicle_compliance_items (
        vehicle_id, document_type, reference_no, provider_name, issue_date, due_date, reminder_days, status, notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        req.body.vehicle_id,
        req.body.document_type,
        req.body.reference_no || null,
        req.body.provider_name || null,
        req.body.issue_date || null,
        req.body.due_date,
        req.body.reminder_days ?? 15,
        req.body.status || 'active',
        req.body.notes || null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function updateComplianceItem(req, res, next) {
  try {
    const result = await query(
      `UPDATE vehicle_compliance_items
       SET document_type = $1,
        reference_no = $2,
        provider_name = $3,
        issue_date = $4,
        due_date = $5,
        reminder_days = $6,
        status = $7,
        notes = $8,
        updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        req.body.document_type,
        req.body.reference_no || null,
        req.body.provider_name || null,
        req.body.issue_date || null,
        req.body.due_date,
        req.body.reminder_days ?? 15,
        req.body.status || 'active',
        req.body.notes || null,
        req.params.id
      ]
    );
    if (!result.rows[0]) throw new ApiError(404, 'Compliance item not found');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function deleteComplianceItem(req, res, next) {
  try {
    const result = await query(
      `DELETE FROM vehicle_compliance_items
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );
    if (!result.rows[0]) throw new ApiError(404, 'Compliance item not found');
    res.json({
      mode: 'deleted',
      message: 'Compliance reminder removed successfully.',
      record: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
}

export async function downloadMonthlyExpiryPdf(req, res, next) {
  try {
    const now = new Date();
    const month = req.query.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (!/^\d{4}-\d{2}$/.test(month)) throw new ApiError(400, 'month must use yyyy-mm');
    const from = `${month}-01`;
    const result = await query(
      `SELECT *
       FROM compliance_reminders
       WHERE status <> 'completed'
        AND due_date >= $1::date
        AND due_date < ($1::date + INTERVAL '1 month')
       ORDER BY due_date ASC, vehicle_no, document_type`,
      [from]
    );

    const lines = [
      `Generated: ${new Date().toISOString().slice(0, 10)}    Month: ${month}`,
      ''.padEnd(120, '-'),
      'Due Date   Days Vehicle       Chassis Document                 Reference        State',
      ''.padEnd(120, '-'),
      ...result.rows.map((row) => [
        String(row.due_date || '').padEnd(10),
        String(row.days_left ?? '').padStart(4),
        String(row.vehicle_no || '').padEnd(13).slice(0, 13),
        String(row.chassis_last5 || '-').padEnd(7).slice(0, 7),
        String(row.document_type || '').replaceAll('_', ' ').padEnd(24).slice(0, 24),
        String(row.reference_no || '-').padEnd(16).slice(0, 16),
        String(row.reminder_state || '-')
      ].join(' '))
    ];

    const pdf = buildSimplePdf('Coal TMS - Bulk Document Expiry Report', lines);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="document-expiry-${month}.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
}
