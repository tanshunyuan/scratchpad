# https://a2a-protocol.org/latest/tutorials/python/3-agent-skills-and-card/
`server/main.py` defines the agent server that is running on port 9000
`client.py` is just a simple code client that interacts with the agent running

===

`AgentSkill` is a indepth explaination of what the agent can do
`AgentCard` is brief overview of a few things such as what is the agent name, a short description of what it can do, what is the expected input or output and which port is it running of

===

To interact with the server through the client, we need to setup the server first by running:

```py
uv run server/main.py
```

The sever is running, to use the client we just do:

```py
uv run client.py
```

we should see

```bash
INFO:httpx:HTTP Request: GET http://localhost:9999/.well-known/agent-card.json "HTTP/1.1 200 OK"
INFO:a2a.client.card_resolver:Successfully fetched agent card data from http://localhost:9999/.well-known/agent-card.json: {'capabilities': {'streaming': True}, 'defaultInputModes': ['text'], 'defaultOutputModes': ['text'], 'description': 'Just a hello world agent', 'name': 'Hello World Agent', 'preferredTransport': 'JSONRPC', 'protocolVersion': '0.3.0', 'skills': [{'description': 'just returns hello world', 'examples': ['hi', 'hello world'], 'id': 'hello_world', 'name': 'Returns hello world', 'tags': ['hello world']}], 'supportsAuthenticatedExtendedCard': False, 'url': 'http://localhost:9999/', 'version': '1.0.0'}
/hello-world/client.py:23: DeprecationWarning: A2AClient is deprecated and will be removed in a future version. Use ClientFactory to create a client with a JSON-RPC transport.
  client = A2AClient(httpx_client=httpx_client, agent_card=agent_card)
INFO:__main__:A2AClient initialized
INFO:httpx:HTTP Request: POST http://localhost:9999/ "HTTP/1.1 200 OK"
{'id': 'c3bcb4e8-2e10-4495-b53d-ffee92f4acce', 'jsonrpc': '2.0', 'result': {'kind': 'message', 'messageId': '02192c42-f9f1-444c-b63d-1a2e5ca1ed49', 'parts': [{'kind': 'text', 'text': 'Hello World'}], 'role': 'agent'}}
```
