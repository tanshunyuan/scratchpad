POST http://localhost:10001
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
          "text": "What is the weather like in fort wayne, ohio?"
        }
      ]
    }
  },
  "id": 1
}

# POST http://localhost:10001
# {
#   "jsonrpc": "2.0",
#   "method": "message/send",
#   "params": {
#     "message": {
#       "messageId": "test-123",
#       "role": "user",
#       "parts": [
#         {
#           "type": "text",
#           "text": "hi"
#         }
#       ]
#     }
#   },
#   "id": 1
# }
