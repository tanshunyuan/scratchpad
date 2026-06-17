import { writeFileSync } from "node:fs";
import { inspect } from "node:util";

const piBaseUrl = "https://patch-bookshelf.exe.xyz";
const logPath = "experiments/mcp-result.log";

const requestBody = {
  prompt: "please tell me a joke",
} as const;

interface SseMessage {
  id?: string;
  event: string;
  data: unknown;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function writeMessages(messages: unknown[]) {
  writeFileSync(logPath, inspect(messages, { depth: null }), "utf8");
}

async function createJob(prompt: string): Promise<string> {
  const response = await fetch(`${piBaseUrl}/api/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error(`Create job failed: ${response.status} ${await response.text()}`);
  }

  const body = await response.json() as { jobId?: string };
  if (!body.jobId) {
    throw new Error(`Create job response missing jobId: ${inspect(body, { depth: null })}`);
  }

  return body.jobId;
}

async function* parseSseStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<SseMessage> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";
  let eventId: string | undefined;
  let dataLines: string[] = [];

  function emitMessage(): SseMessage | undefined {
    if (dataLines.length === 0) return undefined;

    const rawData = dataLines.join("\n");
    const message: SseMessage = {
      id: eventId,
      event: eventName,
      data: parseJson(rawData),
    };

    eventName = "message";
    eventId = undefined;
    dataLines = [];

    return message;
  }

  function readLine(line: string): SseMessage | undefined {
    if (line === "") return emitMessage();
    if (line.startsWith(":")) return undefined;

    const separatorIndex = line.indexOf(":");
    const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
    const value = separatorIndex === -1 ? "" : line.slice(separatorIndex + 1).replace(/^ /, "");

    if (field === "event") eventName = value;
    if (field === "id") eventId = value;
    if (field === "data") dataLines.push(value);

    return undefined;
  }

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex === -1) break;

      const rawLine = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
      const message = readLine(line);
      if (message) yield message;
    }
  }

  buffer += decoder.decode();
  if (buffer) {
    const message = readLine(buffer);
    if (message) yield message;
  }

  const finalMessage = emitMessage();
  if (finalMessage) yield finalMessage;
}

async function readJobEvents(jobId: string) {
  const response = await fetch(`${piBaseUrl}/api/jobs/${jobId}/events`, {
    headers: {
      Accept: "text/event-stream",
    },
  });

  if (!response.ok) {
    throw new Error(`Open job events failed: ${response.status} ${await response.text()}`);
  }

  if (!response.body) {
    throw new Error("Open job events failed: response body missing");
  }

  const messages: unknown[] = [];

  for await (const message of parseSseStream(response.body)) {
    messages.push(message);
    writeMessages(messages);

    console.log("Received", inspect(message, { depth: null }));
    console.log("Wrote result to", logPath);

    if (message.event === "done" || message.event === "error" || message.event === "aborted") {
      break;
    }
  }
}

async function main() {
  console.log("Creating Pi job at", piBaseUrl);
  console.log("Prompt", requestBody.prompt);

  const jobId = await createJob(requestBody.prompt);
  console.log("Created job", jobId);

  await readJobEvents(jobId);
  console.log("Job stream complete");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
