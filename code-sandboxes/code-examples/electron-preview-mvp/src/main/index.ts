import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process'

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

let devServerProcess: ChildProcessWithoutNullStreams | null = null

const previewPort = 5174
const previewUrl = `http://localhost:${previewPort}`

const startPreviewServer = async () => {
  if (devServerProcess) {
    console.log('dev server running')
    return
  }

  sendPreviewStatus('starting')

  devServerProcess = spawn('pnpm', ['dev', '--port', String(previewPort)], {
    cwd: join(process.cwd(), '../sample-preview-app'),
    env: process.env,
    shell: true
  })

  devServerProcess.stdout.on('data', (data) => {
    console.log(`[preview] ${data}`)
    mainWindow?.webContents.send('preview-log', {
      type: 'stdout',
      text: data.toString()
    })
  })

  devServerProcess.stderr.on('data', (data) => {
    console.error(`[preview] ${data}`)
    mainWindow?.webContents.send('preview-log', {
      type: 'stderr',
      text: data.toString()
    })
  })

  devServerProcess.on('error', (error) => {
    sendPreviewStatus('error')
    mainWindow?.webContents.send('preview-log', {
      type: 'error',
      text: error.message
    })
  })

  devServerProcess.on('exit', () => {
    sendPreviewStatus('stopped')
    devServerProcess = null
  })

  const previewProcessSnapshot = devServerProcess

  try {
    await waitForUrl(previewUrl)
    if (previewProcessSnapshot !== devServerProcess) return
    sendPreviewStatus('running')
  } catch (error) {
    if (previewProcessSnapshot !== devServerProcess) return
    sendPreviewStatus('error')
    mainWindow?.webContents.send('preview-log', {
      type: 'error',
      text: error instanceof Error ? error.message : String(error)
    })
  }
}

const stopPreviewServer = async () => {
  if (!devServerProcess) {
    console.log('nothing to stop')
    return
  }
  sendPreviewStatus('stopping')
  const processToStopSnapshot = devServerProcess

  await new Promise<void>((resolve) => {
    // this is just to register
    processToStopSnapshot.once('exit', () => resolve())

    const signalSent = processToStopSnapshot.kill('SIGTERM')
    if (!signalSent) resolve()
  })
}

const restartPreviewServer = async () => {
  await stopPreviewServer()
  await startPreviewServer()
}

const waitForUrl = async (url: string, timeoutMs = 15000) => {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch (err) {
      // Server not ready yet.
      // console.log(err)
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(`Timed out waiting for ${url}`)
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
  await startPreviewServer()
  return { ok: true }
})

ipcMain.handle('preview-stop', async () => {
  await stopPreviewServer()
  return { ok: true }
})

ipcMain.handle('preview-get-url', () => {
  return previewUrl
})

ipcMain.handle('preview-restart', async () => {
  await restartPreviewServer()
  return { ok: true }
})
