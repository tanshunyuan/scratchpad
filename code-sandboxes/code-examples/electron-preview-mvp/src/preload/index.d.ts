import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      onPreviewLogs: (callback: Function) => () => void
      onPreviewStatus: (callback: Function) => () => void
      startPreview: () => void
      stopPreview: () => void
      getPreviewUrl: () => Promise<string>
    }
  }
}
