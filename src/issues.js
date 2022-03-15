const core = require('@actions/core');
const github = require('@actions/github');

const { format, utcToZonedTime } = require('date-fns-tz');
const axios = require('axios');

const owner = github.context.repo.owner;
const repo = github.context.repo.repo;

async function findTheIssueForThisDeploymentByTitle(graphqlWithAuth, ghLogin, issueToUpdate, projectBoardId) {
  try {
    core.startGroup(`Retrieving the issue by title: '${issueToUpdate.title}'...`);
    const query = `
    query {
      repository(owner: "${owner}", name: "${repo}") {
        issues(last: 100, orderBy: {field: UPDATED_AT direction: DESC} filterBy: {mentioned: "${ghLogin}" states: [OPEN]}) {
          edges {
            node {
              title
              number
              state
              body
              labels(first: 100) {
                edges {
                  node {
                    name
                  }
                }
              }
              projectCards {
                edges {
                  node {
                    databaseId
                    project {
                      databaseId  
                    }
                  }
                }
              }
            }
          }
        }
      }
    }`;

    const response = await graphqlWithAuth(query);
    if (!response.repository.issues || !response.repository.issues.edges || response.repository.issues.edges.length === 0) {
      core.info('No Issues were found.');
      core.endGroup();
      return;
    }

    //Find all of the cards with the matching title, we'll check to see which board they are on later.
    const existingIssues = response.repository.issues.edges.filter(issue => issue.node.title.toLowerCase() === issueToUpdate.title.toLowerCase());
    if (!existingIssues || existingIssues.length === 0) {
      core.info(`An issue with the title '${issueToUpdate.title}' was not found.`);
      core.endGroup();
      return;
    }

    // Make the issues with the matching title are connected to a project board
    let issuesOnAnyProjectBoard = existingIssues.filter(
      e => e.node && e.node.projectCards && e.node.projectCards.edges && e.node.projectCards.edges.length > 0
    );
    if (!issuesOnAnyProjectBoard || issuesOnAnyProjectBoard.length === 0) {
      core.info('None of the issues with matching titles have project cards associated with them.');
      core.endGroup();
      return;
    }

    // See if one of the issues with the matching title is on this board
    let existingIssue = issuesOnAnyProjectBoard.find(i =>
      i.node.projectCards.edges.find(pc => pc.node.project && pc.node.project.databaseId == projectBoardId)
    );
    if (!existingIssue) {
      core.info(`An issue with the title '${issueToUpdate.title}' and on project board ${projectBoardId} was not found.`);
      core.endGroup();
      return;
    }

    issueToUpdate.number = existingIssue.node.number;
    issueToUpdate.body = existingIssue.node.body;
    issueToUpdate.state = existingIssue.node.state;

    const projectCard = existingIssue.node.projectCards.edges.find(pc => pc.node.project && pc.node.project.databaseId == projectBoardId);
    issueToUpdate.projectCardId = projectCard.node.databaseId; //(this is different then the pc.node.project.databaseId we're checking above)

    if (existingIssue.node.labels && existingIssue.node.labels.edges && existingIssue.node.labels.edges.length > 0) {
      issueToUpdate.labels = existingIssue.node.labels.edges.map(l => l.node.name);
    }

    core.info(`A project card was found for '#${issueToUpdate.number} ${issueToUpdate.title}': ${issueToUpdate.projectCardId}`);
    core.endGroup();
  } catch (error) {
    core.setFailed(`An error occurred retrieving the issues: ${error}`);
    core.endGroup();
    throw error;
  }
}

function getDateString() {
  let nowString;
  let timezone = core.getInput('timezone');
  if (timezone && timezone.length > 0) {
    let now = utcToZonedTime(new Date(), timezone);
    nowString = `${format(now, 'MMM dd, yyyy hh:mm a OOOO', { timeZone: timezone })}`;
  } else {
    let now = new Date();
    nowString = format(now, 'MMM dd, yyyy hh:mm a OOOO');
  }
  core.info(`The date for this deployment is ${nowString}`);
  return nowString;
}

async function createAnIssueForThisDeploymentIfItDoesNotExist(octokit, ghLogin, issueToUpdate, labels, project, actor) {
  try {
    core.startGroup(`Creating an issue for this deployment since it does not exist...`);
    let workflowUrl = `[${github.context.runNumber}](https://github.com/${owner}/${repo}/actions/runs/${github.context.runId})`;
    let nowString = getDateString();

    let body = `|Env|Workflow|Status|Date|Actor|
|---|---|---|---|---|
|${project.columnName}|${workflowUrl}|${labels.deployStatus}|${nowString}|${actor}|`;

    const { data: response } = await octokit.rest.issues.create({
      owner,
      repo,
      title: issueToUpdate.title,
      body,
      labels: [labels.currentlyInEnv, labels.deployStatus, labels.default]
    });
    core.info(`The issue was created successfully: ${response.number}`);

    //Store the values
    issueToUpdate.number = response.number;
    issueToUpdate.nodeId = response.node_id;
    issueToUpdate.body = body;
    issueToUpdate.state = 'OPEN';

    //Add the autogenerated comment which will allow us to better target issues we're searching through
    core.info(`Adding a comment to the issue indicating it was auto-generated by @${ghLogin}...`);
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: response.number,
      body: `*This issue was auto-generated by @${ghLogin} for deployment tracking on the [${project.name}](${project.link})*`
    });
    core.info(`The auto-generated comment was sucessfully added to the issue.`);
    core.endGroup();
  } catch (error) {
    core.setFailed(`An error occurred creating the '${issueToUpdate}' issue: ${error}`);
    core.endGroup();
    throw error;
  }
}

async function appendDeploymentDetailsToIssue(ghToken, issueToUpdate, project, actor, deployStatus) {
  try {
    core.startGroup(`Appending the deployment details to the issue...`);

    let workflowUrl = `[${github.context.workflow} #${github.context.runNumber}](https://github.com/${owner}/${repo}/actions/runs/${github.context.runId})`;
    let nowString = getDateString();
    let bodyText = `${issueToUpdate.body}\n|${project.columnName}|${workflowUrl}|${deployStatus}|${nowString}|${actor}|`;

    //The octokit call was leaving the issue number off the url so it would not succeed.  Using axios instead.
    let request = {
      title: issueToUpdate.title,
      body: bodyText
    };

    await axios({
      method: 'PATCH',
      url: `https://api.github.com/repos/${owner}/${repo}/issues/${issueToUpdate.number}`,
      headers: {
        'content-type': 'application/json',
        authorization: `token ${ghToken}`,
        accept: 'application/vnd.github.v3+json'
      },
      data: JSON.stringify(request)
    });
    core.info(`The deployment details were successfully added to the issue.`);
    core.endGroup();
  } catch (error) {
    //Don't immediately fail by throwing, let it see what else it can finish.
    core.setFailed(`An error occurred appending the deployment details to the issue: ${error}`);
    core.endGroup();
  }
}

module.exports = {
  findTheIssueForThisDeploymentByTitle,
  createAnIssueForThisDeploymentIfItDoesNotExist,
  appendDeploymentDetailsToIssue
};
