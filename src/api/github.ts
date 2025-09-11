import * as https from "https";

export class Github {
  private static readonly REQUEST_TIMEOUT = 5000; // 5 seconds timeout
  private static readonly agent = new https.Agent({
    keepAlive: true,
    maxSockets: 5,
    maxFreeSockets: 2,
    timeout: Github.REQUEST_TIMEOUT,
  });

  constructor(private token: string | unknown) {}

  async pullRequestID(
    owner: string,
    name: string,
    sha: string
  ): Promise<string | undefined> {
    // Use REST API - simpler, faster, and works for all cases
    return this.pullRequestIDByCommitREST(owner, name, sha);
  }

  async pullRequestIDByCommitREST(
    owner: string,
    name: string,
    sha: string
  ): Promise<string | undefined> {
    const path = `/repos/${owner}/${name}/commits/${sha}/pulls`;
    const response = await this.rest<Array<{ number: number }>>(path);

    if (Array.isArray(response) && response.length > 0) {
      // Get the first (most recent) PR number
      const prNumber = response[0]?.number;
      return prNumber ? String(prNumber) : undefined;
    }

    return undefined;
  }

  private async rest<T>(path: string): Promise<T | undefined> {
    const headers: Record<string, string> = {
      "User-Agent": "vscode-blame-pr",
      Accept: "application/vnd.github+json",
    };

    if (this.token) {
      headers["Authorization"] = `token ${this.token as string}`;
    }

    const options: https.RequestOptions = {
      hostname: "api.github.com",
      method: "GET",
      path,
      headers,
      timeout: Github.REQUEST_TIMEOUT,
      agent: Github.agent, // Reuse connections
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = "";

        res.on("data", (chunk) => {
          body += chunk;
        });

        res.on("end", () => {
          const ok =
            res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
          if (!ok) {
            resolve(undefined);
            return;
          }

          try {
            const json = JSON.parse(body);
            resolve(json as T);
          } catch (_e) {
            resolve(undefined);
          }
        });
      });

      req.on("error", () => resolve(undefined));
      req.on("timeout", () => {
        req.destroy();
        resolve(undefined);
      });

      req.setTimeout(Github.REQUEST_TIMEOUT);
      req.end();
    });
  }
}
