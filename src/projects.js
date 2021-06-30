const core = require('@actions/core');
const github = require('@actions/github');
const { graphql } = require('@octokit/graphql');
const axios = require('axios');

const ghToken = core.getInput('github-token');
const owner = github.context.repo.owner;
const repo = github.context.repo.repo;

const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${ghToken}`
  }
});

async function getProjectData(projectToUpdate) {
  try {
    core.startGroup(`Retrieving information about project #${projectToUpdate.number}...`);
    const query = `
    query {
      repository(owner: "${owner}", name: "${repo}") {
        project(number: ${projectToUpdate.number}){
          databaseId
          name
          url
          id
          columns (first: 100) {
            edges {
              node {
                name
                databaseId
                id
              }
            }
          }
        } 
      }
    }`;

    const response = await graphqlWithAuth(query);
    if (
      !response.repository.project ||
      !response.repository.project.columns ||
      !response.repository.project.columns.edges ||
      !response.repository.project.columns.edges.length === 0
    ) {
      core.setFailed(
        `Project board #${projectToUpdate.number} does not appear to be set up correctly. Make sure you are using the correct board number and that the ${projectToUpdate.columnName} column exists.`
      );
      throw new Error('The project board is not set up correctly.');
    }

    projectToUpdate.id = response.repository.project.databaseId;
    projectToUpdate.name = response.repository.project.name;
    projectToUpdate.link = response.repository.project.url;
    projectToUpdate.nodeId = response.repository.project.id;
    core.info(`Project board #${projectToUpdate.number} was found.`);

    core.info(`Retrieving information about the project's ${projectToUpdate.columnName} column....`);
    const matchingColumn = response.repository.project.columns.edges.find(
      c => c.node.name.toLowerCase() === projectToUpdate.columnName.toLowerCase()
    );
    if (!matchingColumn) {
      core.setFailed(`The ${projectToUpdate.columnName} column does not appear to exist on the ${projectToUpdate.name} board.`);
      throw new Error('The project board is missing a column.');
    }
    projectToUpdate.columnId = matchingColumn.node.databaseId;
    projectToUpdate.columnNodeId = matchingColumn.node.id;
    core.info(`The ${projectToUpdate.columnName} column info has been found.`);

    core.info(`Finished retrieving information about project #${projectToUpdate.number}:`);
    core.info(`\tBoard Name: '${projectToUpdate.name}'`);
    core.info(`\tBoard Id: '${projectToUpdate.id}'`);
    core.info(`\tBoard URL: '${projectToUpdate.link}'`);
    core.info(`\tBoard Node ID: '${projectToUpdate.nodeId}'`);
    core.info(`\t${projectToUpdate.columnName} Column Id: '${projectToUpdate.columnId}'`);
    core.info(`\t${projectToUpdate.columnName} Column Node ID: '${projectToUpdate.columnNodeId}'`);
    core.endGroup();
  } catch (error) {
    core.setFailed(`An error occurred getting data for the Project #${projectBoardId}: ${e}`);
    core.endGroup();
    throw error;
  }
}

async function createProjectCard(issue_number, columnId) {
  core.startGroup(`Creating a project card for the issue...`);
  //The rest client and post requests both failed so use graphql to make this change
  try {
    const mutation = `mutation {
      addProjectCard(input: {projectColumnId: "${columnId}" contentId: "${issue_number}"}) {
        clientMutationId
      }
    }`;

    await graphqlWithAuth(mutation);
    core.info(`A project card was successfully created.`);
    core.endGroup();
  } catch (error) {
    core.setFailed(`An error occurred adding the issue to the project: ${e}`);
    core.endGroup();
    throw error;
  }
}

async function cleanupProjectBoard() {
  try {
    core.startGroup('Cleaning up the project board...');

    //TODO:  Cleanup, only keep X number of  cards, different strategy per type (branch/tag/sha), manual archives, delete old date labels?

    core.info('Finished cleaning up the project board.');
    core.endGroup();
  } catch (error) {
    core.setFailed(`An error occurred cleaning up the project board.  Error: ${error}`);
    core.endGroup();
  }
}

async function moveCardToColumn(card_Id, columnName, column_Id) {
  try {
    core.startGroup(`Moving the project card to the ${columnName} column....`);

    //The octokit api doesn't work for this call so use axios to do a direct post instead
    const request = {
      column_id: column_Id,
      position: 'top'
    };
    await axios({
      method: 'POST',
      url: `https://api.github.com/projects/columns/cards/${card_Id}/moves`,
      headers: {
        'content-type': 'application/json',
        authorization: `token ${ghToken}`,
        accept: 'application/vnd.github.inertia-preview+json'
      },
      data: JSON.stringify(request)
    });
    core.info(`The card was moved to the ${columnName} column.`);
    core.endGroup();
  } catch (error) {
    //Don't immediately fail by throwing, let it see what else it can finish.
    core.setFailed(`An error making the request to close the PagerDuty maintenance window: ${error}`);
    core.endGroup();
  }
}

module.exports = {
  getProjectData,
  createProjectCard,
  cleanupProjectBoard,
  moveCardToColumn
};
