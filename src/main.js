const core = require('@actions/core');
const github = require('@actions/github');

const { graphql } = require('@octokit/graphql');

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

const requiredArgOptions = {
  required: true,
  trimWhitespace: true
};

const environment = core.getInput('environment', requiredArgOptions);
const boardNumber = core.getInput('board-number', requiredArgOptions);
const deployStatus = core.getInput('deploy-status', requiredArgOptions);
const deployLabel = core.getInput('deploy-label');
const ref = core.getInput('ref', requiredArgOptions);
let refType = core.getInput('ref-type');
const deployableType = core.getInput('deployable-type');

const ghLogin = core.getInput('github-login') || 'github-actions[bot]';
const ghToken = core.getInput('github-token', requiredArgOptions);

const octokit = github.getOctokit(ghToken);
const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${ghToken}`
  }
});

let actor, project, labels, issueToUpdate;

function setupAction() {
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
    default: 'deployment-board',
    deployLabel: deployLabel ? deployLabel.toLowerCase() : null,
    deployStatusExists: true,
    currentlyInEnvExists: true,
    defaultExists: true,
    deployLabelExists: deployLabel ? true : false
  };

  issueToUpdate = {
    title: '',
    number: 0,
    body: '',
    state: 'OPEN',
    projectCardId: 0,
    nodeId: '',
    deployableType: deployableType && deployableType.length > 0 ? `[${deployableType}] ` : ''
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
      issueToUpdate.title = `${issueToUpdate.deployableType}Branch Deploy: ${ref}`;
      break;
    case 'tag':
      issueToUpdate.title = `${issueToUpdate.deployableType}Tag Deploy: ${ref}`;
      break;
    case 'sha':
      issueToUpdate.title = `${issueToUpdate.deployableType}SHA Deploy: ${ref}`;
      break;
  }
}

async function run() {
  await getProjectData(graphqlWithAuth, project);

  await makeSureLabelsForThisActionExist(octokit, labels);

  await findTheIssueForThisDeploymentByTitle(graphqlWithAuth, ghLogin, issueToUpdate, project.id);

  //We only want to remove the currently-in-* label if the status was success or failure.
  //If the status was cancelled or skipped, we don't really know what is currently where so don't change anything.
  let workflowFullyRan = labels.deployStatus === 'success' || labels.deployStatus === 'failure';

  if (workflowFullyRan) {
    const issuesWithCurrentlyInEnvLabel = await findIssuesWithLabel(graphqlWithAuth, labels.currentlyInEnv, issueToUpdate.deployableType);
    if (issuesWithCurrentlyInEnvLabel) {
      for (let index = 0; index < issuesWithCurrentlyInEnvLabel.length; index++) {
        const issueNumber = issuesWithCurrentlyInEnvLabel[index];
        await removeLabelFromIssue(octokit, labels.currentlyInEnv, issueNumber);
      }
    }
  }

  if (issueToUpdate.number === 0) {
    await createAnIssueForThisDeploymentIfItDoesNotExist(octokit, ghLogin, issueToUpdate, labels, project, actor);
    if (labels.deployLabel != null) {
      await addLabelToIssue(octokit, labels.deployLabel, issueToUpdate.number);
      if (labels.deployLabel === 'deleted' || labels.deployLabel === 'destroyed') {
        await removeLabelFromIssue(octokit, labels.currentlyInEnv, issueToUpdate.number);
      }
    }
  } else {
    await appendDeploymentDetailsToIssue(ghToken, issueToUpdate, project, actor, labels.deployStatus);
    await removeStatusLabelsFromIssue(octokit, issueToUpdate.labels, issueToUpdate.number, labels.deployStatus);
    await addLabelToIssue(octokit, labels.deployStatus, issueToUpdate.number);
    await addLabelToIssue(octokit, labels.default, issueToUpdate.number);

    if (workflowFullyRan) {
      await addLabelToIssue(octokit, labels.currentlyInEnv, issueToUpdate.number);
    }

    if (labels.deployLabel != null) {
      await addLabelToIssue(octokit, labels.deployLabel, issueToUpdate.number);
      if (labels.deployLabel === 'deleted' || labels.deployLabel === 'destroyed') {
        await removeLabelFromIssue(octokit, labels.currentlyInEnv, issueToUpdate.number);
      }
    } else {
      const issuesWithDeleteLabel = await findIssuesWithLabel(graphqlWithAuth, 'deleted', issueToUpdate.deployableType);
      if (issuesWithDeleteLabel) {
        for (let index = 0; index < issuesWithDeleteLabel.length; index++) {
          const issueNumber = issuesWithDeleteLabel[index];
          await removeLabelFromIssue(octokit, 'deleted', issueNumber);
        }
      }
      const issuesWithDestroyLabel = await findIssuesWithLabel(graphqlWithAuth, 'destroyed', issueToUpdate.deployableType);
      if (issuesWithDestroyLabel) {
        for (let index = 0; index < issuesWithDestroyLabel.length; index++) {
          const issueNumber = issuesWithDestroyLabel[index];
          await removeLabelFromIssue(octokit, 'destroyed', issueNumber);
        }
      }
    }
  }

  if (issueToUpdate.projectCardId === 0) {
    await createProjectCard(graphqlWithAuth, issueToUpdate.nodeId, project.columnNodeId);
  } else if (workflowFullyRan) {
    await moveCardToColumn(ghToken, issueToUpdate.projectCardId, project.columnName, project.columnId);
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
