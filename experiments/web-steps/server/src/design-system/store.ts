import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { JSONFilePreset } from "lowdb/node";
import type {
  GenerateDesignSystemInput,
  GenerateDesignSystemResult,
} from "./types.js";

type DesignSystemGeneration = {
  id: string;
  projectId: string;
  createdAt: string;
  result: GenerateDesignSystemResult;
  logs?: string[];
};

type DesignSystemDb = {
  generations: DesignSystemGeneration[];
};

const dataDirectory = path.join(process.cwd(), "data");
const dbFilePath = path.join(dataDirectory, "design-systems.json");
const defaultData: DesignSystemDb = { generations: [] };

mkdirSync(dataDirectory, { recursive: true });

const db = await JSONFilePreset<DesignSystemDb>(dbFilePath, defaultData);

export async function saveDesignSystemGeneration(input: {
  id?: string;
  request: GenerateDesignSystemInput;
  result: GenerateDesignSystemResult;
  logs?: string[];
}) {
  const generation: DesignSystemGeneration = {
    id: input.id ?? randomUUID(),
    projectId: input.request.projectId,
    createdAt: new Date().toISOString(),
    result: input.result,
    logs: input.logs,
  };

  await db.update(({ generations }) => {
    generations.unshift(generation);
  });

  return generation;
}

export async function listDesignSystemGenerations() {
  return db.data.generations;
}
