import {
  buildDriverExportWorkbook,
  buildDriverTemplateWorkbook,
  importDriversFromWorkbook,
  previewDriverWorkbook
} from '../services/driverExcelService.js';
import { ApiError } from '../utils/apiError.js';

async function sendWorkbook(res, workbook, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

export async function downloadDriverTemplate(_req, res, next) {
  try {
    await sendWorkbook(res, await buildDriverTemplateWorkbook(), 'driver-import-template.xlsx');
  } catch (error) {
    next(error);
  }
}

export async function exportDrivers(_req, res, next) {
  try {
    await sendWorkbook(res, await buildDriverExportWorkbook(), 'drivers-export.xlsx');
  } catch (error) {
    next(error);
  }
}

export async function importDrivers(req, res, next) {
  try {
    if (!req.file) throw new ApiError(400, 'Upload an Excel .xlsx file');
    res.json(await importDriversFromWorkbook(req.file.buffer));
  } catch (error) {
    next(error);
  }
}

export async function previewDrivers(req, res, next) {
  try {
    if (!req.file) throw new ApiError(400, 'Upload an Excel .xlsx file');
    res.json(await previewDriverWorkbook(req.file.buffer));
  } catch (error) {
    next(error);
  }
}

