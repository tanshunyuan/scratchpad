POST http://localhost:10002
{
  "jsonrpc": "2.0",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "test-123",
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "Hi"
        }
      ]
    }
  },
  "id": 1
}
