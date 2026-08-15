import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export interface ExcelColumnDef {
    header: string;
    key: string;
    width?: number;
    numFmt?: string;
}

export interface ExcelSheetDef {
    name: string;
    columns: ExcelColumnDef[];
    rows: Record<string, unknown>[];
}

@Injectable()
export class ExcelExportService {
    async buildWorkbook(sheets: ExcelSheetDef[]): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Red Crescent Hospital System';
        workbook.created = new Date();

        for (const sheetDef of sheets) {
            const sheet = workbook.addWorksheet(sheetDef.name, {
                views: [{ state: 'frozen', ySplit: 1 }],
            });

            sheet.columns = sheetDef.columns.map((c) => ({
                header: c.header,
                key: c.key,
                width: c.width ?? 18,
                style: c.numFmt ? { numFmt: c.numFmt } : undefined,
            }));

            sheet.getRow(1).font = { bold: true };
            if (sheetDef.columns.length > 0) {
                sheet.autoFilter = {
                    from: { row: 1, column: 1 },
                    to: { row: 1, column: sheetDef.columns.length },
                };
            }

            sheet.addRows(sheetDef.rows);
        }

        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }
}
