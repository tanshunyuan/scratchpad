import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      onPreviewLogs: (callback: Function) => () => void
      onPreviewStatus: (callback: Function) => () => void
      startPreview: () => Promise<{
        previewUrl: string
        sandboxId: string
      }>
      stopPreview: () => Promise<void>
      getPreviewUrl: () => Promise<string>
      restartPreview: () => void
    }
  }
}
