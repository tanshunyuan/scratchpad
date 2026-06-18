import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { env } from "../env";
import { axiosInstance } from "../lib/axios";

export const Route = createFileRoute("/")({
  component: Index,
});

type DesignSystemGeneration = {
  id: string;
  projectId: string;
  createdAt: string;
  result: GenerateDesignSystemResult;
  logs?: string[];
};

type GenerateDesignSystemResult = {
  designSystemText: string;
  penpot: {
    fileId: string;
    boardId: string;
    boardName: string;
    boardUrl?: string;
  };
  preview?: {
    imageUrl?: string;
    imageBase64?: string;
    mimeType: "image/png";
  };
};

function Index() {
  const [result, setResult] = useState<GenerateDesignSystemResult | null>(null);
  const [generations, setGenerations] = useState<DesignSystemGeneration[]>([]);
  const [currentLogs, setCurrentLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    void loadGenerations();
  }, []);

  async function loadGenerations() {
    const response = await axiosInstance.get<{
      generations: DesignSystemGeneration[];
    }>("/api/design-system/generations");

    setGenerations(response.data.generations);
  }

  function generateDesignSystem() {
    if (isGenerating) {
      return;
    }

    setIsGenerating(true);
    setResult(null);
    setError(null);
    setCurrentLogs(["connecting to generation stream"]);

    const streamUrl = new URL(
      "/api/design-system/generate/stream",
      env.VITE_SERVER_URL,
    );
    streamUrl.searchParams.set("projectId", "demo-project");

    const source = new EventSource(streamUrl.toString());
    let receivedTerminalEvent = false;

    source.addEventListener("progress", (event) => {
      const data = JSON.parse(event.data) as { message?: string };

      const message = data.message;

      if (!message) {
        return;
      }

      setCurrentLogs((logs) => [...logs, message]);
    });

    source.addEventListener("result", (event) => {
      receivedTerminalEvent = true;
      const data = JSON.parse(event.data) as {
        generation: DesignSystemGeneration;
      };

      setResult(data.generation.result);
      setGenerations((currentGenerations) => [
        data.generation,
        ...currentGenerations,
      ]);
      setCurrentLogs([]);
      setIsGenerating(false);
      source.close();
    });

    source.addEventListener("failed", (event) => {
      receivedTerminalEvent = true;
      const data = JSON.parse(event.data) as { error?: string };

      setError(data.error ?? "Generation failed");
      setCurrentLogs((logs) => [...logs, "failed"]);
      setIsGenerating(false);
      source.close();
    });

    source.onerror = () => {
      if (receivedTerminalEvent) {
        return;
      }

      setError("Generation stream disconnected");
      setCurrentLogs((logs) => [...logs, "stream disconnected"]);
      setIsGenerating(false);
      source.close();
    };
  }

  return (
    <main className="min-h-screen w-full bg-slate-50 p-6 text-slate-950">
      <section className="mx-auto flex max-w-5xl flex-col gap-6">
        <header>
          <p className="text-sm font-medium text-slate-500">Tracer Bullet</p>
          <h1 className="text-3xl font-semibold">Design Step</h1>
        </header>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Generate design system</h2>
              <p className="text-sm text-slate-500">
                Streams Flue progress while Penpot board export runs.
              </p>
            </div>
            <Button onClick={generateDesignSystem} disabled={isGenerating}>
              {isGenerating ? "Generating..." : "Generate"}
            </Button>
          </div>
          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        </section>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Run logs</h2>

          {currentLogs.length > 0 ? (
            <RunLogCard
              title="Current run"
              logs={currentLogs}
              result={result}
              isActive={isGenerating}
            />
          ) : null}

          {generations.length === 0 && currentLogs.length === 0 ? (
            <p className="text-slate-500">No runs yet.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              {generations.map((generation) => (
                <RunLogCard
                  key={generation.id}
                  title={generation.result.penpot.boardName}
                  createdAt={generation.createdAt}
                  logs={generation.logs ?? ["No streamed logs saved for this run."]}
                  result={generation.result}
                />
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function RunLogCard(input: {
  title: string;
  createdAt?: string;
  logs: string[];
  result: GenerateDesignSystemResult | null;
  isActive?: boolean;
}) {
  const previewSrc = getPreviewSrc(input.result);

  return (
    <article className="rounded-lg border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{input.title}</h3>
            {input.isActive ? (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                running
              </span>
            ) : null}
          </div>
          {input.createdAt ? (
            <p className="text-sm text-slate-500">
              {new Date(input.createdAt).toLocaleString()}
            </p>
          ) : null}
        </div>

        {previewSrc ? (
          <img
            className="h-24 w-36 rounded-md border object-cover"
            src={previewSrc}
            alt="Penpot board preview"
          />
        ) : null}
      </div>

      {input.result ? (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-slate-500">Board</dt>
            <dd>{input.result.penpot.boardName}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Board ID</dt>
            <dd className="break-all">{input.result.penpot.boardId}</dd>
          </div>
        </dl>
      ) : null}

      <ol className="mt-4 space-y-2 text-sm text-slate-700">
        {input.logs.map((log, index) => (
          <li className="rounded-md bg-slate-50 px-3 py-2" key={`${log}-${index}`}>
            {log}
          </li>
        ))}
      </ol>
    </article>
  );
}

function getPreviewSrc(result: GenerateDesignSystemResult | null) {
  if (!result?.preview) {
    return undefined;
  }

  if (result.preview.imageUrl) {
    return result.preview.imageUrl;
  }

  if (result.preview.imageBase64) {
    return `data:${result.preview.mimeType};base64,${result.preview.imageBase64}`;
  }

  return undefined;
}
