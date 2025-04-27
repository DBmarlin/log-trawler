import { app, BrowserWindow, ipcMain, protocol, session } from 'electron'; // Ensure session is imported
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// Register the app protocol as a standard, secure scheme before app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

// Get the directory name in an ES module context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  console.log('[LogTrawler] Entering createWindow function...'); // Add log
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 768,
    icon: path.join(__dirname, '..', 'public', 'LogTrawler-MacOS-AppIcon.png'),
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hidden',
    titleBarOverlay: true,
    vibrancy: 'under-window',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
      sandbox: false,
      nodeIntegrationInWorker: true
    },
  });

  // Check if in development (not packaged) and if the Vite dev server URL is set
  if (!app.isPackaged && process.env.VITE_DEV_SERVER_URL) {
    console.log(`[LogTrawler] Development mode detected. Loading URL: ${process.env.VITE_DEV_SERVER_URL}`);
    // Development: Load from Vite dev server
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // Optional: Open DevTools automatically in development
    // mainWindow.webContents.openDevTools();
  } else {
    console.log('[LogTrawler] Production mode detected. Loading URL: app://./index.html');
    // Production: Load the index.html file using the custom 'app://' protocol
    mainWindow.loadURL('app://./index.html'); // Use the custom protocol
    // mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Only open DevTools in development mode
  if (!app.isPackaged) {
    console.log('[LogTrawler] Development mode: Opening DevTools...'); // Add log
    mainWindow.webContents.openDevTools();
    console.log('[LogTrawler] After opening DevTools.'); // Add log
  }
}

console.log('[LogTrawler] Before app.whenReady()'); // Add log
app.whenReady().then(() => {
  console.log('[LogTrawler] app.whenReady() resolved.'); // Add log

  // Set a more permissive Content Security Policy for the default session
  // This is often necessary for loading local resources in packaged apps.
  // Adjust as needed for security. 'unsafe-inline' and 'unsafe-eval' might be
  // required by some frameworks/libraries but reduce security.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        // Allow everything from 'self' (app:// protocol) - VERY permissive, use with caution
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval';" +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval';" +
          "style-src 'self' 'unsafe-inline';" +
          "img-src 'self' data: app: https:;" +
          "font-src 'self' data:;" +
          "connect-src 'self' app: https: http:;"
        ]
      }
    });
  });
  console.log('[LogTrawler] Set Content-Security-Policy.'); // Add log

  // Register custom protocol to serve files from dist/ or app.asar/dist
  protocol.handle('app', async (request) => {
    try {
      let url = request.url.substr(6); // strip 'app://'
      if (url.startsWith('/')) url = url.slice(1); // Remove leading slash if present

      const appPath = app.getAppPath();
      console.log(`[protocol] app.getAppPath(): ${appPath}`);

      // Log the contents of the 'dist' directory
      try {
        const distPath = path.join(appPath, 'dist');
        console.log(`[protocol] Contents of dist directory: ${fs.readdirSync(distPath)}`);
      } catch (error) {
        console.error(`[protocol] Error reading dist directory: ${error}`);
      }

      // Construct path to the file within the app.asar archive
      const filePath = path.join(appPath, 'dist', url);
      console.log(`[protocol] Request: ${request.url} -> Resolved Path: ${filePath}`);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`[protocol] File not found: ${filePath}`);
        return new Response('File not found', { status: 404 });
      }

      // Determine MIME type
      const mimeTypes: { [key: string]: string } = {
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.css': 'text/css',
        '.html': 'text/html',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.json': 'application/json',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.eot': 'application/vnd.ms-fontobject'
      };

      const ext = path.extname(url).toLowerCase();
      const mimeType = mimeTypes[ext] || 'application/octet-stream';
      console.log(`[protocol] Serving ${url} as ${mimeType}`);

      // Read file as buffer
      const buffer = await fs.promises.readFile(filePath);
      
      // Create and return response with appropriate headers
      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': buffer.length.toString(),
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error('[protocol] Error serving file:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  });
  console.log('[LogTrawler] Registered app:// protocol.'); // Add log

  console.log('[LogTrawler] Before calling createWindow()'); // Add log
  createWindow();

  app.on('activate', () => {
    console.log('[LogTrawler] app activate event triggered.'); // Add log
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  console.log('[LogTrawler] window-all-closed event triggered.'); // Add log
  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Optional: Add error handling for the main process
process.on('uncaughtException', (error) => {
  console.error('[LogTrawler] Uncaught Main Process Exception:', error);
});
