const core = require('@actions/core');
const { setup } = require('./library.js');
const { createDeployment } = require('./deployments.js');

async function run(setupContext) {
  await createDeployment(setupContext);
}

try {
  const setupContext = setup();
  const runPromise = new Promise((resolve, reject) => resolve(run(setupContext)));
  runPromise.then(deploymentId => core.setOutput('github-deployment-id', deploymentId));
} catch (error) {
  //Anything that shows up here should be a re-thrown error where the detailed error was already logged.
  //We can set a generic failure message because the more detailed one should already have been logged.
  core.setFailed('An error occurred creating a GitHub deployment.');
  return;
}
