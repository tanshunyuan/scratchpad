# Run ID metadata event works

The user added a first SSE metadata event carrying the generated run ID, so UUID-based runs can be resumed by a later GET request. Future lessons can assume the server can expose both control events (`type: "run"`) and content events (`type: "delta"`) in the same stream.
