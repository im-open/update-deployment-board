# update-deployment-board

This action creates a visual representation of deployments on a Project board in your GitHub repository.  When this action is included in a workflow that does a deployment it will generate or update an existing issue and include it on the specified project board.  

<kbd><img src="./docs/project-board.png"></img></kbd>

When the action runs it will label the issue with two labels
  1. `🚀currently-in-<dev|qa|stage|prod|other-provided-env>` 
     - This label makes it visually easy to see which branch, tag or SHA was most recently deployed to a specific environment and it is meant to stay with the card representing code that is currently deployed to that environment.  
     - In the screenshot above, the issue for `Tag Deploy: v2.1` has the labels for `🚀currently-in-qa` and `🚀currently-in-stage` because that code is deployed to both environments.  The label will stay on a card even if it moves to another column until a different branch, tag or SHA is deployed to that environment.
  2. Deployment Status `success|failure|skipped|cancelled`. 
     - The status matches the possible values for step outcomes and this cannot be changed. 


The issue will contain a list of deployments for the ref which include the environment, a link to the workflow run, the status, date of deployment and the actor who kicked off the workflow.  
<kbd><img src="./docs/issue-details.png"></img></kbd>


## Project Board
Before using this action, a Project board must be set up.
- The board will need one column per environment and the name should match the environments you will provide with the action.
  - If the columns don't exist or don't match the environment name used with the action, it will fail.
- The board on this repository can be cloned by opening [the board], opening the `≡ Menu`, clicking on the `...` then selecting `Copy`.
  - Chose a new Owner by typing in the owner/repository you want to add the board to.
  - Update the board name and description if desired.
  - Once the board has been copied over update, delete or add columns as necessary.

If the repository has multiple deployables, like a database and app service, separate boards can be set up for each.

## Action Conventions
- The action assumes the repository where issues are created and updated is the repository where the action is run.
- The action will check to see if certain labels exist in the repository and create them if they don't.
- When an issue is generated a comment is added tagging the GitHub login responsible for creating that issue, this defaults to `@github-actions` unless another login is specified.  The intent of this comment is to cut down on the number of issues and data the action has to process when looking for an existing issue to update.  
- The action will only look through the last 100 issues that meet its search criteria to find what it needs.
- Using `continue-on-error: 'true'` may be helpful for this step since you might not want the job or workflow to fail if the board did not update correctly.
- When the `ref-type` argument is not provided the action will do some regex pattern matching to try to find the right ref type.  It will check in this order:
  - SHA: `/\b([0-9a-f]{40})\b/g`
     - Matches - a full SHA from your git commit
  - Tag: `/^(v?\d+(?:\.\d+)*.*)$/g`
     - Matches:
       - v1, v1.0, v1.0.0, v1.0.0-test1
       - 2, 2.0, 2.0.0, 2.0.0-test2
  - Branch: Default when the SHA or Tag pattern do not match

    

## Inputs
| Parameter       | Is Required | Description                                                                                                                                                                                                                      |
| --------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `github-token`  | true        | A token with permissions to create and update issues.                                                                                                                                                                            |
| `github-login`  | false       | The login associated with the github-token.  Defaults to github-actions but should be updated if a different account owns the token provided.                                                                                    |
| `environment`   | true        | The environment the branch, tag or SHA was deployed to.                                                                                                                                                                          |
| `board-number`  | true        | The number of the project board that will be updated.  Can be found by using the number in the board's url. <br/><br/> For example the number would be 1 for:<br/>https://github.com/im-open/update-deployment-board/projects/1. |
| `ref`           | true        | The branch, tag or SHA that was deployed.                                                                                                                                                                                        |
| `ref-type`      | false       | The type of ref that was deployed.  If not provided the action will use some regex patterns to try to identify the type.  <br/><br/>Possible Values: *branch, tag, sha*                                                          |
| `deploy-status` | true        | The status of the deployment.  <br/><br/>Possible Values: *success, failure, cancelled, skipped*                                                                                                                                 |
| `timezone`      | false       | IANA time zone name (e.g. America/Denver) to display dates in.  If time zone is not provided, dates will be shown in UTC                                                                                                         |



## Example

```yml
name: Manually Deploy to QA
on:
  workflow_dispatch:
    inputs:
      branchTagOrSha:
        description: 'The branch, tag or sha to deploy '
        required: false
      refType:
        description: 'The ref type (branch, tag, sha)'
        required: false  

jobs:
  environment: 'QA'
  deploy-different-ways:
    runs-on: [self-hosted, ubuntu-20.04]
    steps:
      - uses: actions/checkout@v2

      - id: deploy-to-qa
        continue-on-error: true  #Setting to true so the deployment board can be updated, even if this fails
        run: |
          ./deploy-to-qa.sh
        
        # Defaults to using github-actions for the login, regex matching to determine the ref-type and times shown in UTC
      - name: Update deployment board with Defaults
        id: defaults
        continue-on-error: true                             # Setting to true so the job doesn't fail if updating the board fails.
        uses: im-open/update-deployment-board@v1.0.0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN}}          # If a different token is used, update github-login with the corresponding account
          environment: 'QA'
          board-number: 1
          ref: ${{ github.event.inputs.branchTagOrSha }}
          deploy-status: ${{ steps.deploy-to-qa.outcome }}  # outcome is the result of the step before continue-on-error is applied
      
      - name: Update deployment board with all values provided
        id: provided
        continue-on-error: true                             # Setting to true so the job doesn't fail if updating the board fails.
        uses: im-open/update-deployment-board@v1.0.0
        with:
          github-token: ${{ secrets.BOT_TOKEN}}             # If a different token is used, update github-login with the corresponding account
          github-login: 'my-bot'
          environment: 'QA'
          board-number: 1
          ref: 'feature-branch-16'
          ref-type: 'branch' 
          deploy-status: ${{ steps.deploy-to-qa.outcome }}  # outcome is the result of the step before continue-on-error is applied
          timezone: 'america/denver'
      
      - name: Now Fail the job if the deploy step failed 
        if: steps.deploy-to-qa.outcome == 'failure' 
        run: exit 1
```

## Recompiling

If changes are made to the action's code in this repository, or its dependencies, you will need to re-compile the action.

```sh
# Installs dependencies and bundles the code
npm run build

# Bundle the code (if dependencies are already installed)
npm run bundle
```

These commands utilize [esbuild](https://esbuild.github.io/getting-started/#bundling-for-node) to bundle the action and
its dependencies into a single file located in the `dist` folder.

## Code of Conduct

This project has adopted the [im-open's Code of Conduct](https://github.com/im-open/.github/blob/master/CODE_OF_CONDUCT.md).

## License

Copyright &copy; 2021, Extend Health, LLC. Code released under the [MIT license](LICENSE).

[the board]: https://github.com/im-open/update-deployment-board/projects/1