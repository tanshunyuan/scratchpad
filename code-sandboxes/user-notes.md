# User Notes

- use `node.child_process.spawn` to spawn a process LOL. It returns this stream `ChildProcessWithoutNullStreams`
- the process have a few parts: `stdout`, `stdin`, `stderr` (these three are data related), `on` (this is the life cycle listener to to the process, e.g. `start`, `exit` and so on)
- SIGTERM sents a signal to gracefully kill a process, unlike SIGTERM which terminates immediately
- functions like `.on` and etc are event handlers, they are REGISTERED when the system boots, and ran when certain event are triggered
- this is the flow for restart:
→ await stopPreviewServer()
→ wait exit
→ startPreviewServer()
→ wait URL
→ running
- we need to be clear on how processes for a few states like: start, stop, restart. and figure out what are them for other programs in the future
