const { Octokit } = require('@octokit/rest');
const WORKFLOW_DEPLOY = 'workflowdeploy';
const { Octokit: OctokitGraphQl } = require('@octokit/graphql');
const { add } = require('date-fns');

async function inactivatePriorDeployments(context, currentDeploymentNodeId) {
  const octokit = new Octokit({ auth: context.token });
  const octokitGraphQl = new OctokitGraphQl({ auth: context.token });

  const params = {
    owner,
    repo,
    task: WORKFLOW_DEPLOY,
    environment: context.environment,
    per_page: 100
  };

  const deploymentNodeIds = (await octokit.paginate(octokit.rest.repos.listDeployments, params))
    .filter(d => d.node_id != currentDeploymentNodeId && d.payload.entity == context.entity && d.payload.instance == context.instance)
    .map(d => d.node_id);

  const statusesQuery = `
      query($deploymentNodeIds: [ID!]!) {
        deployments: nodes(ids: $deploymentNodeIds) {
          ... on Deployment {
            id
            datbaseId
            environment
            statuses(first:1) {
              nodes {
                description
                state
                createdAt
              }
            }
          }
        }
      }`;

  const statuses = await octokitGraphQl(statusesQuery, { deploymentNodeIds: deploymentNodeIds });

  for (let i = 0; i < d.deployments.length; i++) {
    const deployment = d.deployments[i];
    for (let j = 0; j < deployment.statuses.nodes.length; j++) {
      const status = deployment.statuses.nodes[j];
      if (status.state == 'SUCCESS') {
        createDeploymentStatus(octokit, context.owner, context.repo, deployment.databaseId, 'INACTIVE', 'Inactivated by workflow');
      }
    }
  }
}

async function createDeployment(context) {
  const octokit = new Octokit({ auth: context.token });

  // create deployment record
  const deployment = (
    await octokit.rest.repos.createDeployment({
      owner: context.owner,
      repo: context.repo,
      ref: context.release_ref,
      environment: context.environment,
      task: WORKFLOW_DEPLOY,
      auto_merge: false,

      payload: {
        entity: context.entity,
        instance: context.instance,
        workflow_run_url: context.workflow_run_url,
        workflow_actor: context.workflow_actor
      }
    })
  ).data;

  //create deployment status record
  createDeploymentStatus(octokit, context.owner, context.repo, deployment.id, context.deployment_status, context.deployment_description);

  inactivatePriorDeployments(deployment.node_id);

  //return deployment id
  return deployment.id;
}

async function createDeploymentStatus(octokit, owner, repo, deployment_id, state, description) {
  const status = await octokit.rest.repos.createDeploymentStatus({
    owner: owner,
    repo: repo,
    deployment_id: deployment_id,
    state: state,
    description: description,
    auto_inactive: false // we will manually inactivate prior deployments
  });
}

module.exports = {
  createDeployment
};
