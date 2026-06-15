import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { ipcRenderer } from 'electron/renderer'

// Custom APIs for renderer
const api = {
  onPreviewLogs: (callback: Function) => {
    const handler = (event, value) => callback(value)
    ipcRenderer.on('preview-log', handler)

    return () => {
      ipcRenderer.removeListener('preview-log', handler)
    }
  },
  onPreviewStatus: (callback: Function) => {
    const handler = (event, value) => callback(value)
    ipcRenderer.on('preview-status', handler)

    return () => {
      ipcRenderer.removeListener('preview-status', handler)
    }
  },

  startPreview: () => {
    return ipcRenderer.invoke('preview-start')
  },
  stopPreview: () => {
    return ipcRenderer.invoke('preview-stop')
  },
  getPreviewUrl: () => {
    return ipcRenderer.invoke('preview-get-url')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
