const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Detect if running with elevated privileges
const isRoot = process.platform !== 'win32' && process.getuid && process.getuid() === 0;
const isPkexec = process.env.PKEXEC_UID !== undefined;

// Auto-add --no-sandbox for elevated execution
if (isRoot || isPkexec) {
  if (!app.commandLine.hasSwitch('no-sandbox')) {
    app.commandLine.appendSwitch('no-sandbox');
  }
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('disable-setuid-sandbox');
}

// Disable GPU on Linux when running as root
if ((isRoot || isPkexec) && process.platform === 'linux') {
  app.disableHardwareAcceleration();
}

let mainWindow;
let captureInstance = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('ui.html');
  
  mainWindow.on('closed', () => {
    if (captureInstance) {
      captureInstance.stop();
    }
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Start capture process
ipcMain.on('start-capture', (event) => {
  if (captureInstance) {
    event.reply('log-message', '⚠️ Capture already running\n');
    return;
  }
  
  // Check privileges
  if (process.platform !== 'win32' && !isRoot && !isPkexec) {
    event.reply('log-message', '❌ ERROR: Root privileges required for packet capture.\n');
    event.reply('log-message', '💡 Restart with: sudo ./albion-mail-extractor.AppImage --no-sandbox\n');
    return;
  }
  
  try {
    // Import the capture module directly
    const isDev = !app.isPackaged;
    const capturePath = isDev
        ? path.join(__dirname, 'dist', 'index.js')
        : path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'index.js');
    
    const CaptureModule = require(capturePath).AlbionMailExtractor;
    
    // Create instance and redirect console.log to UI
    const originalLog = console.log;
    console.log = (...args) => {
      event.reply('log-message', args.join(' ') + '\n');
      originalLog.apply(console, args);
    };
    
    captureInstance = new CaptureModule();
    captureInstance.start();
    
  } catch (error) {
    event.reply('log-message', `❌ Failed to start: ${error.message}\n`);
    console.error(error);
  }
});

// Stop capture process
ipcMain.on('stop-capture', (event) => {
  if (captureInstance) {
    captureInstance.stop();
    captureInstance = null;
    event.reply('log-message', '⏹️ Capture stopped\n');
  }
});

ipcMain.on('get-csv', (event) => {
  if (captureInstance) {
    try {
      const csvData = captureInstance.getCSVData();
      event.reply('csv-data', csvData);
    } catch (error) {
      event.reply('log-message', `❌ Failed to generate CSV: ${error.message}\n`);
    }
  } else {
    event.reply('log-message', '⚠️ No capture running\n');
  }
});
