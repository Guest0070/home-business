import {
  buildDeliveryOrderExportWorkbook,
  buildDeliveryOrderTemplateWorkbook,
  importDeliveryOrdersFromWorkbook,
  previewDeliveryOrderWorkbook
} from '../services/deliveryOrderExcelService.js';
import { ApiError } from '../utils/apiError.js';

async function sendWorkbook(res, workbook, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

export async function downloadDeliveryOrderTemplate(_req, res, next) {
  try {
    await sendWorkbook(res, await buildDeliveryOrderTemplateWorkbook(), 'delivery-order-import-template.xlsx');
  } catch (error) {
    next(error);
  }
}

export async function exportDeliveryOrdersWorkbook(_req, res, next) {
  try {
    await sendWorkbook(res, await buildDeliveryOrderExportWorkbook(), 'delivery-orders-export.xlsx');
  } catch (error) {
    next(error);
  }
}

export async function previewDeliveryOrders(req, res, next) {
  try {
    if (!req.file) throw new ApiError(400, 'Upload an Excel .xlsx file');
    res.json(await previewDeliveryOrderWorkbook(req.file.buffer));
  } catch (error) {
    next(error);
  }
}

export async function importDeliveryOrders(req, res, next) {
  try {
    if (!req.file) throw new ApiError(400, 'Upload an Excel .xlsx file');
    res.json(await importDeliveryOrdersFromWorkbook(req.file.buffer, req.user.id));
  } catch (error) {
    next(error);
  }
}
