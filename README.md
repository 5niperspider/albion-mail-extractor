# Albion Mail Extractor

A desktop app to extract mail data from Albion Online game network packets, featuring a clean GUI, cross-platform support, and one-click CSV export for Black Market item analytics.

![generated-image(1)](https://github.com/user-attachments/assets/70bbc1a2-fc10-41df-a39a-5cf68d20d12c)

## Features

- Real-time capture of Albion Online mail packet data
- Cross-platform: Windows (.exe installer) and Linux (AppImage)
- Simple, modern UI built with Electron
- Exports captured Black Market mail items as CSV, directly to your clipboard
- No files written to disk, all data is memory-only
- Open source, MIT license


## Download

- Windows: [Releases](https://github.com/YOUR_GITHUB_USERNAME/albion-mail-extractor/releases) (`.exe` installer)
- Linux: [Releases](https://github.com/YOUR_GITHUB_USERNAME/albion-mail-extractor/releases) (AppImage)


## Installation

### Linux

1. Install libpcap:

```sh
sudo apt install libpcap0.8  # Ubuntu/Debian
# or
sudo dnf install libpcap     # Fedora/RHEL
```

2. Download and make the AppImage executable:

```sh
chmod +x Albion\ Mail\ Extractor-x.x.x.AppImage
sudo ./Albion\ Mail\ Extractor-x.x.x.AppImage --no-sandbox
```


### Windows

1. Install [Npcap](https://npcap.com) (choose "WinPcap API-compatible Mode")
2. Download and run the `.exe` installer
3. Run "Albion Mail Extractor" from your desktop or Start Menu

## Usage

- Click **Start Capture**
- Open your in-game mailbox in Albion Online
- After reading mails, click **Stop Capture**
- Press **Copy CSV** to copy Black Market data in CSV format to your clipboard


## Developer Setup

```sh
git clone https://github.com/YOUR_GITHUB_USERNAME/albion-mail-extractor.git
cd albion-mail-extractor
npm install
npm run build
npm start          # For dev (Electron UI)
npm run dist-win   # Build Windows .exe (needs Wine+Mono if building from Linux)
npm run dist-linux # Build Linux .AppImage
```


## Build Requirements

- Node.js >= 18
- Linux: libpcap, wine + mono for cross-building `.exe`
- Windows: Npcap for runtime


## License

MIT License

***

