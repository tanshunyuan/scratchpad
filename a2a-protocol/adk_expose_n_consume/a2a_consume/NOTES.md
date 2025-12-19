# https://google.github.io/adk-docs/a2a/quickstart-consuming/

# The focus

This is for
```
"There is a remote agent, how do I let my ADK agent use it via A2A?"
```

Which in turn, shows us how to CONSUME an agent EXPOSED on the A2A protocol

```
┌────────────────────┐
│   a2a_consume      │
└────────────────────┘
             │
             ▼
    ┌─────────────────┐
    │   Root Agent    │
    │     (local)     │
    └─────────────────┘
      ┌─────┴─────┐
      │           │
      ▼           ▼
┌──────────────┐ ┌────────────────────┐
│  Roll Agent  │ │    Prime Agent     │
│   (local)    │ │     (remote)       │
└──────────────┘ └────────────────────┘
```

# To Run

use `uv run adk web` on the root directory, it'll read `a2a_consume` folder and read the `a2a_consume/agent.py` which contains a `RemoteA2aAgent` that will tell the web ui on how to talk to the exposed agent.

to fully utilise `uv run adk web`, the folder structure MUST follow:

```
<root-directory-name>/
├── remote_a2a/ # Cannot change
│   └── <agent-name>/    
│       ├── agent.json
│       └── agent.py    # Remote Hello World Agent
├── README.md
└── agent.py            # Root agent (CANNOT CHANGE)
```
