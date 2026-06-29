# Stop versus disconnect

The user implemented a stop endpoint and clarified the distinction: clearing client state alone only forgets resume data, while POSTing to `/stop` cancels server-side work. Future lessons can assume refresh/disconnect and explicit cancellation are separate concepts.
