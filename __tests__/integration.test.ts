import * as vscode from "vscode";
import { CachedGit } from "../src/models/cachedGit";
import { CachedGithub } from "../src/models/cachedGithub";
import { FileBlameCache } from "../src/models/fileBlameCache";
import { PullRequest } from "../src/models/pullRequest";
import nock = require("nock");

// Mock the cached classes
jest.mock("../src/models/cachedGit");
jest.mock("../src/models/cachedGithub");
jest.mock("../src/models/fileBlameCache");

const MockedCachedGit = CachedGit as jest.MockedClass<typeof CachedGit>;
const MockedCachedGithub = CachedGithub as jest.MockedClass<
  typeof CachedGithub
>;
const MockedFileBlameCache = FileBlameCache as jest.MockedClass<
  typeof FileBlameCache
>;

interface MockGitParams {
  config?: string;
  sha?: string;
  commitMessage?: string;
  userName?: string;
}

function nockGithubResponse(status: number, response: Object | null): void {
  nock("https://api.github.com")
    .post("/graphql")
    .reply(status, {
      data: {
        repository: response,
      },
    });
}

describe("Extension Integration Tests", () => {
  let registerCommandSpy: jest.SpyInstance;
  let createStatusBarItemSpy: jest.SpyInstance;
  let openExternalSpy: jest.SpyInstance;
  let showWarningMessageSpy: jest.SpyInstance;
  let getSessionSpy: jest.SpyInstance;
  let getConfigurationSpy: jest.SpyInstance;
  let statusItem: any;
  let mockWorkspaceState: any;

  beforeAll(() => {
    // Setup vscode mocks
    (vscode as any).commands = {
      registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
      executeCommand: jest.fn(),
    };

    (vscode as any).window = {
      createStatusBarItem: jest.fn(),
      activeTextEditor: {
        document: {
          fileName: "/test/file.txt",
          uri: { scheme: "file" },
        },
        selection: {
          active: { line: 0 },
        },
      },
      showWarningMessage: jest.fn(),
      onDidChangeTextEditorSelection: jest
        .fn()
        .mockReturnValue({ dispose: jest.fn() }),
      onDidChangeActiveTextEditor: jest
        .fn()
        .mockReturnValue({ dispose: jest.fn() }),
      visibleTextEditors: [],
    };

    (vscode as any).env = { openExternal: jest.fn().mockResolvedValue(true) };

    (vscode as any).Uri = {
      parse: jest.fn((url: string) => ({ toString: () => url })),
      file: jest.fn((path: string) => ({ toString: () => path })),
    };

    (vscode as any).workspace = {
      getConfiguration: jest.fn(),
      onDidCloseTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
      createFileSystemWatcher: jest.fn().mockReturnValue({
        onDidChange: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        onDidDelete: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        dispose: jest.fn(),
      }),
      fs: {
        stat: jest.fn().mockResolvedValue({ mtime: Date.now() }),
      },
    };

    (vscode as any).authentication = {
      getSession: jest.fn(),
    };

    (vscode as any).Disposable = {
      from: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    };

    // Create spies
    registerCommandSpy = jest.spyOn(vscode.commands, "registerCommand");
    createStatusBarItemSpy = jest.spyOn(vscode.window, "createStatusBarItem");
    openExternalSpy = jest.spyOn(vscode.env, "openExternal");
    showWarningMessageSpy = jest.spyOn(vscode.window, "showWarningMessage");
    getSessionSpy = jest.spyOn(vscode.authentication, "getSession");
    getConfigurationSpy = jest.spyOn(vscode.workspace, "getConfiguration");

    // Setup status bar item mock
    statusItem = {
      text: "",
      show: jest.fn(),
      hide: jest.fn(),
    };
    createStatusBarItemSpy.mockReturnValue(statusItem);

    // Setup workspace state mock
    mockWorkspaceState = {
      get: jest.fn(),
      update: jest.fn(),
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
    MockedCachedGit.mockClear();
    MockedCachedGithub.mockClear();

    // Mock FileBlameCache singleton
    const mockFileBlameCacheInstance = {
      getBlame: jest.fn().mockResolvedValue(undefined),
      onFileOpened: jest.fn(),
      onFileClosed: jest.fn(),
      dispose: jest.fn(),
    };
    MockedFileBlameCache.getInstance = jest
      .fn()
      .mockReturnValue(mockFileBlameCacheInstance);

    PullRequest.clearAuthCache(); // Clear authentication cache between tests
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  function mockGit({
    config = "git@github.com:owner/name.git",
    sha = "sha1234567890",
    commitMessage,
    userName,
  }: MockGitParams = {}): void {
    const mockGitInstance = {
      config: jest.fn().mockImplementation(() => {
        if (!config) {
          throw new Error("Could not get Git info, please try a little later");
        }
        return Promise.resolve({
          domain: config.includes("gh-enterprise.com")
            ? "gh-enterprise.com"
            : "github.com",
          owner: "owner",
          name: "name",
        });
      }),
      getCachedBlame: jest.fn().mockReturnValue(undefined),
      blame: jest.fn().mockImplementation(() => {
        if (!config) {
          throw new Error("Could not get Git info, please try a little later");
        }
        if (sha === "0000000000000000000000000000000000000000") {
          throw new Error("Not Committed Yet");
        }
        return Promise.resolve({
          sha,
          commitMessage: commitMessage || "",
          author: userName || "",
        });
      }),
    };
    MockedCachedGit.mockImplementation(() => mockGitInstance as any);
  }

  function configureGithubToken(token: string): void {
    getConfigurationSpy.mockReturnValue({
      get: jest.fn().mockReturnValue(token),
    } as any);
  }

  describe("blame-pr.toggleStatusbar", () => {
    test("Toggle blame info in status bar", async () => {
      mockGit({ userName: "User Name", commitMessage: "Commit message (#1)" });

      // Import and activate extension
      const extension = await import("../src/extension");
      const context = { workspaceState: mockWorkspaceState, subscriptions: [] };
      await extension.activate(context as any);

      // Execute the command
      const toggleCommand = registerCommandSpy.mock.calls.find(
        (call) => call[0] === "blame-pr.toggleStatusbar"
      )[1];

      await toggleCommand();

      // Wait for debounced update (150ms + some buffer)
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(statusItem.hide).toHaveBeenCalledTimes(1);
      expect(statusItem.show).toHaveBeenCalled();
      expect(statusItem.text).toBe(
        '$(git-pull-request) User Name: "Commit message (#1)"'
      );

      await toggleCommand();
      expect(statusItem.hide).toHaveBeenCalledTimes(2);
    });
  });

  describe("blame-pr.open", () => {
    test("Get PR ID from commit message", async () => {
      mockGit({ commitMessage: "First PR (#1)" });

      // Import and activate extension
      const extension = await import("../src/extension");
      const context = { workspaceState: mockWorkspaceState, subscriptions: [] };
      await extension.activate(context as any);

      // Execute the command
      const openCommand = registerCommandSpy.mock.calls.find(
        (call) => call[0] === "blame-pr.open"
      )[1];
      await openCommand();

      expect(openExternalSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toString: expect.any(Function),
        })
      );

      const calledUrl = openExternalSpy.mock.calls[0][0].toString();
      expect(calledUrl).toBe("https://github.com/owner/name/pull/1");
    });

    test("Duplicate PR ID, usually revert", async () => {
      mockGit({ commitMessage: 'Revert "First PR (#1)" (#2)' });

      // Import and activate extension
      const extension = await import("../src/extension");
      const context = { workspaceState: mockWorkspaceState, subscriptions: [] };
      await extension.activate(context as any);

      const openCommand = registerCommandSpy.mock.calls.find(
        (call) => call[0] === "blame-pr.open"
      )[1];
      await openCommand();

      expect(openExternalSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toString: expect.any(Function),
        })
      );

      const calledUrl = openExternalSpy.mock.calls[0][0].toString();
      expect(calledUrl).toBe("https://github.com/owner/name/pull/2");
    });

    test("Get PR URL from Github enterprise", async () => {
      mockGit({
        config: "git@gh-enterprise.com:owner/name.git",
        commitMessage: "First PR (#1)",
      });

      // Import and activate extension
      const extension = await import("../src/extension");
      const context = { workspaceState: mockWorkspaceState, subscriptions: [] };
      await extension.activate(context as any);

      const openCommand = registerCommandSpy.mock.calls.find(
        (call) => call[0] === "blame-pr.open"
      )[1];
      await openCommand();

      expect(openExternalSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toString: expect.any(Function),
        })
      );

      const calledUrl = openExternalSpy.mock.calls[0][0].toString();
      expect(calledUrl).toBe("https://gh-enterprise.com/owner/name/pull/1");
    });

    test("Not yet committed", async () => {
      mockGit({ sha: "0000000000000000000000000000000000000000" });

      // Import and activate extension
      const extension = await import("../src/extension");
      const context = { workspaceState: mockWorkspaceState, subscriptions: [] };
      await extension.activate(context as any);

      const openCommand = registerCommandSpy.mock.calls.find(
        (call) => call[0] === "blame-pr.open"
      )[1];
      await openCommand();

      expect(showWarningMessageSpy).toHaveBeenCalledWith("Not Committed Yet");
    });

    test("Cannot get Git info", async () => {
      mockGit({ config: "" });

      // Import and activate extension
      const extension = await import("../src/extension");
      const context = { workspaceState: mockWorkspaceState, subscriptions: [] };
      await extension.activate(context as any);

      const openCommand = registerCommandSpy.mock.calls.find(
        (call) => call[0] === "blame-pr.open"
      )[1];
      await openCommand();

      expect(showWarningMessageSpy).toHaveBeenCalledWith(
        "Could not get Git info, please try a little later"
      );
    });

    test("Git remote is HTTP", async () => {
      mockGit({
        config: "http://github.com/owner/name.git",
        commitMessage: "First PR (#1)",
      });

      // Import and activate extension
      const extension = await import("../src/extension");
      const context = { workspaceState: mockWorkspaceState, subscriptions: [] };
      await extension.activate(context as any);

      const openCommand = registerCommandSpy.mock.calls.find(
        (call) => call[0] === "blame-pr.open"
      )[1];
      await openCommand();

      expect(openExternalSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toString: expect.any(Function),
        })
      );

      const calledUrl = openExternalSpy.mock.calls[0][0].toString();
      expect(calledUrl).toBe("https://github.com/owner/name/pull/1");
    });

    test("Git remote is HTTPS", async () => {
      mockGit({
        config: "https://github.com/owner/name.git",
        commitMessage: "First PR (#1)",
      });

      // Import and activate extension
      const extension = await import("../src/extension");
      const context = { workspaceState: mockWorkspaceState, subscriptions: [] };
      await extension.activate(context as any);

      const openCommand = registerCommandSpy.mock.calls.find(
        (call) => call[0] === "blame-pr.open"
      )[1];
      await openCommand();

      expect(openExternalSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toString: expect.any(Function),
        })
      );

      const calledUrl = openExternalSpy.mock.calls[0][0].toString();
      expect(calledUrl).toBe("https://github.com/owner/name/pull/1");
    });

    describe("Github", () => {
      beforeEach(() => {
        configureGithubToken("token");
        mockGit();
        getSessionSpy.mockResolvedValue({ accessToken: "token" } as any);
      });

      test("Getting data from github", async () => {
        const mockGithubInstance = {
          pullRequestID: jest.fn().mockResolvedValue(10),
        };
        MockedCachedGithub.mockImplementation(() => mockGithubInstance as any);

        nockGithubResponse(200, {
          commit: {
            associatedPullRequests: {
              edges: [
                {
                  node: {
                    number: 10,
                  },
                },
              ],
            },
          },
        });

        // Import and activate extension
        const extension = await import("../src/extension");
        const context = {
          workspaceState: mockWorkspaceState,
          subscriptions: [],
        };
        await extension.activate(context as any);

        const openCommand = registerCommandSpy.mock.calls.find(
          (call) => call[0] === "blame-pr.open"
        )[1];
        await openCommand();

        expect(openExternalSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            toString: expect.any(Function),
          })
        );

        const calledUrl = openExternalSpy.mock.calls[0][0].toString();
        expect(calledUrl).toBe("https://github.com/owner/name/pull/10");
      });

      test("Getting no associated PR data from github", async () => {
        const mockGithubInstance = {
          pullRequestID: jest.fn().mockResolvedValue(null),
        };
        MockedCachedGithub.mockImplementation(() => mockGithubInstance as any);

        nockGithubResponse(200, {
          commit: null,
        });

        // Import and activate extension
        const extension = await import("../src/extension");
        const context = {
          workspaceState: mockWorkspaceState,
          subscriptions: [],
        };
        await extension.activate(context as any);

        const openCommand = registerCommandSpy.mock.calls.find(
          (call) => call[0] === "blame-pr.open"
        )[1];
        await openCommand();

        expect(showWarningMessageSpy).toHaveBeenCalledWith(
          expect.stringMatching(/sha1234.*has no associated PR/),
          "Open commit URL"
        );
      });

      test("Getting empty associated PR data from github", async () => {
        const mockGithubInstance = {
          pullRequestID: jest.fn().mockResolvedValue(null),
        };
        MockedCachedGithub.mockImplementation(() => mockGithubInstance as any);

        nockGithubResponse(200, {
          commit: {
            associatedPullRequests: {
              edges: [],
            },
          },
        });

        // Import and activate extension
        const extension = await import("../src/extension");
        const context = {
          workspaceState: mockWorkspaceState,
          subscriptions: [],
        };
        await extension.activate(context as any);

        const openCommand = registerCommandSpy.mock.calls.find(
          (call) => call[0] === "blame-pr.open"
        )[1];
        await openCommand();

        expect(showWarningMessageSpy).toHaveBeenCalledWith(
          expect.stringMatching(/sha1234.*has no associated PR/),
          "Open commit URL"
        );
      });

      test("Getting no data from github", async () => {
        const mockGithubInstance = {
          pullRequestID: jest.fn().mockResolvedValue(null),
        };
        MockedCachedGithub.mockImplementation(() => mockGithubInstance as any);

        nockGithubResponse(200, null);

        // Import and activate extension
        const extension = await import("../src/extension");
        const context = {
          workspaceState: mockWorkspaceState,
          subscriptions: [],
        };
        await extension.activate(context as any);

        const openCommand = registerCommandSpy.mock.calls.find(
          (call) => call[0] === "blame-pr.open"
        )[1];
        await openCommand();

        expect(showWarningMessageSpy).toHaveBeenCalledWith(
          expect.stringMatching(/sha1234.*has no associated PR/),
          "Open commit URL"
        );
      });

      test("Getting 500 from github", async () => {
        const mockGithubInstance = {
          pullRequestID: jest.fn().mockResolvedValue(null),
        };
        MockedCachedGithub.mockImplementation(() => mockGithubInstance as any);

        nockGithubResponse(500, null);

        // Import and activate extension
        const extension = await import("../src/extension");
        const context = {
          workspaceState: mockWorkspaceState,
          subscriptions: [],
        };
        await extension.activate(context as any);

        const openCommand = registerCommandSpy.mock.calls.find(
          (call) => call[0] === "blame-pr.open"
        )[1];
        await openCommand();

        expect(showWarningMessageSpy).toHaveBeenCalledWith(
          expect.stringMatching(/sha1234.*has no associated PR/),
          "Open commit URL"
        );
      });

      test("Open commit URL", async () => {
        const mockGithubInstance = {
          pullRequestID: jest.fn().mockResolvedValue(null),
        };
        MockedCachedGithub.mockImplementation(() => mockGithubInstance as any);

        nockGithubResponse(200, null);

        showWarningMessageSpy.mockResolvedValue({
          title: "Open commit URL",
        } as any);

        // Import and activate extension
        const extension = await import("../src/extension");
        const context = {
          workspaceState: mockWorkspaceState,
          subscriptions: [],
        };
        await extension.activate(context as any);

        const openCommand = registerCommandSpy.mock.calls.find(
          (call) => call[0] === "blame-pr.open"
        )[1];
        await openCommand();

        expect(openExternalSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            toString: expect.any(Function),
          })
        );

        const calledUrl = openExternalSpy.mock.calls[0][0].toString();
        expect(calledUrl).toBe(
          "https://github.com/owner/name/commit/sha1234567890"
        );
      });

      test("Not Open commit URL", async () => {
        const mockGithubInstance = {
          pullRequestID: jest.fn().mockResolvedValue(null),
        };
        MockedCachedGithub.mockImplementation(() => mockGithubInstance as any);

        nockGithubResponse(200, null);

        showWarningMessageSpy.mockResolvedValue(undefined);

        // Import and activate extension
        const extension = await import("../src/extension");
        const context = {
          workspaceState: mockWorkspaceState,
          subscriptions: [],
        };
        await extension.activate(context as any);

        const openCommand = registerCommandSpy.mock.calls.find(
          (call) => call[0] === "blame-pr.open"
        )[1];
        await openCommand();

        // Should not call openExternal for commit URL
        expect(openExternalSpy).not.toHaveBeenCalledWith(
          expect.objectContaining({
            toString: () => expect.stringMatching(/commit\/sha1234567890$/),
          })
        );
      });
    });
  });
});
