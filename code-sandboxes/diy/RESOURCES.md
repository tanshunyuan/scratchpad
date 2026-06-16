# Electron Preview Panel Resources

## Knowledge

- [Electron: WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view)
  Official API for embedding and controlling web contents inside an Electron window. Use for: native preview pane architecture.
- [Electron: Security Tutorial](https://www.electronjs.org/docs/latest/tutorial/security)
  Official security guidance. Use for: safe preview defaults, isolation, avoiding Node access in untrusted preview content.
- [Node.js: child_process](https://nodejs.org/api/child_process.html)
  Official Node API for spawning dev servers and streaming logs. Use for: running `npm run dev` from Electron main process.
- [Vite: Hot Module Replacement](https://vite.dev/guide/features.html#hot-module-replacement)
  Official Vite docs for fast updates after file changes. Use for: understanding why preview updates automatically.
- [Docker: Running containers](https://docs.docker.com/engine/containers/run/)
  Official Docker docs for isolated app runtime. Use for: when local process isolation is not enough.

## Wisdom (Communities)

- [Electron Discord](https://discord.com/invite/electron)
  Good for Electron-specific architecture and security questions.
- [Electron GitHub Discussions](https://github.com/electron/electron/discussions)
  Higher-signal place for API behavior and platform edge cases.

## Gaps

- Need later resource for reverse proxies if project moves from local-only preview to remote/container preview.
