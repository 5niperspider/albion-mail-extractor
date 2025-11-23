export interface Mail {
  id: string;
  timestamp: Date;
  sender: string;
  subject: string;
  content: string;
  attachments?: any[];
}

export class MailParser {
  parse(decoded: any): Mail | null {
    try {
      const data = decoded.data;
      
      // Extract mail fields from decoded packet
      // Field names will vary - adjust based on packet analysis
      
      const mail: Mail = {
        id: this.extractField(data, ['id', 'mailId', 'messageId']) || 
            this.generateId(),
        timestamp: this.extractTimestamp(data) || new Date(),
        sender: this.extractField(data, ['sender', 'from', 'senderName']) || 
                'Unknown',
        subject: this.extractField(data, ['subject', 'title']) || 
                 'No Subject',
        content: this.extractField(data, ['content', 'message', 'body', 'text']) || 
                 '',
        attachments: this.extractAttachments(data)
      };

      // Validate mail has minimum required data
      if (!mail.content && !mail.subject) {
        return null;
      }

      return mail;
    } catch (error) {
      console.error('Error parsing mail:', error);
      return null;
    }
  }

  private extractField(data: any, possibleKeys: string[]): string | undefined {
    for (const key of possibleKeys) {
      if (data[key]) {
        return String(data[key]);
      }
    }
    return undefined;
  }

  private extractTimestamp(data: any): Date | null {
    const timestampKeys = ['timestamp', 'time', 'date', 'sentTime'];
    
    for (const key of timestampKeys) {
      if (data[key]) {
        try {
          return new Date(data[key]);
        } catch {
          continue;
        }
      }
    }
    
    return null;
  }

  private extractAttachments(data: any): any[] | undefined {
    const attachmentKeys = ['attachments', 'items', 'rewards'];
    
    for (const key of attachmentKeys) {
      if (data[key] && Array.isArray(data[key])) {
        return data[key];
      }
    }
    
    return undefined;
  }

  private generateId(): string {
    return `mail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}