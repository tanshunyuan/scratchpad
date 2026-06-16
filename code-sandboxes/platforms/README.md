try out different platform
* exe.dev
* rivet (https://rivet.dev/agent-os/)

# Use Case: Server Communicating With Remote Pi Coding Agent

We have traditional client/server architecture.

User enters content in browser. Browser sends request to backend server. Backend server needs remote Pi coding agent to generate content. Pi coding agent should return generated string response. Server then sends response back to browser.

Main question:

## How should backend server communicate with remote Pi coding agent and receive responses back?

Need figure out practical server-to-Pi communication design. Pi agent may live remotely from backend server. It may not be directly reachable from public internet. Design should explain how request reaches Pi agent and how generated response returns to server.

## Current Known Requirements

- Browser submits content to server
- Server sends request to remote Pi coding agent
- Pi coding agent generates string response
- Pi coding agent response gets back to server
- Server sends response back to browser
- Exact server-to-Pi communication method is undecided

## High-Level Flow

Browser sends content request to server.

Server sends request to remote Pi coding agent.

Pi coding agent generates string response.

Pi coding agent sends response back to server.

Server sends response back to browser.

## References / Docs To Research

Paste relevant docs here:

- Pi coding agent docs:
  - [paste link or notes]

- Server framework docs:
  - [paste link or notes]

- Deployment/networking docs:
  - [paste link or notes]

- Networking / remote communication docs:
  - [paste link or notes]
