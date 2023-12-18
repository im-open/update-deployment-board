# update-deployment-board

This action creates a visual representation of deployments on a Project board in your GitHub repository.  When this action is included in a workflow that does a deployment it will generate or update an existing issue and include it on the specified project board.  

## DEPRECATION NOTICE

This action was implemented as a visual way to represent our deployments and we looked forward to GitHub creating a native feature that represented deployments to environments more accurately than just reporting which GitHub environments had been accessed.  The initial work used GitHub Projects which are now considered Classic Projects.  The API this action utilizes is not compatible with the new Issues and Projects so this action will be deprecated in the near future.  We haven't found a suitable alternative within GitHub so our focus will be on an external solution at this time.

## Index <!-- omit in toc -->

- [update-deployment-board](#update-deployment-board)
  - [DEPRECATION NOTICE](#deprecation-notice)
  - [Project Board](#project-board)
  - [Action Conventions](#action-conventions)
  - [Inputs](#inputs)
  - [Usage Examples](#usage-examples)
  - [Contributing](#contributing)
    - [Incrementing the Version](#incrementing-the-version)
    - [Source Code Changes](#source-code-changes)
    - [Recompiling Manually](#recompiling-manually)
    - [Updating the README.md](#updating-the-readmemd)
  - [Code of Conduct](#code-of-conduct)
  - [License](#license)
  

When the action runs it will add a deployment and deployment status record to the repo.

## Inputs

| Parameter               | Is Required | Default Value | Description |
|-------------------------|-------------|---------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `github-token`          | true        | None | A token with permissions to create and update issues.  |
| `github-login`          | false       | None | The login associated with the github-token.  Defaults to github-actions but should be updated if a different account owns the token provided.  |
| `environment`           | true        | None | The environment the branch, tag or SHA was deployed to.   |
| `board-number`          | true        | None | The number of the project board that will be updated.  Can be found by using the number in the board's url. <br/><br/> For example the number would be 1 for:<br/><https://github.com/im-open/update-deployment-board/projects/1>. |
| `ref`                   | true        | None | The branch, tag or SHA that was deployed.  |
| `ref-type`              | false       | None | The type of ref that was deployed.  If not provided the action will use some regex patterns to try to identify the type.  <br/><br/>Possible Values: *branch, tag, sha* |
| `deployable-type`       | false       | None | String indicating the type of deployable item (*like API, BFF, MFE, SVC, DB, etc*).<br/><br/>In repositories with multiple deployable artifacts that are deployed separately but use the same release number this arg is the mechanism for creating separate issues to track the deployment of each separate type.<br/><br/>  When provided, this will be added to the beginning of the issue title. |
| `deploy-status`         | true        | None | The status of the deployment.  <br/><br/>Possible Values: *success, failure, cancelled, skipped*  |
| `deploy-label`          | false       | None | The optional label of the deployment <br/><br/>Possible Values: *deleted, destroyed, your-custom-label*      |
| `enable-deployment-slot-tracking`   | false | `false` | Enable App Service deployment slot tracking on deployment board. <br/><br/>Possible Values: *true,false*    |
| `slot-swapped-with-production-slot:`| false | `false` | Did this deployment swap slots with production? <br/><br/>Possible Values: *true,false*      |
| `target-slot`    | false       | `production` | The target slot that was deployed. <br/><br/>Possible Values: *production,predeploy,blue,yellow,canary,red,loadtest,your-custom-slot*      |
| `source-slot`    | false       | `production` | The source slot that was deployed. <br/><br/>Possible Values: *production,predeploy,blue,yellow,canary,red,loadtest,your-custom-slot*      |
| `timezone`       | false       | None | IANA time zone name (e.g. America/Denver) to display dates in.  If time zone is not provided, dates will be shown in UTC   |

## Usage Examples

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
        continue-on-error: true                             # Setting to true so the job doesn't fail if updating the board fails.
        uses: im-open/update-deployment-board@v1.7.0        # You may also reference just the major or major.minor version
        with:
          github-token: ${{ secrets.GITHUB_TOKEN}}          # If a different token is used, update github-login with the corresponding account
          environment: 'QA'
          board-number: 1
          ref: ${{ github.event.inputs.branchTagOrSha }}
          deploy-status: ${{ steps.deploy-to-qa.outcome }}  # outcome is the result of the step before continue-on-error is applied
      
      - name: Update deployment board with all values provided
        id: provided
        continue-on-error: true                             # Setting to true so the job doesn't fail if updating the board fails.
        uses: im-open/update-deployment-board@v1.7.0
        with:
          github-token: ${{ secrets.BOT_TOKEN}}             # Since a different token is used, the github-login should be set to the corresponding acct
          github-login: 'my-bot'
          environment: 'QA'
          board-number: 1
          ref: 'feature-branch-16'
          ref-type: 'branch' 
          deploy-status: ${{ steps.deploy-to-qa.outcome }}  # outcome is the result of the step before continue-on-error is applied
          deploy-label: 'deleted' # Custom label to show status for slot deletion and terraform destroy deployments
          enable-deployment-slot-tracking: true
          slot-swapped-with-production-slot: true
          target-slot: 'production'
          source-slot: 'predeploy'
          timezone: 'america/denver'

      - name: Update deployment board with app service slot deploy no swap
        id: provided
        continue-on-error: true                             # Setting to true so the job doesn't fail if updating the board fails.
        uses: im-open/update-deployment-board@v1.7.0
        with:
          github-token: ${{ secrets.BOT_TOKEN}}             # Since a different token is used, the github-login should be set to the corresponding acct
          github-login: 'my-bot'
          environment: 'QA'
          board-number: 1
          ref: 'feature-branch-16'
          ref-type: 'branch' 
          deploy-status: ${{ steps.deploy-to-qa.outcome }}  # outcome is the result of the step before continue-on-error is applied
          enable-deployment-slot-tracking: true
          slot-swapped-with-production-slot: false
          target-slot: 'predeploy'
          source-slot: 'predeploy'
          timezone: 'america/denver'

      - name: Update deployment board with app service slot deploy with swap
        id: provided
        continue-on-error: true                             # Setting to true so the job doesn't fail if updating the board fails.
        uses: im-open/update-deployment-board@v1.7.0
        with:
          github-token: ${{ secrets.BOT_TOKEN}}             # Since a different token is used, the github-login should be set to the corresponding acct
          github-login: 'my-bot'
          environment: 'QA'
          board-number: 1
          ref: 'feature-branch-16'
          ref-type: 'branch' 
          deploy-status: ${{ steps.deploy-to-qa.outcome }}  # outcome is the result of the step before continue-on-error is applied
          enable-deployment-slot-tracking: true
          slot-swapped-with-production-slot: true
          target-slot: 'production'
          source-slot: 'predeploy'
          timezone: 'america/denver'

      - name: Update deployment board with app service slot delete
        id: provided
        continue-on-error: true                             # Setting to true so the job doesn't fail if updating the board fails.
        uses: im-open/update-deployment-board@v1.7.0
        with:
          github-token: ${{ secrets.BOT_TOKEN}}             # Since a different token is used, the github-login should be set to the corresponding acct
          github-login: 'my-bot'
          environment: 'QA'
          board-number: 1
          ref: 'feature-branch-16'
          ref-type: 'branch' 
          deploy-status: ${{ steps.deploy-to-qa.outcome }}  # outcome is the result of the step before continue-on-error is applied
          deploy-label: 'deleted' # Custom label to show status for slot deletion and terraform destroy deployments
          enable-deployment-slot-tracking: true
          slot-swapped-with-production-slot: false
          target-slot: 'blue'
          source-slot: 'blue'
          timezone: 'america/denver'
      
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
|----------------|---------------------------------------------|
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
