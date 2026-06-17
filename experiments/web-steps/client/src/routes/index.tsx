import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { axiosInstance } from "../lib/axios";

export const Route = createFileRoute("/")({
  component: Index,
});

type DesignSystemGeneration = {
  id: string;
  projectId: string;
  createdAt: string;
  result: GenerateDesignSystemResult;
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

const runningStatusLog = [
  "loading PRD + UL",
  "generating design system",
  "creating Penpot board",
  "exporting preview",
];

function Index() {
  const [result, setResult] = useState<GenerateDesignSystemResult | null>(null);
  const [generations, setGenerations] = useState<DesignSystemGeneration[]>([]);
  const [statusLog, setStatusLog] = useState<string[]>([]);
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

  async function generateDesignSystem() {
    setIsGenerating(true);
    setResult(null);
    setError(null);
    setStatusLog(runningStatusLog);

    try {
      const response = await axiosInstance.post<DesignSystemGeneration>(
        "/api/design-system/generate",
        { projectId: "demo-project" },
      );

      setResult(response.data.result);
      setGenerations((currentGenerations) => [
        response.data,
        ...currentGenerations,
      ]);
      setStatusLog([...runningStatusLog, "done"]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to generate design system",
      );
      setStatusLog([...runningStatusLog, "failed"]);
    } finally {
      setIsGenerating(false);
    }
  }

  const previewSrc = result?.preview?.imageUrl
    ? result.preview.imageUrl
    : result?.preview?.imageBase64
      ? `data:${result.preview.mimeType};base64,${result.preview.imageBase64}`
      : undefined;

  return (
    <main className="min-h-screen w-full bg-slate-50 p-6 text-slate-950">
      <section className="mx-auto flex max-w-5xl flex-col gap-6">
        <header>
          <p className="text-sm font-medium text-slate-500">Tracer Bullet</p>
          <h1 className="text-3xl font-semibold">Design Step</h1>
        </header>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <Button onClick={generateDesignSystem} disabled={isGenerating}>
            {isGenerating ? "Generating..." : "Generate Design System"}
          </Button>
        </div>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold">Saved generations</h2>
          {generations.length === 0 ? (
            <p className="text-slate-500">No saved generations yet.</p>
          ) : (
            <ul className="space-y-3">
              {generations.map((generation) => (
                <li
                  className="flex items-center justify-between gap-4 rounded-lg border p-3"
                  key={generation.id}
                >
                  <div>
                    <p className="font-medium">
                      {generation.result.penpot.boardName}
                    </p>
                    <p className="text-sm text-slate-500">
                      {new Date(generation.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setResult(generation.result)}
                  >
                    View
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold">Status log</h2>
          {statusLog.length === 0 ? (
            <p className="text-slate-500">No run yet.</p>
          ) : (
            <ul className="space-y-2">
              {statusLog.map((status) => (
                <li key={status}>- {status}</li>
              ))}
            </ul>
          )}
          {error ? <p className="mt-4 text-red-600">{error}</p> : null}
        </section>

        {result ? (
          <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-xl font-semibold">
                1. Generated design-system text
              </h2>
              <pre className="whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-sm text-slate-50">
                {result.designSystemText}
              </pre>
            </div>

            <aside className="flex flex-col gap-6">
              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-xl font-semibold">2. Penpot info</h2>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="font-medium text-slate-500">File ID</dt>
                    <dd>{result.penpot.fileId}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Board ID</dt>
                    <dd>{result.penpot.boardId}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Board name</dt>
                    <dd>{result.penpot.boardName}</dd>
                  </div>
                  {result.penpot.boardUrl ? (
                    <div>
                      <dt className="font-medium text-slate-500">Board URL</dt>
                      <dd>
                        <a href={result.penpot.boardUrl}>{result.penpot.boardUrl}</a>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-xl font-semibold">3. Preview image</h2>
                {previewSrc ? (
                  <img
                    className="w-full rounded-lg border"
                    src={previewSrc}
                    alt="Penpot board preview"
                  />
                ) : (
                  <p>No preview returned.</p>
                )}
              </div>
            </aside>
          </section>
        ) : null}
      </section>
    </main>
  );
}
