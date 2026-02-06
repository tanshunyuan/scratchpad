import { candidateWorkflow } from "../mastra/workflows/candidate-workflow";

const testCandidateWorkflow = async () => {
  const run = await candidateWorkflow.createRun();
  const res = await run.start({
    inputData: {
      resumeText:
        "Knowledgeable Software Engineer with more than 10 years of experience in software development. Proven expertise in the design and development of software databases and optimization of user interfaces.",
    },
  });

  // Dump the complete workflow result (includes status, steps and result)
  console.log(JSON.stringify(res, null, 2));

  // Get the workflow output value
  if (res.status === "success") {
    const question =
      res.result.askAboutRole?.question ??
      res.result.askAboutSpecialty?.question;

    console.log(`Output value: ${question}`);
  }
};
await testCandidateWorkflow();
