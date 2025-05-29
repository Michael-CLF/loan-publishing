// csv-export.service.ts
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class CsvExportService {
  downloadCSV(data: any[], filename: string): void {
    if (!data || !data.length) return;

    const header = Object.keys(data[0]).join(',');
    const rows = data.map(obj =>
      Object.values(obj).map(val => `"${(val ?? '').toString().replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = [header, ...rows].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.href = url;
    link.download = `${filename}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }
}
