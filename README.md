# VSCode Blame Github's Pull Request

[![Build Status](https://dev.azure.com/tejanium/vscode-blame-pr/_apis/build/status/tejanium.vscode-blame-pr?branchName=master)](https://dev.azure.com/tejanium/vscode-blame-pr/_build/latest?definitionId=1&branchName=master)
[![David](https://img.shields.io/david/tejanium/vscode-blame-pr)](https://david-dm.org/tejanium/vscode-blame-pr)
[![David](https://img.shields.io/david/dev/tejanium/vscode-blame-pr)](https://david-dm.org/tejanium/vscode-blame-pr?type=dev)
[![GitHub release](https://img.shields.io/github/v/release/tejanium/vscode-blame-pr)](https://github.com/tejanium/vscode-blame-pr/releases)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/tejanium.blame-pr)](https://marketplace.visualstudio.com/items?itemName=tejanium.blame-pr)

## Features

Open Github's associated PR by guessing the PR's ID from the commit message or contacting Github using your personal access token.

To activate: place cursor where you want to know in which PR the line was introduced, open the Command Palette then type `blame-pr.open`.

Preview:

<img src='https://raw.githubusercontent.com/tejanium/vscode-blame-pr/master/img/preview.gif'>

To display the blame info in the status bar, open the Command Palette and type `blame-pr.toggleStatusbar`, click to activate `blame-pr.open`.

## Extension Settings

* `blame-pr.githubToken`: Github personal access token with scope to repo.
  <img src='https://raw.githubusercontent.com/tejanium/vscode-blame-pr/master/img/token.png' width='50%'>
