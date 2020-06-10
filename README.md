# VSCode Blame Github's Pull Request

[![Build Status](https://dev.azure.com/tejanium/vscode-blame-pr/_apis/build/status/tejanium.vscode-blame-pr?branchName=master)](https://dev.azure.com/tejanium/vscode-blame-pr/_build/latest?definitionId=3&branchName=master)
[![David](https://img.shields.io/david/tejanium/vscode-blame-pr)](https://david-dm.org/tejanium/vscode-blame-pr)
[![David](https://img.shields.io/david/dev/tejanium/vscode-blame-pr)](https://david-dm.org/tejanium/vscode-blame-pr?type=dev)
[![GitHub release](https://img.shields.io/github/v/release/tejanium/vscode-blame-pr)](https://github.com/tejanium/vscode-blame-pr/releases)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/tejanium.blame-pr)](https://marketplace.visualstudio.com/items?itemName=tejanium.blame-pr)

## Features

Open Github's associated PR by guessing the PR's ID from the commit message or contacting Github using your personal access token.

To activate, enter these commands in the Command Palette:

- `blame-pr.open`: Open and view Github Pull Request on your browser on the selected line.

  <img src='https://raw.githubusercontent.com/tejanium/vscode-blame-pr/master/img/preview.gif'>

- `blame-pr.toggleStatusbar`: Display commit message info in the status bar, click to activate `blame-pr.open`.

  <img src='https://raw.githubusercontent.com/tejanium/vscode-blame-pr/master/img/statusbar.png'>

## Extension Settings

* `blame-pr.githubToken`: Github personal access token with scope to repo.
  <img src='https://raw.githubusercontent.com/tejanium/vscode-blame-pr/master/img/token.png' width='50%'>
