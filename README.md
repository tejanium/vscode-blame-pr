# VSCode Blame Github's Pull Request

[![CI](https://github.com/tejanium/vscode-blame-pr/actions/workflows/ci.yml/badge.svg)](https://github.com/tejanium/vscode-blame-pr/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/tejanium/vscode-blame-pr)](https://github.com/tejanium/vscode-blame-pr/releases)
[![Open VSX](https://img.shields.io/open-vsx/v/tejanium/blame-pr?label=Open%20VSX)](https://open-vsx.org/extension/tejanium/blame-pr)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/tejanium.blame-pr)](https://marketplace.visualstudio.com/items?itemName=tejanium.blame-pr)

## Features

Open Github's associated PR by guessing the PR's ID from the commit message or asking GitHub via your VS Code GitHub sign-in.

To activate, enter these commands in the Command Palette:

- `blame-pr.open`: Open and view Github Pull Request on your browser on the selected line.

  <img src='https://raw.githubusercontent.com/tejanium/vscode-blame-pr/master/img/preview.gif'>

- `blame-pr.toggleStatusbar`: Display commit message info in the status bar, click to activate `blame-pr.open`.

  <img src='https://raw.githubusercontent.com/tejanium/vscode-blame-pr/master/img/statusbar.png'>

## Extension Settings

- `blame-pr.useOAuth`: Use GitHub OAuth (via VS Code auth). If false, only public data is used.
- `blame-pr.enablePrefetch`: Enable cursor-based prefetching for instant toolbar responses. Prefetches PR data when you dwell on a line.

## Development

Requires [Bun](https://bun.sh) and Node 24 (see `.node-version`).

```sh
bun install
bun run check      # typecheck, lint, format check, tests
bun run compile    # bundle to dist/
bun run package    # build the .vsix
```

### Releasing

Push a `v*` tag. The release workflow builds the `.vsix`, attaches it to a GitHub release, and publishes to the VS Code Marketplace when `VSCE_PAT` is set and to [Open VSX](https://open-vsx.org) when `OVSX_PAT` is set. Both are repository secrets.

Open VSX needs the `tejanium` namespace created once, with a token from your Open VSX profile:

```sh
bunx ovsx create-namespace tejanium -p <token>
```

Press F5 in VS Code to launch the extension in a development host.
