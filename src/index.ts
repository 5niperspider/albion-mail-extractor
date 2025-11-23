import * as Cap from 'cap';
import { PhotonDecoder } from './decoder';
import { MailParser } from './mailParser';
import { DataExporter } from './exporter';

interface Mail {
  id: string;
  timestamp: Date;
  sender: string;
  subject: string;
  content: string;
  attachments?: any[];
}

export class AlbionMailExtractor {
  private cap: any;
  private decoder: PhotonDecoder;
  private mailParser: MailParser;
  private exporter: DataExporter;
  private mails: Mail[] = [];
  private device: string = '';
  private packetCount: number = 0;
  private albionPacketCount: number = 0;
  private albionPackets: Array<{
    srcPort: number;
    dstPort: number;
    srcIP: string;
    dstIP: string;
    data: Buffer;
    timestamp: Date;
  }> = [];
  
  private readonly ALBION_PORTS = [5055, 5056, 5057];
  private readonly ALBION_SERVER_IPS = [
    '5.45.187',
    '5.188.125',
    '162.252.172',
    '54.93.199',
  ];

  constructor() {
    this.decoder = new PhotonDecoder();
    this.mailParser = new MailParser();
    this.exporter = new DataExporter();
    this.cap = new Cap.Cap();
  }

  start(): void {
    console.log('🔍 Albion Online Mail Extractor Started');
    console.log('📡 Detecting network interface...\n');

    const deviceList = Cap.Cap.deviceList();
    
    if (!deviceList || deviceList.length === 0) {
      console.error('❌ No network devices found!');
      console.log('💡 Make sure you have libpcap installed and run with sudo privileges');
      return;
    }
    
    console.log('Available devices:');
    deviceList.forEach((dev: any, index: number) => {
      console.log(`${index}: ${dev.name} - ${dev.description || 'No description'}`);
      if (dev.addresses && dev.addresses.length > 0) {
        dev.addresses.forEach((addr: any) => {
          console.log(`   Address: ${addr.addr || 'N/A'}`);
        });
      }
    });

    this.device = deviceList[0].name;
    console.log(`\n✅ Using device: ${this.device}\n`);

    const filter = 'udp';
    const bufSize = 10 * 1024 * 1024;
    const buffer = Buffer.alloc(65535);

    try {
      console.log('🔧 Opening capture device...');
      const linkType = this.cap.open(this.device, filter, bufSize, buffer);
      console.log(`✅ Capture opened successfully! Link type: ${linkType}\n`);
      
      console.log('🎮 Listening for Albion packets...');
      console.log('⏹️  Press Stop Capture button when done\n');

      this.cap.on('packet', (nbytes: number, truncated: boolean) => {
        this.packetCount++;
        this.processPacket(buffer, nbytes, linkType);
      });

    } catch (error) {
      console.log('❌ Error starting capture:', error);
    }
  }

  stop(): void {
    console.log('\n⏹️  Stopping capture...');
    console.log(`📊 Total packets: ${this.packetCount}`);
    console.log(`🎮 Albion packets: ${this.albionPacketCount}`);
    
    this.saveAlbionPacketsForAnalysis();
    this.exportData();
    this.cap.close();
  }

  private processPacket(buffer: Buffer, nbytes: number, linkType: string): void {
    try {
      if (linkType === 'ETHERNET') {
        const ret = Cap.decoders.Ethernet(buffer);
        
        if (ret.info.type === Cap.decoders.PROTOCOL.ETHERNET.IPV4) {
          const ipv4 = Cap.decoders.IPV4(buffer, ret.offset);
          
          if (ipv4.info.protocol === Cap.decoders.PROTOCOL.IP.UDP) {
            const udp = Cap.decoders.UDP(buffer, ipv4.offset);
            const dataOffset = udp.offset;
            const dataLength = udp.info.length - 8;
            
            if (dataLength > 0 && dataLength < 65535) {
              const packetData = buffer.slice(dataOffset, dataOffset + dataLength);
              
              const isAlbion = this.isAlbionPacket(
                ipv4.info.srcaddr,
                ipv4.info.dstaddr,
                udp.info.srcport,
                udp.info.dstport,
                packetData
              );
              
              if (isAlbion) {
                this.albionPacketCount++;
                
                this.albionPackets.push({
                  srcPort: udp.info.srcport,
                  dstPort: udp.info.dstport,
                  srcIP: ipv4.info.srcaddr,
                  dstIP: ipv4.info.dstaddr,
                  data: Buffer.from(packetData),
                  timestamp: new Date()
                });
                
                this.decodePhotonPacket(packetData);
              }
            }
          }
        }
      } else if (linkType === 'LINUX_SLL') {
        if (buffer.length < 16) return;
        
        const protocolType = buffer.readUInt16BE(14);
        
        if (protocolType === 0x0800) {
          const ipv4 = Cap.decoders.IPV4(buffer, 16);
          
          if (ipv4.info.protocol === Cap.decoders.PROTOCOL.IP.UDP) {
            const udp = Cap.decoders.UDP(buffer, ipv4.offset);
            const dataOffset = udp.offset;
            const dataLength = udp.info.length - 8;
            
            if (dataLength > 0 && dataLength < 65535) {
              const packetData = buffer.slice(dataOffset, dataOffset + dataLength);
              
              const isAlbion = this.isAlbionPacket(
                ipv4.info.srcaddr,
                ipv4.info.dstaddr,
                udp.info.srcport,
                udp.info.dstport,
                packetData
              );
              
              if (isAlbion) {
                this.albionPacketCount++;
                
                this.albionPackets.push({
                  srcPort: udp.info.srcport,
                  dstPort: udp.info.dstport,
                  srcIP: ipv4.info.srcaddr,
                  dstIP: ipv4.info.dstaddr,
                  data: Buffer.from(packetData),
                  timestamp: new Date()
                });
                
                this.decodePhotonPacket(packetData);
              }
            }
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }
  }
  
  private isAlbionPacket(srcIP: string, dstIP: string, srcPort: number, dstPort: number, data: Buffer): boolean {
    const hasAlbionPort = this.ALBION_PORTS.includes(srcPort) || this.ALBION_PORTS.includes(dstPort);
    const hasAlbionIP = this.ALBION_SERVER_IPS.some(ip => srcIP.startsWith(ip) || dstIP.startsWith(ip));
    const hasPhotonSignature = this.looksLikePhotonPacket(data);
    
    return hasAlbionPort || (hasAlbionIP && hasPhotonSignature);
  }
  
  private looksLikePhotonPacket(data: Buffer): boolean {
    if (data.length < 12) return false;
    
    const crcFlag = data.readUInt8(2);
    const commandCount = data.readUInt8(3);
    
    return commandCount > 0 && commandCount < 20 && (crcFlag === 0 || crcFlag === 1);
  }
  
  private toReadableASCII(buffer: Buffer): string {
    let result = '';
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      if (byte >= 32 && byte <= 126) {
        result += String.fromCharCode(byte);
      } else {
        result += '.';
      }
    }
    return result;
  }
  
  private saveAlbionPacketsForAnalysis(): void {
    console.log('\n🔍 Analysis complete');
    // No file creation - data stored in memory only
  }

  private decodePhotonPacket(data: Buffer): void {
    try {
      const decoded = this.decoder.decode(data);
      
      if (decoded && decoded.type === 'mail') {
        console.log(`\n📧 MAIL DETECTED!`);
        console.log(`   Items: ${decoded.data.itemCount || 0}`);
        if (decoded.data.items && decoded.data.items.length > 0) {
          decoded.data.items.forEach((item: any, idx: number) => {
            const market = item.blackMarket ? 'BM' : 'RM';
            console.log(`   [${idx + 1}] ${item.amount}x ${item.item} @ ${market} - ${item.price}`);
          });
        }
        
        const mail = this.mailParser.parse(decoded);
        if (mail) {
          this.mails.push(mail);
        }
      }
    } catch (error) {
      // Silently ignore decode errors
    }
  }

  private exportData(): void {
    // Extract all mail items from captured packets
    const allMailItems: any[] = [];
    
    this.albionPackets.forEach(packet => {
      try {
        const decoded = this.decoder.decode(packet.data);
        if (decoded && decoded.type === 'mail' && decoded.data.items) {
          allMailItems.push(...decoded.data.items);
        }
      } catch (e) {
        // Ignore decode errors
      }
    });
    
    if (allMailItems.length === 0) {
      console.log('⚠️  No mail items captured');
      return;
    }

    console.log(`\n📊 Captured ${allMailItems.length} mail items in memory`);
  }

  // Method to get CSV data for clipboard
  getCSVData(): string {
    const allMailItems: any[] = [];
    
    this.albionPackets.forEach(packet => {
      try {
        const decoded = this.decoder.decode(packet.data);
        if (decoded && decoded.type === 'mail' && decoded.data.items) {
          allMailItems.push(...decoded.data.items);
        }
      } catch (e) {
        // Ignore
      }
    });
    
    // Filter only Black Market items
    const blackMarketItems = allMailItems.filter(item => item.blackMarket === true);
    
    // Generate CSV (no header)
    const rows: string[] = [];
    blackMarketItems.forEach(item => {
      const row = [
        item.price.toString(),
        item.amount.toString(),
        this.escapeCSV(item.item)
      ];
      rows.push(row.join(','));
    });
    
    return rows.join('\n');
  }
  
  private escapeCSV(field: string): string {
    if (typeof field !== 'string') {
      field = String(field);
    }
    
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    
    return field;
  }
}

// Only auto-start if run directly (not imported)
if (require.main === module) {
  const extractor = new AlbionMailExtractor();
  extractor.start();
}
