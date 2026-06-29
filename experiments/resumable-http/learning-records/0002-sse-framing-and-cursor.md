# SSE framing and cursor placement

The user correctly explained that a blank line (`\n\n`) terminates one SSE event, and that the resume cursor is tracked by the client. Future lessons can assume SSE field/event framing is understood, but should reinforce that catch-up requires a server-side event log.
