// ── Job API ──

export type JobStatus = "queued" | "running" | "done" | "error" | "aborted";

export interface CreateJobRequest {
  prompt: string;
  model?: {
    provider: string;
    id: string;
  };
  thinkingLevel?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateJobResponse {
  jobId: string;
  status: JobStatus;
}

export interface JobEvent {
  id: number;
  event: "status" | "agentEvent" | "stateSync" | "done" | "error" | "aborted";
  data: unknown;
  createdAt: string;
}

export interface JobInfo {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  prompt: string;
  metadata?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  eventCount: number;
}

// ── Legacy-compatible model/state payloads ──

export interface ModelInfo {
  provider: string;
  id: string;
  name: string;
}

export interface SessionListItem {
  id: string;
  path: string;
  name?: string;
  cwd: string;
  created: string;
  modified: string;
  messageCount: number;
  firstMessage: string;
}

export type OutgoingMessage =
  | { type: "agentEvent"; event: any }
  | { type: "stateSync"; state: SerializedAgentState }
  | { type: "models"; models: ModelInfo[]; current?: ModelInfo; thinkingLevel?: string }
  | { type: "modelChanged"; model: ModelInfo; thinkingLevel: string }
  | { type: "error"; message: string }
  | { type: "ready" }
  | { type: "sessions"; sessions: SessionListItem[]; currentSessionId: string }
  | { type: "sessionChanged"; sessionId: string };

export interface SerializedAgentState {
  messages: any[];
  model?: ModelInfo;
  thinkingLevel: string;
  systemPrompt: string;
  isStreaming: boolean;
  streamingMessage?: any;
  errorMessage?: string;
  tools: string[];
  sessionId: string;
  sessionName?: string;
}
