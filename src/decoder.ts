export interface DecodedPacket {
  type: string;
  data: any;
}

export class PhotonDecoder {
  decode(buffer: Buffer): DecodedPacket | null {
    try {
      // First, try raw buffer search for mail patterns
      const rawResult = this.decodeFromRawBuffer(buffer);
      if (rawResult && rawResult.type === 'mail') {
        return rawResult;
      }
      
      // Then continue with normal Photon decoding...
      if (buffer.length < 12) return null;

      const peerID = buffer.readUInt16BE(0);
      const crcEnabled = buffer.readUInt8(2);
      const commandCount = buffer.readUInt8(3);
      const timestamp = buffer.readUInt32BE(4);
      const challenge = buffer.readUInt32BE(8);
      
      let offset = 12;
      
      for (let i = 0; i < commandCount && offset < buffer.length; i++) {
        if (offset + 12 > buffer.length) break;
        
        const commandType = buffer.readUInt8(offset);
        const channelID = buffer.readUInt8(offset + 1);
        const flags = buffer.readUInt8(offset + 2);
        const reserved = buffer.readUInt8(offset + 3);
        const commandLength = buffer.readUInt32BE(offset + 4);
        const reliableSequenceNumber = buffer.readUInt32BE(offset + 8);
        
        if (commandType === 6 || commandType === 7) {
          const payloadOffset = offset + 12;
          const payloadLength = commandLength - 12;
          
          if (payloadOffset + payloadLength <= buffer.length) {
            const payload = buffer.slice(payloadOffset, payloadOffset + payloadLength);
            const result = this.decodePhotonMessage(payload);
            if (result) return result;
          }
        }
        
        offset += commandLength;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  decodeFromRawBuffer(buffer: Buffer): DecodedPacket | null {
    try {
      const ascii = buffer.toString('utf8');
      
      // Pattern: number|ITEM_NAME[@quality]|number|number[|number]
      const mailPattern = /(\d+)\|([A-Z0-9_]+(?:@\d+)?)\|(\d+)\|(\d+)(?:\|(\d+))?/g;
      const matches = [...ascii.matchAll(mailPattern)];
      
      if (matches && matches.length > 0) {
        const mailItems = matches.map(match => {
          const hasLocationField = match[5] !== undefined;
          
          return {
            amount: parseInt(match[1]),
            item: match[2],
            price: parseInt(match[3]),
            single: parseInt(match[4]),
            blackMarket: !hasLocationField
          };
        });
        
        return {
          type: 'mail',
          data: {
            items: mailItems,
            rawMatches: matches.map(m => m[0]),
            itemCount: mailItems.length
          }
        };
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  private decodePhotonMessage(buffer: Buffer): DecodedPacket | null {
    try {
      if (buffer.length < 3) return null;
      
      const messageType = buffer.readUInt8(0);
      let offset = 1;
      
      if (messageType === 2 || messageType === 3 || messageType === 4) {
        if (buffer.length < offset + 1) return null;
        
        const code = buffer.readUInt8(offset);
        offset++;
        
        const parameters = this.parsePhotonParameters(buffer, offset);
        
        if (this.looksLikeMail(parameters)) {
          return {
            type: 'mail',
            data: {
              messageType,
              code,
              parameters
            }
          };
        }
        
        return {
          type: 'generic',
          data: {
            messageType,
            code,
            parameters
          }
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }
  
  private getMessageTypeName(type: number): string {
    const names: {[key: number]: string} = {
      2: 'OperationRequest',
      3: 'OperationResponse',
      4: 'Event',
      7: 'InternalOperationRequest',
      8: 'InternalOperationResponse'
    };
    return names[type] || 'Unknown';
  }

  private parsePhotonParameters(buffer: Buffer, offset: number): any {
    const params: any = {};
    
    try {
      if (offset >= buffer.length) return params;
      
      const typeCode = buffer.readUInt8(offset);
      offset++;
      
      if (typeCode === 68) {
        const keyType = buffer.readUInt8(offset);
        const valueType = buffer.readUInt8(offset + 1);
        const size = buffer.readUInt16BE(offset + 2);
        offset += 4;
        
        for (let i = 0; i < size && offset < buffer.length; i++) {
          try {
            const key = this.readValue(buffer, keyType, offset);
            offset = key.nextOffset;
            
            const value = this.readValue(buffer, valueType, offset);
            offset = value.nextOffset;
            
            params[key.value] = value.value;
          } catch (e) {
            break;
          }
        }
      }
      
    } catch (error) {
      // Ignore errors
    }
    
    return params;
  }
  
  private readValue(buffer: Buffer, typeCode: number, offset: number): {value: any, nextOffset: number} {
    switch (typeCode) {
      case 3:
        return { value: buffer.readUInt8(offset), nextOffset: offset + 1 };
      
      case 8:
        return { value: buffer.readInt32BE(offset), nextOffset: offset + 4 };
      
      case 9:
        return { value: buffer.readInt16BE(offset), nextOffset: offset + 2 };
      
      case 10:
        return { value: buffer.readBigInt64BE(offset).toString(), nextOffset: offset + 8 };
      
      case 12:
        return { value: buffer.readUInt8(offset) !== 0, nextOffset: offset + 1 };
      
      case 18:
        const length = buffer.readUInt16BE(offset);
        const str = buffer.toString('utf8', offset + 2, offset + 2 + length);
        return { value: str, nextOffset: offset + 2 + length };
      
      default:
        return { value: null, nextOffset: offset + 1 };
    }
  }

  private looksLikeMail(params: any): boolean {
    return false; // Disabled - using raw buffer search instead
  }
}
