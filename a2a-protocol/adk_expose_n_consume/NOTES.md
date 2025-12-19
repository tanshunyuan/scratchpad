# Resources
* https://google.github.io/adk-docs/a2a/intro/

# https://google.github.io/adk-docs/a2a/quickstart-exposing/
* `to_a2a(root_agent)` allows a ADK agent to be exposed via A2A protocol. Convinient function for ADK agents (not sure about other framework)
* use agent card and hosting with `adk api_server --a2a`. more manual, but allows for easy debug & testing.

This quickstart focuses on `to_a2a(root_agent)`

# To run
use `uv run adk web` on the root directory, it'll read `a2a_expose` folder and read the `a2a_expose/agent.py` which contains a `RemoteA2aAgent` that will tell the web ui on how to talk to the exposed agent.
* seems like the folder structure is required seen here is required

# notes
* `a2a_expose/agent.py` - Root Agent: A remote A2A agent proxy as root agent that talks to a remote a2a agent running on a separate server
* `a2a_expose/remote_a2a/dice_master/agent.py` - Remote Dice Master Agent: The actual agent implementation that handles dice rolling and prime number checking running on remote server
