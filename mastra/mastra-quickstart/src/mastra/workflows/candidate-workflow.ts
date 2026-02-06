import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { Agent } from "@mastra/core/agent";

const recruiter = new Agent({
  id: "recruiter-agent",
  name: "Recruiter Agent",
  instructions: `You are a recruiter.`,
  model: "openai/gpt-4.1-mini",
});

const gatherCandidateInfo = createStep({
  id: "gatherCandidateInfo",
  inputSchema: z.object({
    resumeText: z.string(),
  }),
  outputSchema: z.object({
    candidateName: z.string(),
    isTechnical: z.boolean(),
    specialty: z.string(),
    resumeText: z.string(),
  }),
  execute: async ({ inputData }) => {
    const resumeText = inputData.resumeText;
    const prompt = `Extract details from the resume text:
    "${resumeText}"`;
    const res = await recruiter.generate(prompt, {
      structuredOutput: {
        schema: z.object({
          candidateName: z.string(),
          isTechnical: z.boolean(),
          specialty: z.string(),
          resumeText: z.string(),
        }),
      },
    });

    return res.object;
  },
});

const askAboutSpecialty = createStep({
  id: "askAboutSpecialty",
  inputSchema: z.object({
    candidateName: z.string(),
    isTechnical: z.boolean(),
    specialty: z.string(),
    resumeText: z.string(),
  }),
  outputSchema: z.object({
    question: z.string(),
  }),
  execute: async ({ inputData: candidateInfo }) => {
    const prompt = `You are a recruiter. Given the resume below, craft a short question
for ${candidateInfo?.candidateName} about how they got into "${candidateInfo?.specialty}".
Resume: ${candidateInfo?.resumeText}`;
    const res = await recruiter.generate(prompt);

    return { question: res?.text?.trim() || "" };
  },
});

const askAboutRole = createStep({
  id: "askAboutRole",
  inputSchema: z.object({
    candidateName: z.string(),
    isTechnical: z.boolean(),
    specialty: z.string(),
    resumeText: z.string(),
  }),
  outputSchema: z.object({
    question: z.string(),
  }),
  execute: async ({ inputData: candidateInfo }) => {
    const prompt = `You are a recruiter. Given the resume below, craft a short question
for ${candidateInfo?.candidateName} asking what interests them most about this role.
Resume: ${candidateInfo?.resumeText}`;
    const res = await recruiter.generate(prompt);
    return { question: res?.text?.trim() || "" };
  },
});

export const candidateWorkflow = createWorkflow({
  id: "candidate-workflow",
  inputSchema: z.object({
    resumeText: z.string(),
  }),
  outputSchema: z.object({
    askAboutSpecialty: z.object({
      question: z.string(),
    }),
    askAboutRole: z.object({
      question: z.string(),
    }),
  }),
})
  .then(gatherCandidateInfo)
  .branch([
    [async ({ inputData: { isTechnical } }) => isTechnical, askAboutSpecialty],
    [async ({ inputData: { isTechnical } }) => !isTechnical, askAboutRole],
  ])
  .commit();
