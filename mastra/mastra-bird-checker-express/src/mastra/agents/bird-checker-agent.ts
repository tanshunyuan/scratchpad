import { Agent } from '@mastra/core/agent';

export const birdCheckerAgent = new Agent({
  id: 'bird-checker',
  name: 'Bird Checker',
  instructions:
    'You can view an image and figure out if it is a bird or not. You can also figure out the species of the bird and where the picture was taken.',
  model: 'openai/gpt-4.1-mini'
});
