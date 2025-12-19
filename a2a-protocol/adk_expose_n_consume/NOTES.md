to fully utilise `uv run adk web`, the folder structure MUST follow:

```
<root-directory-name>/
├── remote_a2a/ # Cannot change
│   └── <agent-name>/    
│       ├── agent.json
│       └── agent.py    
├── README.md
└── agent.py            # Root agent (CANNOT CHANGE)
```

OR

```
<root-directory-name>/
├── remote_a2a/ # Cannot change
│   └── <agent-name>/    
│       └── agent.py    
├── README.md
└── agent.py            # Root agent (CANNOT CHANGE)
```

Importantly, under `remote_a2a` folder it we can have more than one agent like so:
```
<root-directory-name>/
├── remote_a2a/ # Cannot change
│   └── <agent-name>/    
│       └── agent.py    
│   └── <agent-name>/    
│       ├── agent.json
│       └── agent.py    
├── README.md
└── agent.py            # Root agent (CANNOT CHANGE)
```

To interact with the remote agents we must look at the `a2a_consume` example where we can define more than one `RemoteA2aAgent` and attach it to a `root_agent`

```py
prime_agent = RemoteA2aAgent(
    name="check_prime_agent",
    description="Agent that handles checking if numbers are prime.",
    agent_card=(
        f"http://localhost:8001/a2a/check_prime_agent{AGENT_CARD_WELL_KNOWN_PATH}"
    ),
)

dice_agent = RemoteA2aAgent(
    name="roll_dice_agent",
    description="Agent that rolls dice",
    agent_card=(
        f"http://localhost:8002/a2a/roll_dice_agent{AGENT_CARD_WELL_KNOWN_PATH}"
    ),
)

root_agent = Agent(
    ...
    name="root_agent",
    sub_agents=[dice_agent, prime_agent],
    ...
)
```
