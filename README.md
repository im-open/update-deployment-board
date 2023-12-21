# update-deployment-board

This action creates GitHub Deployment and Deployment Status records.  It can be used in conjuction with tooling that read GitHub deployments and see the disposition of deployments.

## Index <!-- omit in toc -->

- [Inputs](#inputs)
- [Outputs](#outputs)
- [Usage Example](#usage-example)
- [Contributing](#contributing)
  - [Incrementing the Version](#incrementing-the-version)
  - [Source Code Changes](#source-code-changes)
  - [Recompiling Manually](#recompiling-manually)
  - [Updating the README.md](#updating-the-readmemd)
- [Code of Conduct](#code-of-conduct)
- [License](#license)


When the action runs it will add a deployment and deployment status record to the repo.

## Inputs

| Parameter            | Is Required | Description                                                                                               |
| -------------------- | ----------- | --------------------------------------------------------------------------------------------------------- |
| `github-token`       | true        | A token with permissions to create and update issues                                                      |
| `environment`        | true        | The environment the branch, tag or SHA was deployed to, i.e. [DEV\|QA\|STAGE\|DEMO\|UAT\|PROD]            |
| `project-slug`       | true        | The repo the deployment will be created in, i.e. [org\|owner]/[repo name]                                 |
| `ref`                | true        | The branch, tag or SHA that was deployed                                                                  |
| `deploy-status`      | true        | The status of the deployment [error\|failure\|success]                                                    |
| `deployment-message` | false       | Any message to be delivered along side of the status                                                      |
| `entities`           | true        | The entities that are affected by the deployment, i.e. ["proj-app", "proj-infrastruction", "proj-db"]     |
| `instance`           | true        | The target deployment server or app service and availability zone, i.e. "NA26", "NA26-slot1", "NA27-blue" |
| `workflow-run-url`   | true        | The url of the workflow run, i.e."https://github.com/[owner]/[repo]/actions/runs/[workflow run id]"       |

## Outputs

| Parameter              | Description                              |
| ---------------------- | ---------------------------------------- |
| `github-deployment-id` | The GitHub id of the workflow deployment |

## Usage Example

```yml
name: Manually Deploy to QA
on:
  workflow_dispatch:
    inputs:
      branchTagOrSha:
        description: 'The branch, tag or sha to deploy '
        required: false

jobs:
  environment: 'QA'
  deploy-different-ways:
    runs-on: [ubuntu-20.04]
    steps:
      - uses: actions/checkout@v3

      - id: deploy-to-qa
        continue-on-error: true  #Setting to true so the deployment board can be updated, even if this fails
        run: |
          ./deploy-to-qa.sh

        # Defaults to using github-actions for the login, regex matching to determine the ref-type and times shown in UTC
      - name: Update deployment board with Defaults
        id: defaults
        continue-on-error: true                                  # Setting to true so the job doesn't fail if updating the board fails.
        uses: im-open/update-deployment-board@v2.0.0             # You may also reference just the major or major.minor version
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}              # If a different token is used, update github-login with the corresponding account
          environment: 'QA'
          project-slug: ${{ github.repository }}                 # Expects [org|owner]/[repo name]
          ref: ${{ github.event.inputs.branchTagOrSha }}
          deploy-status: ${{ steps.deploy-to-qa.outcome }}       # outcome is the result of the step before continue-on-error is applied, i.e. [error|failure|success]
          deployment-message: ${{ steps.deploy-to-qa.outcome }}  # information that may add supporting information to the status/result
          entities: '["tech-hub-git-hub-deployments-experiment"]'
          instance: ${{ inputs.instance }}
          workflow-run-url: '${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}'

      - name: Now Fail the job if the deploy step failed
        if: steps.deploy-to-qa.outcome == 'failure'
        run: exit 1
```

## Contributing

When creating PRs, please review the following guidelines:

- [ ] The action code does not contain sensitive information.
- [ ] At least one of the commit messages contains the appropriate `+semver:` keywords listed under [Incrementing the Version] for major and minor increments.
- [ ] The action has been recompiled.  See [Recompiling Manually] for details.
- [ ] The README.md has been updated with the latest version of the action.  See [Updating the README.md] for details.

### Incrementing the Version

This repo uses [git-version-lite] in its workflows to examine commit messages to determine whether to perform a major, minor or patch increment on merge if [source code] changes have been made.  The following table provides the fragment that should be included in a commit message to active different increment strategies.

| Increment Type | Commit Message Fragment                     |
| -------------- | ------------------------------------------- |
| major          | +semver:breaking                            |
| major          | +semver:major                               |
| minor          | +semver:feature                             |
| minor          | +semver:minor                               |
| patch          | *default increment type, no comment needed* |

### Source Code Changes

The files and directories that are considered source code are listed in the `files-with-code` and `dirs-with-code` arguments in both the [build-and-review-pr] and [increment-version-on-merge] workflows.

If a PR contains source code changes, the README.md should be updated with the latest action version and the action should be recompiled.  The [build-and-review-pr] workflow will ensure these steps are performed when they are required.  The workflow will provide instructions for completing these steps if the PR Author does not initially complete them.

If a PR consists solely of non-source code changes like changes to the `README.md` or workflows under `./.github/workflows`, version updates and recompiles do not need to be performed.

### Recompiling Manually

This command utilizes [esbuild] to bundle the action and its dependencies into a single file located in the `dist` folder.  If changes are made to the action's [source code], the action must be recompiled by running the following command:

```sh
# Installs dependencies and bundles the code
npm run build
```

### Updating the README.md

If changes are made to the action's [source code], the [usage examples] section of this file should be updated with the next version of the action.  Each instance of this action should be updated.  This helps users know what the latest tag is without having to navigate to the Tags page of the repository.  See [Incrementing the Version] for details on how to determine what the next version will be or consult the first workflow run for the PR which will also calculate the next version.

## Code of Conduct

This project has adopted the [im-open's Code of Conduct](https://github.com/im-open/.github/blob/main/CODE_OF_CONDUCT.md).

## License

Copyright &copy; 2023, Extend Health, LLC. Code released under the [MIT license](LICENSE).

<!-- Links -->
[Incrementing the Version]: #incrementing-the-version
[Recompiling Manually]: #recompiling-manually
[Updating the README.md]: #updating-the-readmemd
[source code]: #source-code-changes
[usage examples]: #usage-examples
[build-and-review-pr]: ./.github/workflows/build-and-review-pr.yml
[increment-version-on-merge]: ./.github/workflows/increment-version-on-merge.yml
[esbuild]: https://esbuild.github.io/getting-started/#bundling-for-node
[git-version-lite]: https://github.com/im-open/git-version-lite
[the board]: https://github.com/im-open/update-deployment-board/projects/1
[cleanup-deployment-board]: https://github.com/im-open/cleanup-deployment-board
