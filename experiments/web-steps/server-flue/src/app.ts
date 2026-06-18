import { observe } from '@flue/runtime';
import { flue } from '@flue/runtime/routing';
import { Hono } from 'hono';

const MAX_LOG_CHARS = 2_000;

observe((event) => {
  const prefix = `[flue:${event.type}]`;

  switch (event.type) {
    case 'run_start':
      console.info(prefix, {
        runId: event.runId,
        workflowName: event.workflowName,
        payload: redact(event.payload),
      });
      break;

    case 'operation_start':
      console.info(prefix, {
        runId: event.runId,
        harness: event.harness,
        session: event.session,
        operationId: event.operationId,
        operationKind: event.operationKind,
      });
      break;

    case 'turn_request':
      console.info(prefix, {
        runId: event.runId,
        harness: event.harness,
        session: event.session,
        turnId: event.turnId,
        model: event.model,
        provider: event.provider,
        tools: event.input.tools?.map((tool) => tool.name),
        lastMessage: getLastMessageText(event.input.messages),
      });
      break;

    case 'tool_start':
      console.info(prefix, {
        runId: event.runId,
        harness: event.harness,
        session: event.session,
        toolName: event.toolName,
        toolCallId: event.toolCallId,
        args: redact(event.args),
      });
      break;

    case 'tool':
      console.info(prefix, {
        runId: event.runId,
        harness: event.harness,
        session: event.session,
        toolName: event.toolName,
        toolCallId: event.toolCallId,
        durationMs: event.durationMs,
        isError: event.isError,
        result: redact(event.result),
      });
      break;

    case 'message_end':
      console.info(prefix, {
        runId: event.runId,
        harness: event.harness,
        session: event.session,
        turnId: event.turnId,
        message: redact(event.message),
      });
      break;

    case 'turn':
      console.info(prefix, {
        runId: event.runId,
        harness: event.harness,
        session: event.session,
        turnId: event.turnId,
        model: event.model,
        provider: event.provider,
        durationMs: event.durationMs,
        stopReason: event.stopReason,
        isError: event.isError,
        usage: event.usage,
        error: redact(event.error),
      });
      break;

    case 'operation':
      console.info(prefix, {
        runId: event.runId,
        harness: event.harness,
        session: event.session,
        operationId: event.operationId,
        operationKind: event.operationKind,
        durationMs: event.durationMs,
        isError: event.isError,
        usage: event.usage,
        error: redact(event.error),
        result: redact(event.result),
      });
      break;

    case 'run_end':
      console.info(prefix, {
        runId: event.runId,
        durationMs: event.durationMs,
        isError: event.isError,
        error: redact(event.error),
        result: redact(event.result),
      });
      break;

    case 'log':
      console[event.level](prefix, event.message, redact(event.attributes));
      break;

    default:
      console.debug(prefix, {
        runId: event.runId,
        harness: event.harness,
        session: event.session,
      });
  }
});

function getLastMessageText(messages: unknown[]) {
  const lastMessage = messages.at(-1);

  if (!isRecord(lastMessage)) {
    return undefined;
  }

  const content = lastMessage.content;

  if (typeof content === 'string') {
    return truncate(content);
  }

  if (!Array.isArray(content)) {
    return undefined;
  }

  return truncate(
    content
      .map((part) => {
        if (!isRecord(part)) {
          return undefined;
        }

        if (typeof part.text === 'string') {
          return part.text;
        }

        if (typeof part.type === 'string') {
          return `[${part.type}]`;
        }

        return undefined;
      })
      .filter(Boolean)
      .join('\n'),
  );
}

function redact(value: unknown): unknown {
  if (typeof value === 'string') {
    return truncate(value);
  }

  if (Array.isArray(value)) {
    return value.map(redact);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => {
      if (shouldRedactKey(key) && typeof child === 'string') {
        return [key, `[omitted ${child.length} chars]`];
      }

      return [key, redact(child)];
    }),
  );
}

function shouldRedactKey(key: string) {
  return ['base64', 'data', 'imageUrl'].includes(key);
}

function truncate(value: string) {
  if (value.length <= MAX_LOG_CHARS) {
    return value;
  }

  return `${value.slice(0, MAX_LOG_CHARS)}... [truncated ${value.length - MAX_LOG_CHARS} chars]`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const app = new Hono();

app.get('/health', (c) => c.json({ ok: true }));

app.route('/', flue());

export default app;
