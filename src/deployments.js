const { Octokit } = require('@octokit/rest');

async function createDeployment(context) {
  const octokit = new Octokit({ auth: context.token });

  // create deployment record
  const deployment = (
    await octokit.rest.repos.createDeployment({
      owner: context.owner,
      repo: context.repo,
      ref: context.release_ref,
      environment: context.environment,
      task: 'workflowdeploy',
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
  const status = await octokit.rest.repos.createDeploymentStatus({
    owner: context.owner,
    repo: context.repo,
    deployment_id: deployment.id,
    state: context.deployment_status,
    description: context.deployment_description,
    auto_inactive: context.deployment_auto_inactivate
  });

  //return deployment id
  return deployment.id;
}

module.exports = {
  createDeployment
};
