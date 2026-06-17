import { writeFileSync } from "node:fs";
import { inspect } from "node:util";

const wsUrl = "wss://patch-bookshelf.exe.xyz/api/ws";
const logPath = "experiments/mcp-result.log";

const requestBody = {
  type: "prompt",
  text: "please tell me a joke",
} as const;

async function websocketDataToString(data: unknown): Promise<string> {
  if (typeof data === "string") {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8");
  }

  if (data instanceof Blob) {
    return Buffer.from(await data.arrayBuffer()).toString("utf8");
  }

  if (Buffer.isBuffer(data)) {
    return data.toString("utf8");
  }

  return String(data);
}

function parseMessage(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function writeMessages(messages: unknown[]) {
  writeFileSync(logPath, inspect(messages, { depth: null }), "utf8");
}

function openPromptWs(text: string) {
  const ws = new WebSocket(wsUrl);
  const messages: unknown[] = [];

  ws.addEventListener("open", () => {
    console.log("WebSocket open");

    ws.send(
      JSON.stringify({
        type: "prompt",
        text,
      }),
    );

    console.log("Sent", requestBody);
  });

  ws.addEventListener("message", (event) => {
    void websocketDataToString(event.data)
      .then((raw) => {
        const message = parseMessage(raw);
        messages.push(message);
        writeMessages(messages);

        console.log("Received", inspect(message, { depth: null }));
        console.log("Wrote result to", logPath);
      })
      .catch((error: unknown) => {
        console.error("Failed to read WebSocket message", error);
      });
  });

  ws.addEventListener("close", (event) => {
    console.log("WebSocket closed", {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
    });
  });

  ws.addEventListener("error", () => {
    console.error("WebSocket error");
  });

  return ws;
}

console.log("Connecting to", wsUrl);
const ws = openPromptWs(requestBody.text);

function shutdown() {
  console.log("Closing WebSocket");
  ws.close();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
