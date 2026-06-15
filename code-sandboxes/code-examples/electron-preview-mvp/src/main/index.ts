import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

let mainWindow: null | BrowserWindow = null

function createWindow(): void {
  if (mainWindow) {
    console.log('not recreating')
    return
  }
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

let previewStatus = 'stopped'

const sendPreviewStatus = (status: string) => {
  previewStatus = status
  mainWindow?.webContents.send('preview-status', previewStatus)
}

const SERVER_URL = 'http://localhost:8086'

let previewUrl = ''
let sandboxId = ''

const startPreviewServer = async () => {
  sendPreviewStatus('starting')

  const response = await fetch(`${SERVER_URL}/sandboxes/start`, {
    method: 'POST'
  })

  if (!response.ok) {
    sendPreviewStatus('error')
    throw new Error('Something went wrong starting the server')
  }

  const result = (await response.json()) as {
    previewUrl: string
    sandboxId: string
  }

  previewUrl = result.previewUrl
  sandboxId = result.sandboxId
  sendPreviewStatus('running')

  return result
}

const stopPreviewServer = async () => {
  if (!sandboxId) {
    sendPreviewStatus('stopped')
    return
  }

  sendPreviewStatus('stopping')

  const response = await fetch(`${SERVER_URL}/sandboxes/${sandboxId}/stop`, {
    method: 'POST'
  })

  if (!response.ok) {
    sendPreviewStatus('error')
    throw new Error('Something went wrong stopping the server')
  }

  sandboxId = ''
  previewUrl = ''
  sendPreviewStatus('stopped')
}

const restartPreviewServer = async () => {
  await stopPreviewServer()
  return await startPreviewServer()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  stopPreviewServer()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

ipcMain.handle('preview-start', async () => {
  return await startPreviewServer()
})

ipcMain.handle('preview-stop', async () => {
  await stopPreviewServer()
  return { ok: true }
})

ipcMain.handle('preview-get-url', () => {
  return previewUrl
})

ipcMain.handle('preview-restart', async () => {
  return await restartPreviewServer()
})
