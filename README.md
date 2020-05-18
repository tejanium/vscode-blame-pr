# VS Code Blame PR

[![Build Status](https://dev.azure.com/tejanium/vscode-blame-pr/_apis/build/status/tejanium.vscode-blame-pr?branchName=master)](https://dev.azure.com/tejanium/vscode-blame-pr/_build/latest?definitionId=1&branchName=master)

## Features

Open Github's associated PR by guessing the PR's ID from the commit message or contacting Github using your personal access token.

To activate: place cursor where you want to know in which PR the code was introduced, open Command Palette then type `blame-pr.open`.

Preview:

<img src='https://raw.githubusercontent.com/tejanium/vscode-blame-pr/master/img/preview.gif'>

## Extension Settings

* `blame-pr.githubToken`: Github personal access token with scope to repo.
  <img src='https://raw.githubusercontent.com/tejanium/vscode-blame-pr/master/img/token.png' width='50%'>

### 1.0.0

Initial release
