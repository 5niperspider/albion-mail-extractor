import * as fs from 'fs';
import * as path from 'path';

interface MailItem {
  amount: number;
  item: string;
  price: number;
  single: number;
  blackMarket: boolean;
}

interface Mail {
  id: string;
  timestamp: Date;
  sender: string;
  subject: string;
  content: string;
  attachments?: any[];
  items?: MailItem[];
}

export class DataExporter {
  toJSON(mails: Mail[], filename: string): void {
    const outputPath = path.join(process.cwd(), filename);
    const jsonData = JSON.stringify(mails, null, 2);
    fs.writeFileSync(outputPath, jsonData, 'utf-8');
  }

  toCSV(items: MailItem[], filename: string): void {
    const outputPath = path.join(process.cwd(), filename);
    
    // Filter only Black Market items (blackMarket === true)
    const blackMarketItems = items.filter(item => item.blackMarket === true);
    
    // CSV rows (no header)
    const rows: string[] = [];
    
    blackMarketItems.forEach(item => {
      const row = [
        item.price.toString(),
        item.amount.toString(),
        this.escapeCSV(item.item)
      ];
      rows.push(row.join(','));
    });
    
    fs.writeFileSync(outputPath, rows.join('\n'), 'utf-8');
  }

  private escapeCSV(field: string): string {
    if (typeof field !== 'string') {
      field = String(field);
    }
    
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    
    return field;
  }
}
