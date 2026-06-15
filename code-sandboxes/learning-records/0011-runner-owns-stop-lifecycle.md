# Runner owns stop lifecycle

User implemented `POST /sandboxes/:id/stop` in the runner service, moving stop responsibility from Electron into the runner boundary. Future Electron code should call the runner API and not directly manage Docker/process shutdown.
