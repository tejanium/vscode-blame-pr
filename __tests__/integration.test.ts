import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type MockedClass,
  type MockInstance,
} from "vitest";
import * as vscode from "vscode";
import { CachedGit } from "../src/models/cachedGit";
import { CachedGithub } from "../src/models/cachedGithub";
import { FileBlameCache } from "../src/models/fileBlameCache";
import { PullRequest } from "../src/models/pullRequest";
import nock from "nock";

vi.mock("vscode", () => ({
  commands: {
    registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    executeCommand: vi.fn(),
  },
  window: {
    createStatusBarItem: vi.fn(),
    activeTextEditor: {
      document: {
        fileName: "/test/file.txt",
        uri: { scheme: "file" },
      },
      selection: {
        active: { line: 0 },
      },
    },
    showWarningMessage: vi.fn(),
    onDidChangeTextEditorSelection: vi
      .fn()
      .mockReturnValue({ dispose: vi.fn() }),
    onDidChangeActiveTextEditor: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    visibleTextEditors: [],
  },
  env: { openExternal: vi.fn().mockResolvedValue(true) },
  Uri: {
    parse: vi.fn((url: string) => ({ toString: () => url })),
    file: vi.fn((path: string) => ({ toString: () => path })),
  },
  workspace: {
    getConfiguration: vi.fn(),
    onDidCloseTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    createFileSystemWatcher: vi.fn().mockReturnValue({
      onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      onDidDelete: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      dispose: vi.fn(),
    }),
    fs: {
      stat: vi.fn().mockResolvedValue({ mtime: Date.now() }),
    },
  },
  authentication: {
    getSession: vi.fn(),
  },
  Disposable: {
    from: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  },
  StatusBarAlignment: { Left: 1, Right: 2 },
}));

// Mock the cached classes
vi.mock("../src/models/cachedGit");
vi.mock("../src/models/cachedGithub");
vi.mock("../src/models/fileBlameCache");

const MockedCachedGit = CachedGit as MockedClass<typeof CachedGit>;
const MockedCachedGithub = CachedGithub as MockedClass<typeof CachedGithub>;
const MockedFileBlameCache = FileBlameCache as MockedClass<
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
  let registerCommandSpy: MockInstance;
  let createStatusBarItemSpy: MockInstance;
  let openExternalSpy: MockInstance;
  let showWarningMessageSpy: MockInstance;
  let getSessionSpy: MockInstance;
  let getConfigurationSpy: MockInstance;
  let statusItem: any;
  let mockWorkspaceState: any;

  beforeAll(() => {
    // Create spies
    registerCommandSpy = vi.spyOn(vscode.commands, "registerCommand");
    createStatusBarItemSpy = vi.spyOn(vscode.window, "createStatusBarItem");
    openExternalSpy = vi.spyOn(vscode.env, "openExternal");
    showWarningMessageSpy = vi.spyOn(vscode.window, "showWarningMessage");
    getSessionSpy = vi.spyOn(vscode.authentication, "getSession");
    getConfigurationSpy = vi.spyOn(vscode.workspace, "getConfiguration");

    // Setup status bar item mock
    statusItem = {
      text: "",
      show: vi.fn(),
      hide: vi.fn(),
    };
    createStatusBarItemSpy.mockReturnValue(statusItem);

    // Setup workspace state mock
    mockWorkspaceState = {
      get: vi.fn(),
      update: vi.fn(),
    };
  });

  beforeEach(() => {
    vi.clearAllMocks();
    MockedCachedGit.mockClear();
    MockedCachedGithub.mockClear();

    // Mock FileBlameCache singleton
    const mockFileBlameCacheInstance = {
      getBlame: vi.fn().mockResolvedValue(undefined),
      onFileOpened: vi.fn(),
      onFileClosed: vi.fn(),
      dispose: vi.fn(),
    };
    MockedFileBlameCache.getInstance = vi
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
      config: vi.fn().mockImplementation(() => {
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
      getCachedBlame: vi.fn().mockReturnValue(undefined),
      blame: vi.fn().mockImplementation(() => {
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
    MockedCachedGit.mockImplementation(function () {
      return mockGitInstance as any;
    });
  }

  function configureGithubToken(token: string): void {
    getConfigurationSpy.mockReturnValue({
      get: vi.fn().mockReturnValue(token),
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
        (call) => call[0] === "blame-pr.toggleStatusbar",
      )![1];

      await toggleCommand();

      // Wait for debounced update (150ms + some buffer)
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(statusItem.hide).toHaveBeenCalledTimes(1);
      expect(statusItem.show).toHaveBeenCalled();
      expect(statusItem.text).toBe(
        '$(git-pull-request) User Name: "Commit message (#1)"',
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
        (call) => call[0] === "blame-pr.open",
      )![1];
      await openCommand();

      expect(openExternalSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toString: expect.any(Function),
        }),
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
        (call) => call[0] === "blame-pr.open",
      )![1];
      await openCommand();

      expect(openExternalSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toString: expect.any(Function),
        }),
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
        (call) => call[0] === "blame-pr.open",
      )![1];
      await openCommand();

      expect(openExternalSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toString: expect.any(Function),
        }),
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
        (call) => call[0] === "blame-pr.open",
      )![1];
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
        (call) => call[0] === "blame-pr.open",
      )![1];
      await openCommand();

      expect(showWarningMessageSpy).toHaveBeenCalledWith(
        "Could not get Git info, please try a little later",
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
        (call) => call[0] === "blame-pr.open",
      )![1];
      await openCommand();

      expect(openExternalSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toString: expect.any(Function),
        }),
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
        (call) => call[0] === "blame-pr.open",
      )![1];
      await openCommand();

      expect(openExternalSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toString: expect.any(Function),
        }),
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
          pullRequestID: vi.fn().mockResolvedValue(10),
        };
        MockedCachedGithub.mockImplementation(function () {
          return mockGithubInstance as any;
        });

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
          (call) => call[0] === "blame-pr.open",
        )![1];
        await openCommand();

        expect(openExternalSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            toString: expect.any(Function),
          }),
        );

        const calledUrl = openExternalSpy.mock.calls[0][0].toString();
        expect(calledUrl).toBe("https://github.com/owner/name/pull/10");
      });

      test("Getting no associated PR data from github", async () => {
        const mockGithubInstance = {
          pullRequestID: vi.fn().mockResolvedValue(null),
        };
        MockedCachedGithub.mockImplementation(function () {
          return mockGithubInstance as any;
        });

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
          (call) => call[0] === "blame-pr.open",
        )![1];
        await openCommand();

        expect(showWarningMessageSpy).toHaveBeenCalledWith(
          expect.stringMatching(/sha1234.*has no associated PR/),
          "Open commit URL",
        );
      });

      test("Getting empty associated PR data from github", async () => {
        const mockGithubInstance = {
          pullRequestID: vi.fn().mockResolvedValue(null),
        };
        MockedCachedGithub.mockImplementation(function () {
          return mockGithubInstance as any;
        });

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
          (call) => call[0] === "blame-pr.open",
        )![1];
        await openCommand();

        expect(showWarningMessageSpy).toHaveBeenCalledWith(
          expect.stringMatching(/sha1234.*has no associated PR/),
          "Open commit URL",
        );
      });

      test("Getting no data from github", async () => {
        const mockGithubInstance = {
          pullRequestID: vi.fn().mockResolvedValue(null),
        };
        MockedCachedGithub.mockImplementation(function () {
          return mockGithubInstance as any;
        });

        nockGithubResponse(200, null);

        // Import and activate extension
        const extension = await import("../src/extension");
        const context = {
          workspaceState: mockWorkspaceState,
          subscriptions: [],
        };
        await extension.activate(context as any);

        const openCommand = registerCommandSpy.mock.calls.find(
          (call) => call[0] === "blame-pr.open",
        )![1];
        await openCommand();

        expect(showWarningMessageSpy).toHaveBeenCalledWith(
          expect.stringMatching(/sha1234.*has no associated PR/),
          "Open commit URL",
        );
      });

      test("Getting 500 from github", async () => {
        const mockGithubInstance = {
          pullRequestID: vi.fn().mockResolvedValue(null),
        };
        MockedCachedGithub.mockImplementation(function () {
          return mockGithubInstance as any;
        });

        nockGithubResponse(500, null);

        // Import and activate extension
        const extension = await import("../src/extension");
        const context = {
          workspaceState: mockWorkspaceState,
          subscriptions: [],
        };
        await extension.activate(context as any);

        const openCommand = registerCommandSpy.mock.calls.find(
          (call) => call[0] === "blame-pr.open",
        )![1];
        await openCommand();

        expect(showWarningMessageSpy).toHaveBeenCalledWith(
          expect.stringMatching(/sha1234.*has no associated PR/),
          "Open commit URL",
        );
      });

      test("Open commit URL", async () => {
        const mockGithubInstance = {
          pullRequestID: vi.fn().mockResolvedValue(null),
        };
        MockedCachedGithub.mockImplementation(function () {
          return mockGithubInstance as any;
        });

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
          (call) => call[0] === "blame-pr.open",
        )![1];
        await openCommand();

        expect(openExternalSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            toString: expect.any(Function),
          }),
        );

        const calledUrl = openExternalSpy.mock.calls[0][0].toString();
        expect(calledUrl).toBe(
          "https://github.com/owner/name/commit/sha1234567890",
        );
      });

      test("Not Open commit URL", async () => {
        const mockGithubInstance = {
          pullRequestID: vi.fn().mockResolvedValue(null),
        };
        MockedCachedGithub.mockImplementation(function () {
          return mockGithubInstance as any;
        });

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
          (call) => call[0] === "blame-pr.open",
        )![1];
        await openCommand();

        // Should not call openExternal for commit URL
        expect(openExternalSpy).not.toHaveBeenCalledWith(
          expect.objectContaining({
            toString: () => expect.stringMatching(/commit\/sha1234567890$/),
          }),
        );
      });
    });
  });
});
