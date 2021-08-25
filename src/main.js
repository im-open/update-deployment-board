const core = require('@actions/core');
const github = require('@actions/github');
const { getProjectData, createProjectCard, moveCardToColumn } = require('./projects.js');
const {
  findIssuesWithLabel,
  removeLabelFromIssue,
  addLabelToIssue,
  makeSureLabelsForThisActionExist,
  removeStatusLabelsFromIssue
} = require('./labels.js');
const {
  findTheIssueForThisDeploymentByTitle,
  createAnIssueForThisDeploymentIfItDoesNotExist,
  appendDeploymentDetailsToIssue
} = require('./issues.js');

let ghLogin = core.getInput('github-login');
const ghToken = core.getInput('github-token');
const environment = core.getInput('environment');
const boardNumber = core.getInput('board-number');
const deployStatus = core.getInput('deploy-status');
const ref = core.getInput('ref');
let refType = core.getInput('ref-type');

//Check for any missing arguments that are required
let missingArguments = [];
if (!ghToken) missingArguments.push('github-token');
if (!environment) missingArguments.push('environment');
if (!boardNumber) missingArguments.push('board-number');
if (!ref) missingArguments.push('ref');
if (!deployStatus) missingArguments.push('deploy-status');
if (missingArguments && missingArguments.length > 0) {
  core.setFailed(`To call this action, provided the missing required arguments: ${missingArguments.join(', ')}`);
  return;
}

let actor, project, labels, issueToUpdate;

function setupAction() {
  if (!ghLogin || ghLogin.length === 0) ghLogin = 'github-actions';

  actor = github.context.actor;

  project = {
    number: boardNumber,
    id: 0,
    nodeId: '',
    name: '',
    link: '',
    columnId: '',
    columnNodeId: '',
    columnName: environment,
    labels: []
  };

  labels = {
    deployStatus: deployStatus.toLowerCase(), //success, failure, cancelled, skipped
    currentlyInEnv: `🚀currently-in-${environment.toLowerCase()}`,
    deployStatusExists: true,
    currentlyInEnvExists: true
  };

  issueToUpdate = {
    title: '',
    number: 0,
    body: '',
    state: 'OPEN',
    projectCardId: 0,
    nodeId: ''
  };

  if (!refType || refType.length === 0) {
    const shaPattern = /\b([0-9a-f]{40})\b/g;
    const tagPattern = /^(v?\d+(?:\.\d+)*.*)$/g;

    if (ref.match(shaPattern)) {
      refType = 'sha';
    } else if (ref.match(tagPattern)) {
      refType = 'tag';
    } else {
      refType = 'branch';
    }
  }

  switch (refType.toLowerCase()) {
    case 'branch':
      issueToUpdate.title = `Branch Deploy: ${ref}`;
      break;
    case 'tag':
      issueToUpdate.title = `Tag Deploy: ${ref}`;
      break;
    case 'sha':
      issueToUpdate.title = `SHA Deploy: ${ref}`;
      break;
  }
}

async function run() {
  await getProjectData(project);

  await makeSureLabelsForThisActionExist(labels);

  await findTheIssueForThisDeploymentByTitle(issueToUpdate, project.id);

  //We only want to remove the currently-in-* label if the status was success or failure.
  //If the status was cancelled or skipped, we don't really know what is currently where so don't change anything.
  let workflowFullyRan = labels.deployStatus === 'success' || labels.deployStatus === 'failure';

  if (workflowFullyRan) {
    const issuesWithCurrentlyInEnvLabel = await findIssuesWithLabel(labels.currentlyInEnv);
    if (issuesWithCurrentlyInEnvLabel) {
      for (let index = 0; index < issuesWithCurrentlyInEnvLabel.length; index++) {
        const issueNumber = issuesWithCurrentlyInEnvLabel[index];
        await removeLabelFromIssue(labels.currentlyInEnv, issueNumber);
      }
    }
  }

  if (issueToUpdate.number === 0) {
    await createAnIssueForThisDeploymentIfItDoesNotExist(issueToUpdate, labels, project, actor);
  } else {
    await appendDeploymentDetailsToIssue(issueToUpdate, project, actor, labels.deployStatus);
    await removeStatusLabelsFromIssue(issueToUpdate.labels, issueToUpdate.number, labels.deployStatus);
    await addLabelToIssue(labels.deployStatus, issueToUpdate.number);

    if (workflowFullyRan) {
      await addLabelToIssue(labels.currentlyInEnv, issueToUpdate.number);
    }
  }

  if (issueToUpdate.projectCardId === 0) {
    await createProjectCard(issueToUpdate.nodeId, project.columnNodeId);
  } else if (workflowFullyRan) {
    await moveCardToColumn(issueToUpdate.projectCardId, project.columnName, project.columnId);
  }

  core.info(`See the project board at: ${project.link}`);
}

try {
  setupAction();
  run();
} catch (error) {
  //Anything that shows up here should be a re-thrown error where the detailed error was already logged.
  //We can set a generic failure message because the more detailed one should already have been logged.
  core.setFailed('An error occurred updating the deployment board.');
  return;
}
