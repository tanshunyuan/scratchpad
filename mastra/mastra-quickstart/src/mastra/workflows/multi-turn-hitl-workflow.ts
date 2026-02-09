import { createStep, createWorkflow } from "@mastra/core/workflows";
import { gameAgent } from "../agents/game-agent";
import z from "zod";

const famousPeople = [
  "Taylor Swift",
  "Eminiem",
  "Elon Musk",
  "Steve Jobs",
  "Beyonce",
  "Lionel Messi",
  "Roger Federer",
];

const gameStateSchema = z.object({
  famousPerson: z.string(),
  guessCount: z.number(),
  gameWon: z.boolean(),
  response: z.string(),
});

const generateInitialGameStateStep = createStep({
  id: "generate-initial-game-state-step",
  inputSchema: z.object({}),
  outputSchema: gameStateSchema,
  execute: async () => {
    const randomNumber = Math.floor(Math.random() * famousPeople.length);
    return {
      famousPerson: famousPeople[randomNumber],
      guessCount: 0,
      gameWon: false,
      response:
        "I'm thinking of a famous person. Ask me yes/no questions to figure out who it is!",
    };
  },
});

const playGameStep = createStep({
  id: "play-game-step",
  inputSchema: gameStateSchema,
  outputSchema: gameStateSchema,
  resumeSchema: z.object({
    questionOrGuess: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return suspend({});
    }
    const { questionOrGuess } = resumeData;
    const output = await gameAgent.generate(
      `
      The famous person is: ${inputData.famousPerson}
      The user guessed: "${questionOrGuess}"
      Respond appropriately. If this is a guess, tell me if it's correct.
      `,
      {
        structuredOutput: {
          schema: z.object({
            response: z.string(),
            gameWon: z.boolean(),
          }),
        },
      },
    );

    const { gameWon, response } = output.object;

    // updates the state
    return {
      famousPerson: inputData.famousPerson,
      guessCount: inputData.guessCount + 1,
      response,
      gameWon,
    };
  },
});

const endGameStep = createStep({
  id: "end-game-step",
  inputSchema: gameStateSchema,
  outputSchema: gameStateSchema,
  execute: async ({ inputData }) => {
    return inputData;
  },
});

export const multiTurnHitlWorkflow = createWorkflow({
  id: "multi-turn-hitl-workflow",
  inputSchema: z.object({}),
  outputSchema: gameStateSchema,
})
  .then(generateInitialGameStateStep)
  .dountil(playGameStep, async ({ inputData: { gameWon } }) => gameWon)
  .then(endGameStep)
  .commit();
