import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { Low } from "lowdb";
import { JSONFilePreset } from "lowdb/node";
import { logDesignSystem } from "./log.js";
import type {
  GenerateDesignSystemInput,
  GenerateDesignSystemResult,
} from "./types.js";

type DesignSystemGeneration = {
  id: string;
  projectId: string;
  createdAt: string;
  result: GenerateDesignSystemResult;
};

type DesignSystemDb = {
  generations: DesignSystemGeneration[];
};

let dbPromise: Promise<Low<DesignSystemDb>> | undefined;

export async function saveDesignSystemGeneration(input: {
  id?: string;
  request: GenerateDesignSystemInput;
  result: GenerateDesignSystemResult;
}) {
  const db = await getDesignSystemDb();

  const generation: DesignSystemGeneration = {
    id: input.id ?? randomUUID(),
    projectId: input.request.projectId,
    createdAt: new Date().toISOString(),
    result: input.result,
  };

  db.data.generations.unshift(generation);
  await db.write();

  logDesignSystem("saved design-system generation", {
    id: generation.id,
    projectId: generation.projectId,
    totalGenerations: db.data.generations.length,
  });

  return generation;
}

export async function listDesignSystemGenerations() {
  const db = await getDesignSystemDb();

  return db.data.generations;
}

async function getDesignSystemDb() {
  if (!dbPromise) {
    const dataDirectory = getDataDirectory();
    mkdirSync(dataDirectory, { recursive: true });

    const filePath = path.join(dataDirectory, "design-systems.json");
    const defaultData: DesignSystemDb = { generations: [] };
    dbPromise = JSONFilePreset<DesignSystemDb>(filePath, defaultData);

    logDesignSystem("opened design-system db", { filePath });
  }

  return dbPromise;
}

function getDataDirectory() {
  const rootServerDirectory = path.join(process.cwd(), "server");

  if (existsSync(path.join(rootServerDirectory, "package.json"))) {
    return path.join(rootServerDirectory, "data");
  }

  return path.join(process.cwd(), "data");
}
