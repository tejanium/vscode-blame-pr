import { graphql } from '@octokit/graphql';
import { GraphQlQueryResponseData } from '@octokit/graphql/dist-types/types';

export class Github {
	constructor(private token: string | unknown) { }

	async pullRequestID(owner: string, name: string, sha: string): Promise<string | undefined> {
		const query = this.query(owner, name, sha);
		const { commit } = await this.api(query);

		return commit?.associatedPullRequests.edges[0]?.node.number;
	}

	private async api(query: string): Promise<GraphQlQueryResponseData> {
		if (!this.token) {
			throw Error('Github personal access token is missing');
		}

		try {
			const { repository } = await graphql(query, { headers: { authorization: `token ${this.token}` } });

			return repository || {};
		} catch (error) {
			throw Error('Cannot contact Github');
		}
	}

	private query(owner: string, name: string, sha: string): string {
		return `{
			repository(owner: "${owner}", name: "${name}") {
				commit: object(expression: "${sha}") {
					... on Commit {
						associatedPullRequests(first:1) {
							edges{
								node{
									number
								}
							}
						}
					}
				}
			}
		}`;
	}
}
