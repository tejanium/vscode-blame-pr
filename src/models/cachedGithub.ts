import { Github } from "../api/github";
import { Cached } from "./cached";

export class CachedGithub extends Cached {
  private github: Github;

  constructor(cache: any, private token: string | unknown) {
    super(cache);
    this.github = new Github(token);
  }

  async pullRequestID(
    owner: string,
    name: string,
    sha: string
  ): Promise<string | undefined> {
    // Better cache key includes repo info for cross-repo scenarios
    const key = ["github", owner, name, sha].join(":");

    return this.fetch(
      key,
      async () => {
        // The Github class now handles REST-only requests
        return this.github.pullRequestID(owner, name, sha);
      },
      Infinity
    ); // Never expire SHA-based cache (SHA is immutable)
  }
}
