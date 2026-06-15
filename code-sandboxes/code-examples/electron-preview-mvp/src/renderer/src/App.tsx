import { useEffect, useRef, useState } from 'react'

function App(): React.JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [logs, setLogs] = useState<Array<{ type: string; text: string }>>([])
  const [status, setStatus] = useState<string>('stopped')
  const [previewUrl, setPreviewUrl] = useState('')

  useEffect(() => {
    const cleanup = window.api.onPreviewLogs((value) => {
      setLogs((currentLogs) => [...currentLogs, value])
    })
    return cleanup
  }, [])

  useEffect(() => {
    const cleanup = window.api.onPreviewStatus((value) => {
      setStatus(value)
    })
    return cleanup
  }, [])

  useEffect(() => {
    window.api.getPreviewUrl().then(setPreviewUrl)
  }, [])

  return (
    <main
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem',
        height: '100vh'
      }}
    >
      <div
        style={{
          border: '1px solid black',
          padding: '1rem'
        }}
      >
        <pre>
          {logs.map((log, index) => (
            <div key={index}>
              [{log.type}] {log.text}
            </div>
          ))}
        </pre>
      </div>
      <div style={{}}>
        <button
          onClick={async () => {
            await window.api.startPreview()
          }}
        >
          start
        </button>
        <button
          onClick={async () => {
            await window.api.stopPreview()
          }}
        >
          end
        </button>
        <button
          onClick={async () => {
            await window.api.restartPreview()
          }}
        >
          restart
        </button>
        <button
          onClick={() => {
            console.log('refresh')
            if (iframeRef.current) {
              iframeRef.current.src = iframeRef.current.src
            }
          }}
        >
          refresh
        </button>
        <p>Server Status: {status}</p>
        {previewUrl && (
          <iframe
            ref={iframeRef}
            style={{
              height: '100%',
              width: '100%',
              border: 'none'
            }}
            src={previewUrl}
            // src="http://localhost:5174"
          />
        )}
      </div>
    </main>
  )
}

export default App
