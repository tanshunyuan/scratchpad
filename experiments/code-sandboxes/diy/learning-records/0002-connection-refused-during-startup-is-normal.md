# Connection refused during startup is normal

User observed `ECONNREFUSED` while polling the preview URL before Vite finished starting. This is now understood as an expected intermediate state during readiness checks, not a real failure unless polling times out.
