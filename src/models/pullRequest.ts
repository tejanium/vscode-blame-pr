import * as vscode from "vscode";
import { dirname } from "path";
import { CachedGit } from "./cachedGit";
import { AuthenticationManager } from "./authenticationManager";
import { CommitCache } from "./commitCache";

export class PullRequest {
  private fileName: string;
  private lineNumber: number;
  private git: CachedGit;
  private authManager: AuthenticationManager;

  constructor(private editor: vscode.TextEditor, private cache: any) {
    this.fileName = editor.document.fileName;
    this.lineNumber = editor.selection.active.line + 1;
    this.git = new CachedGit(this.cache, dirname(this.fileName));
    this.authManager = new AuthenticationManager(cache);
  }

  async info(): Promise<{
    domain: string;
    owner: string;
    name: string;
    sha: string;
    PRId: string | undefined;
  }> {
    const { domain, owner, name } = await this.git.config();

    let lineContent: string | undefined;
    try {
      lineContent = this.editor.document.lineAt(this.lineNumber - 1).text;
    } catch {
      lineContent = undefined;
    }

    const { sha, commitMessage } = await this.git.blame(
      this.fileName,
      this.lineNumber,
      lineContent
    );

    const PRId =
      this.localID(commitMessage) ||
      (await CommitCache.getCachedPRId(owner, name, sha, () =>
        this.remoteID(owner, name, sha)
      ));

    return { domain, owner, name, sha, PRId };
  }

  private localID(commitMessage: string): string | undefined {
    return commitMessage
      ?.match(/\#[0-9]+/g)
      ?.pop()
      ?.replace("#", "");
  }

  private async remoteID(
    owner: string,
    name: string,
    sha: string
  ): Promise<string | undefined> {
    const useOAuth =
      vscode.workspace
        .getConfiguration("blame-pr")
        .get<boolean>("useOAuth", false) || process.env.BLAME_PR_TEST !== "1";

    if (useOAuth) {
      const github = await this.authManager.getOAuthGithub();
      if (github) {
        return github.pullRequestID(owner, name, sha);
      }
    }

    const github = this.authManager.getPublicGithub();
    return github.pullRequestID(owner, name, sha);
  }

  static clearAuthCache(): void {
    AuthenticationManager.clearCache();
    CommitCache.clear();
  }
}
