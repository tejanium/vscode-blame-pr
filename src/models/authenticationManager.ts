import * as vscode from "vscode";
import { CachedGithub } from "./cachedGithub";

export class AuthenticationManager {
  private static cachedSession: vscode.AuthenticationSession | null = null;
  private static cachedOAuthGithub: CachedGithub | null = null;
  private static cachedPublicGithub: CachedGithub | null = null;

  constructor(private cache: any) {}

  async getOAuthGithub(): Promise<CachedGithub | null> {
    if (
      AuthenticationManager.cachedSession &&
      AuthenticationManager.cachedOAuthGithub
    ) {
      try {
        if (AuthenticationManager.cachedSession.accessToken) {
          return AuthenticationManager.cachedOAuthGithub;
        }
      } catch {
        AuthenticationManager.cachedSession = null;
        AuthenticationManager.cachedOAuthGithub = null;
      }
    }

    try {
      const session = await vscode.authentication.getSession(
        "github",
        ["repo"],
        { createIfNone: true }
      );

      if (session?.accessToken) {
        AuthenticationManager.cachedSession = session;
        AuthenticationManager.cachedOAuthGithub = new CachedGithub(
          this.cache,
          session.accessToken
        );
        return AuthenticationManager.cachedOAuthGithub;
      }
    } catch {
      AuthenticationManager.cachedSession = null;
      AuthenticationManager.cachedOAuthGithub = null;
    }

    return null;
  }

  getPublicGithub(): CachedGithub {
    if (!AuthenticationManager.cachedPublicGithub) {
      AuthenticationManager.cachedPublicGithub = new CachedGithub(
        this.cache,
        undefined
      );
    }
    return AuthenticationManager.cachedPublicGithub;
  }

  static clearCache(): void {
    AuthenticationManager.cachedSession = null;
    AuthenticationManager.cachedOAuthGithub = null;
    AuthenticationManager.cachedPublicGithub = null;
  }
}
