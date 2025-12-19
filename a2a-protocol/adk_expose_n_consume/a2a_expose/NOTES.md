# https://google.github.io/adk-docs/a2a/quickstart-exposing/

## Overview

There are two ways to expose a ADK agent via the A2A protocol:
1. `to_a2a(root_agent)` allows a ADK agent to be exposed via A2A protocol. Convinient function for ADK agents (not sure about other framework)
2. use agent card and hosting with `adk api_server --a2a`. more manual, but allows for easy debug & testing.

This quickstart focuses on the code level: `to_a2a(root_agent)`.

# Files

* `a2a_expose/agent.py` - Root Agent: A remote A2A agent proxy as root agent that talks to a remote a2a agent running on a separate server
* `a2a_expose/remote_a2a/dice_master/agent.py` - Remote Dice Master Agent: The actual agent implementation that handles dice rolling and prime number checking running on remote server

## The focus

```
This quickstart covers the most common starting point for any developer: "I have an agent. How do I expose it so that other agents can use my agent via A2A?"
```

Which in turn, shows us how to EXPOSE a ADK agent via the A2A protocol

```
Before:
                                                ┌────────────────────┐
                                                │ Dice Master Agent  │
                                                │  (Python Object)   │
                                                | without agent card │
                                                └────────────────────┘

                                                          │
                                                          │ to_a2a()
                                                          ▼

After:
┌────────────────┐                             ┌───────────────────────────────┐
│   Root Agent   │       A2A Protocol          │ A2A-Exposed Dice Master Agent │
│(RemoteA2aAgent)│────────────────────────────▶│      (localhost: 8001)        │
│(localhost:8000)│                             └───────────────────────────────┘
└────────────────┘
```

# To Run

use `uv run adk web` on the root directory, it'll read `a2a_expose` folder and read the `a2a_expose/agent.py` which contains a `RemoteA2aAgent` that will tell the web ui on how to talk to the exposed agent.

to fully utilise `uv run adk web`, the folder structure MUST follow:

```
<root-directory-name>/
├── remote_a2a/
│   └── <agent-name>/    
│       └── agent.py    # Remote Dice master Agent
├── README.md
└── agent.py            # Root agent (CANNOT CHANGE)
```
