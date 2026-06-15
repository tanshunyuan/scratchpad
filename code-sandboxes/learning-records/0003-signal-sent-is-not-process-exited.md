# Signal sent is not process exited

User now understands that `childProcess.kill('SIGTERM')` returning `true` only means the signal was sent, not that the process has died. Preview restart logic should wait for the child process `exit` event before starting a new server, otherwise the old process may still hold the port.
