import { mastra } from "../mastra";
import { candidateWorkflow } from "../mastra/workflows/candidate-workflow";

const testEmailHitlWorkflow = async () => {
  const workflow = mastra.getWorkflow("emailHitlWorkflow");
  const run = await workflow.createRun();

  const initialRun = await run.start({
    inputData: {
      userEmail: "alex@example.com",
    },
  });

  if (initialRun.status === "suspended") {
    const suspendStep = initialRun.suspended[0];
    const suspendedPayload = initialRun.steps[suspendStep[0]].suspendPayload;
    console.log(suspendedPayload);
  }

  // const approvedResult = await run.resume({
  //   step: "step-1",
  //   resumeData: { approved: true },
  // });
  // console.log('le approvedResult ==> ', approvedResult)

  const rejectedResult = await run.resume({
    step: "step-1",
    resumeData: { approved: false },
  });
  console.log('le rejectedResult ==> ', rejectedResult)
};
await testEmailHitlWorkflow();

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
// await testCandidateWorkflow();
