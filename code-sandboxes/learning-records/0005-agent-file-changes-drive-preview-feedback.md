# Agent file changes drive preview feedback

User confirmed that editing `sample-preview-app/src/App.tsx` triggers Vite hot reload in the iframe, shows errors when code is broken, and recovers after the file is fixed and saved. Future lessons can assume the file-watch/HMR feedback loop works; no custom refresh mechanism is needed for normal agent edits.
