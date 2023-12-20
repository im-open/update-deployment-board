const core = require('@actions/core');
const { Octokit } = require('@octokit/rest');

const requiredArgOptions = {
  required: true,
  trimWhitespace: true
};

const ghToken = core.getInput('github-token', requiredArgOptions);
const environment = core.getInput('environment', requiredArgOptions);
const [owner, repo] = core.getInput('project-slug', requiredArgOptions).split('/');
const ref = core.getInput('ref', requiredArgOptions);
const deployStatus = core.getInput('deploy-status', requiredArgOptions);
const deploymentMessage = core.getInput('deployment-message', { required: false, trimWhitespace: true });
const entities = core.getInput('entities', requiredArgOptions);
const instance = core.getInput('instance', requiredArgOptions);
const workflow_run_url = core.getInput('workflow-run-url', requiredArgOptions);

async function run() {
  const octokit = new Octokit({
    auth: ghToken
  });

  // create deployment record
  const entitiesList = JSON.parse(entities.replace(/'/g, '"'));
  const deployment = await octokit.rest.repos.createDeployment({
    owner: owner,
    repo: repo,
    ref: ref,
    auto_merge: false,
    environment: environment,
    task: 'workflowdeploy',
    payload: {
      entities: entitiesList,
      instance: instance,
      workflow_run_url: workflow_run_url
    }
  });

  console.log('deployment id: ' + deployment.id);

  //create deployment status record
  // const status = await octokit.rest.repos.createDeploymentStatus({
  //   owner: owner,
  //   repo: repo,
  //   deployment_id: deployment.id,
  //   state: deployStatus,
  //   description: deploymentMessage
  // });

  //return deployment id
  return deployment.id;
}

try {
  core.exportVariable('github-deployment-id', run());
} catch (error) {
  //Anything that shows up here should be a re-thrown error where the detailed error was already logged.
  //We can set a generic failure message because the more detailed one should already have been logged.
  core.setFailed('An error occurred creating a GitHub deployment.');
  return;
}
