import {
  buildTripExportWorkbook,
  buildTripTemplateWorkbook,
  importTripsFromWorkbook,
  previewTripWorkbook
} from '../services/tripExcelService.js';
import { ApiError } from '../utils/apiError.js';

async function sendWorkbook(res, workbook, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

export async function downloadTripTemplate(_req, res, next) {
  try {
    await sendWorkbook(res, await buildTripTemplateWorkbook(), 'trip-import-template.xlsx');
  } catch (error) {
    next(error);
  }
}

export async function exportTripsWorkbook(_req, res, next) {
  try {
    await sendWorkbook(res, await buildTripExportWorkbook(), 'trips-export.xlsx');
  } catch (error) {
    next(error);
  }
}

export async function previewTrips(req, res, next) {
  try {
    if (!req.file) throw new ApiError(400, 'Upload an Excel .xlsx file');
    res.json(await previewTripWorkbook(req.file.buffer));
  } catch (error) {
    next(error);
  }
}

export async function importTrips(req, res, next) {
  try {
    if (!req.file) throw new ApiError(400, 'Upload an Excel .xlsx file');
    res.json(await importTripsFromWorkbook(req.file.buffer, req.user.id));
  } catch (error) {
    next(error);
  }
}
