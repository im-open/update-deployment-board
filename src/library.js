const core = require('@actions/core');
const github = require('@actions/github');

const requiredArgOptions = {
  required: true,
  trimWhitespace: true
};

const notRequiredArgOptions = {
  required: false,
  trimWhitespace: true
};

class context {
  constructor(
    workflow_actor,
    token,
    environment,
    release_ref,
    deployment_status,
    deployment_description,
    deployment_auto_inactivate,
    entity,
    instance,
    workflow_run_url,
    owner,
    repo
  ) {
    this.workflow_actor = workflow_actor;
    this.token = token;
    this.environment = environment;
    this.release_ref = release_ref;
    this.deployment_status = deployment_status;
    this.deployment_description = deployment_description;
    this.deployment_auto_inactivate = deployment_auto_inactivate;
    this.entity = entity;
    this.instance = instance;
    this.workflow_run_url = workflow_run_url;
    this.owner = owner;
    this.repo = repo;
  }
}

function setup() {
  const workflow_actor = core.getInput('workflow-actor', requiredArgOptions);
  const token = core.getInput('token', requiredArgOptions);
  const environment = core.getInput('environment', requiredArgOptions);
  const release_ref = core.getInput('release-ref', requiredArgOptions);
  const deployment_status = core.getInput('deployment-status', requiredArgOptions);
  const deployment_description = core.getInput('deployment-description', notRequiredArgOptions);
  const deployment_auto_inactivate = core.getInput('deployment-auto-inactivate', notRequiredArgOptions) == 'true';
  const entity = core.getInput('entity', requiredArgOptions);
  const instance = core.getInput('instance', requiredArgOptions);
  const workflow_run_url = core.getInput('workflow-run-url', requiredArgOptions);
  const owner = github.context.repo.owner;
  const repo = github.context.repo.repo;

  return new context(
    workflow_actor,
    token,
    environment,
    release_ref,
    deployment_status,
    deployment_description,
    deployment_auto_inactivate,
    entity,
    instance,
    workflow_run_url,
    owner,
    repo
  );
}

module.exports = {
  setup
};
