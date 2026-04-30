import { applyExportPreset, loadDataset, toCsv } from '../services/exportService.js';
import { ApiError } from '../utils/apiError.js';

export async function exportDataset(req, res, next) {
  try {
    const format = (req.query.format || 'csv').toLowerCase();
    const preset = (req.query.preset || 'standard').toLowerCase();
    const rows = applyExportPreset(req.params.kind, await loadDataset(req.params.kind, req.query), preset);

    if (format === 'json') {
      return res.json(rows);
    }

    if (format !== 'csv') {
      throw new ApiError(400, 'Export format must be csv or json');
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.kind}-${preset}.csv"`);
    res.send(toCsv(rows));
  } catch (error) {
    next(error);
  }
}
