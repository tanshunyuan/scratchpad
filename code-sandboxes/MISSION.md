# Mission: Add a Preview Panel to an Electron Coding App

## Why
Build enough understanding to add a right-side live preview panel to an existing Electron coding app, without building a full Lovable/Replit clone.

## Success looks like
- Explain how editor/agent file changes, runtime, preview panel, logs, and env variables fit together.
- Ship a simple local preview using Electron, Node, React, and a dev server.
- Extend the preview runner so Electron can start a Dockerized dev server and show it in the iframe.
- Use local Docker as a conceptual bridge toward sandboxed runtimes, not as the final security/product boundary.
- Understand Docker sandboxing: isolated work dirs, bind mounts, port mapping, logs, process/container cleanup, and trust boundaries.
- Prioritize the remote sandbox preview experience: send workspace/code to remote runtime, stream logs back, and show a remote preview URL in the iframe.

## Constraints
- Keep stack simple: Electron, Node, React, Docker only when useful.
- Prefer readable implementation over clever abstractions.
- Focus on preview panel + infra model, not full cloud IDE product.

## Out of scope
- Building a Lovable/Replit clone.
- Multi-user cloud workspaces, billing, collaboration, or AI agent orchestration for now.
- Building full production remote sandbox infra now: multi-tenant security hardening, billing, collaboration, and large-scale orchestration.
