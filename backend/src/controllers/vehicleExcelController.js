import {
  buildVehicleExportWorkbook,
  buildVehicleTemplateWorkbook,
  importVehiclesFromWorkbook,
  previewVehicleWorkbook
} from '../services/vehicleExcelService.js';
import { ApiError } from '../utils/apiError.js';

async function sendWorkbook(res, workbook, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

export async function downloadVehicleTemplate(_req, res, next) {
  try {
    const workbook = await buildVehicleTemplateWorkbook();
    await sendWorkbook(res, workbook, 'vehicle-import-template.xlsx');
  } catch (error) {
    next(error);
  }
}

export async function exportVehicles(_req, res, next) {
  try {
    const workbook = await buildVehicleExportWorkbook();
    await sendWorkbook(res, workbook, 'vehicles-export.xlsx');
  } catch (error) {
    next(error);
  }
}

export async function importVehicles(req, res, next) {
  try {
    if (!req.file) throw new ApiError(400, 'Upload an Excel .xlsx file');
    const summary = await importVehiclesFromWorkbook(req.file.buffer);
    res.json(summary);
  } catch (error) {
    next(error);
  }
}

export async function previewVehicles(req, res, next) {
  try {
    if (!req.file) throw new ApiError(400, 'Upload an Excel .xlsx file');
    res.json(await previewVehicleWorkbook(req.file.buffer));
  } catch (error) {
    next(error);
  }
}

