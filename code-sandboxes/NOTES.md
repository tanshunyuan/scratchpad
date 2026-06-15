# Notes

- User wants to add preview panel to own Electron coding app, not build Lovable/Replit clone.
- Preferred simple stack: Electron, Node, React, Docker only when needed.
- Teaching should include infra understanding but stay MVP-oriented.
- Ignore semantic polish for now: env vars, preload typecheck cleanup, etc.
- Do not prioritize project picker. Real app already has selected workspace and can auto-detect preview project config.
- Keep iframe preview for now. Future app may not stay Electron-only, so avoid Electron-specific preview surface as core assumption.
