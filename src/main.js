const core = require('@actions/core');
const github = require('@actions/github');
const { Octokit } = require('@octokit/rest');

const requiredArgOptions = {
  required: true,
  trimWhitespace: true
};

const ghToken = core.getInput('github-token', requiredArgOptions);
const environment = core.getInput('environment', requiredArgOptions);
const owner = core.getInput('owner', requiredArgOptions);
const repo = core.getInput('repo', requiredArgOptions);
const ref = core.getInput('ref', requiredArgOptions);
const deployStatus = core.getInput('deploy-status', requiredArgOptions);
const deploymentMessage = core.getInput('deployment-message', requiredArgOptions);
const entities = core.getInput('entities');
const instance = core.getInput('instance');
const workflow_run_url = core.getInput('workflow-run-url', requiredArgOptions);

const octokit = new Octokit({ auth: ghToken });

async function run() {
  //create deployment record
  const entitiesList = JSON.parse(entities.value.replace(/'/g, '"'))

  const deployment = await octokit.repo.createDeployment({
    owner: owner,
    repo: repo,
    ref: ref,
    auto_merge: false,
    environment: environment,
    task: 'workflowdeploy',
    payload: {
      entities: entitiesList,
      instance: instance,
      workflow_run_url: workflow_run_url,
    },
  });

  //create deployment status record
  const status = await octokit.repos.createDeploymentStatus({
    owner: owner,
    repo: repo,
    deployment_id: deployment.id,
    state: deployStatus,
    description: deploymentMessage,
  });

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
