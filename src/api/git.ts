import simpleGit, { SimpleGit } from "simple-git";

export class Git {
  private git: SimpleGit;

  constructor(private cwd: string) {
    this.git = simpleGit({ baseDir: this.cwd });
  }

  async config(): Promise<{ domain: string; owner: string; name: string }> {
    const args = ["config", "--get", "remote.origin.url"];

    try {
      const config = await this.git.raw(args);

      return this.parseConfig(config);
    } catch (error: unknown) {
      const err = error as any;
      if (
        typeof err?.message === "string" &&
        err.message.includes("exit code 1")
      ) {
        (err as any).code = 1;
      }
      if ((err as any).code === 1) {
        throw new Error("Git has no remote info", { cause: error });
      }

      throw new Error(String(err.message), { cause: error });
    }
  }

  async blame(
    fileName: string,
    lineNumber: number,
  ): Promise<{ sha: string; author: string; commitMessage: string }> {
    const args = ["blame", "-p", fileName, "-L", `${lineNumber},${lineNumber}`];
    const blame = await this.git.raw(args);

    return this.parseBlame(blame);
  }

  async blameFile(
    fileName: string,
  ): Promise<Array<{ sha: string; author: string; commitMessage: string }>> {
    const args = ["blame", "-p", fileName];
    const blame = await this.git.raw(args);

    return this.parseFileBlame(blame);
  }

  private parseConfig(output: string): {
    domain: string;
    owner: string;
    name: string;
  } {
    const normalizedOutput = output
      .replace(/(\s+|git@|http(s)?:\/\/|\.git)/g, "")
      .replace(":", "/");

    let domain, owner, name;

    if (normalizedOutput) {
      [domain, owner, name] = normalizedOutput.split("/");
    } else {
      throw Error("Could not get Git info, please try a little later");
    }

    return { domain, owner, name };
  }

  private parseBlame(output: string): {
    sha: string;
    author: string;
    commitMessage: string;
  } {
    const gitOutput = output.split("\n");
    const sha = gitOutput[0].split(" ")[0];
    const author = gitOutput[1].replace("author ", "");
    const commitMessage = gitOutput[9].replace("summary ", "");

    if (sha === "0000000000000000000000000000000000000000") {
      throw Error("Not Committed Yet");
    }

    return { sha, author, commitMessage };
  }

  private parseFileBlame(
    output: string,
  ): Array<{ sha: string; author: string; commitMessage: string }> {
    const lines = output.split("\n");
    const results: Array<{
      sha: string;
      author: string;
      commitMessage: string;
    }> = [];
    const commitCache = new Map<
      string,
      { author: string; commitMessage: string }
    >();

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line) {
        i++;
        continue;
      }

      const match = line.match(/^([a-f0-9]{40})\s+\d+\s+\d+/);
      if (match) {
        const sha = match[1];

        if (sha === "0000000000000000000000000000000000000000") {
          results.push({ sha, author: "", commitMessage: "Not Committed Yet" });
          i++;
          continue;
        }

        // Check if we already have this commit's info
        let commitInfo = commitCache.get(sha);

        if (!commitInfo) {
          // Parse commit info from the following lines
          let author = "";
          let commitMessage = "";

          // Look ahead for author and summary lines
          for (let j = i + 1; j < lines.length && j < i + 15; j++) {
            const infoLine = lines[j];
            if (infoLine.startsWith("author ")) {
              author = infoLine.replace("author ", "");
            } else if (infoLine.startsWith("summary ")) {
              commitMessage = infoLine.replace("summary ", "");
              break;
            }
          }

          commitInfo = { author, commitMessage };
          commitCache.set(sha, commitInfo);
        }

        results.push({ sha, ...commitInfo });
      }

      i++;
    }

    return results;
  }
}
