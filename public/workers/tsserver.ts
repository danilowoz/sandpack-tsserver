import { VirtualTypeScriptEnvironment } from "@typescript/vfs";
import { CompilerOptions } from "typescript";

importScripts("https://unpkg.com/@typescript/vfs@1.3.5/dist/vfs.globals.js");
importScripts(
  "https://cdnjs.cloudflare.com/ajax/libs/typescript/4.4.3/typescript.min.js"
);
importScripts("https://unpkg.com/@okikio/emitter@2.1.7/lib/api.js");

export type VFS = typeof import("@typescript/vfs");
export type EVENT_EMITTER = import("@okikio/emitter").EventEmitter;
export type Diagnostic = import("@codemirror/lint").Diagnostic;

var {
  createDefaultMapFromCDN,
  createSystem,
  createVirtualTypeScriptEnvironment,
} = globalThis.tsvfs as VFS;
var ts = globalThis.ts; // as TS

var EventEmitter = globalThis.emitter.EventEmitter;
var _emitter: EVENT_EMITTER = new EventEmitter();

globalThis.localStorage = globalThis.localStorage ?? ({} as Storage);

const BUCKET_URL = "https://prod-packager-packages.codesandbox.io/v1/typings";
const TYPES_REGISTRY = "https://unpkg.com/types-registry@latest/index.json";

const fetchDependencyTyping = async ({
  name,
  version,
}: {
  name: string;
  version: string;
}): Promise<Record<string, { module: { code: string } }>> => {
  try {
    const url = `${BUCKET_URL}/${name}/${version}.json`;
    const { files } = await fetch(url).then((data) => data.json());

    return files;
  } catch {}
};

const getCompileOptions = (
  tsconfigFile: Record<string, any>
): CompilerOptions => {
  const defaultValue = {
    target: ts.ScriptTarget.ES2021,
    module: ts.ScriptTarget.ES2020,
    lib: ["es2021", "es2020", "dom", "webworker"],
    esModuleInterop: true,
  };

  if (tsconfigFile.compilerOptions) {
    return tsconfigFile.compilerOptions;
  }

  return defaultValue;
};

(async () => {
  let env: VirtualTypeScriptEnvironment;

  /**
   * Worker is ready
   */
  postMessage({
    event: "ready",
    details: [],
  });

  const createTsSystem = async (
    files: Record<string, { code: string }>,
    entry: string
  ) => {
    const tsFiles = new Map();
    const rootPaths = [];
    const dependenciesMap = new Map();
    let tsconfig = null;
    let packageJson = null;

    /**
     * Collect files
     */
    for (const filePath in files) {
      const content = files[filePath].code;

      if (filePath === "tsconfig.json" || filePath === "/tsconfig.json") {
        tsconfig = content;
      } else if (filePath === "package.json" || filePath === "/package.json") {
        packageJson = content;
      } else if (/^[^.]+.tsx?$/.test(filePath)) {
        // Only ts files
        tsFiles.set(filePath, content);
        rootPaths.push(filePath);
      }
    }

    const compilerOpts = getCompileOptions(JSON.parse(tsconfig));

    // TODO: cache (localstorage) on main thread
    // As worker doesn't have access to localstorate, it needs to post message to the main thread and retrieve it back
    const fsMap = await createDefaultMapFromCDN(
      compilerOpts,
      ts.version,
      false,
      ts
    );

    tsFiles.forEach((content, filePath) => {
      fsMap.set(filePath, content);
    });

    /**
     * Dependencies types
     */
    const { dependencies, devDependencies } = JSON.parse(packageJson);
    for (const dep in devDependencies ?? {}) {
      dependenciesMap.set(dep, devDependencies[dep]);
    }
    for (const dep in dependencies ?? {}) {
      // Avoid redundant requests
      if (!dependenciesMap.has(`@types/${dep}`)) {
        dependenciesMap.set(dep, dependencies[dep]);
      }
    }

    let typesInfo: Record<string, { latest: string }>;

    dependenciesMap.forEach(async (version, name) => {
      // CodeSandbox CDN
      const files = await fetchDependencyTyping({ name, version });
      const hasTypes = Object.keys(files).some(
        (key) => key.startsWith("/" + name) && key.endsWith(".d.ts")
      );

      if (hasTypes) {
        Object.entries(files).forEach(([key, value]) => {
          if (key.endsWith(".d.ts") && value?.module?.code) {
            fsMap.set(`/node_modules${key}`, value.module.code);
          }
        });
      } else {
        // Look for types in @types register
        if (!typesInfo) {
          typesInfo = await fetch(TYPES_REGISTRY)
            .then((data) => data.json())
            .then((data) => data.entries);
        }

        const typingName = `@types/${name}`;
        if (typesInfo[name]) {
          const atTypeFiles = await fetchDependencyTyping({
            name: typingName,
            version: typesInfo[name].latest,
          });

          Object.entries(atTypeFiles).forEach(([key, value]) => {
            if (key.endsWith(".d.ts") && value?.module?.code) {
              fsMap.set(`/node_modules${key}`, value.module.code);
            }
          });
        }
      }
    });

    const system = createSystem(fsMap);

    env = createVirtualTypeScriptEnvironment(
      system,
      rootPaths,
      ts,
      compilerOpts
    );

    lintSystem(entry);
  };

  const updateFile = (filePath: string, content: string) => {
    env.updateFile(filePath, content);
  };

  const autocompleteAtPosition = (pos: number, filePath: string) => {
    let result = env.languageService.getCompletionsAtPosition(
      filePath,
      pos,
      {}
    );

    postMessage({
      event: "autocomplete-results",
      details: result,
    });
  };

  const infoAtPosition = (pos: number, filePath: string) => {
    let result = env.languageService.getQuickInfoAtPosition(filePath, pos);

    postMessage({
      event: "tooltip-results",
      details: result
        ? {
            result,
            tootltipText:
              ts.displayPartsToString(result.displayParts) +
              (result.documentation?.length
                ? "\n" + ts.displayPartsToString(result.documentation)
                : ""),
          }
        : { result, tooltipText: "" },
    });
  };

  const lintSystem = (filePath: string) => {
    if (!env) return;

    let SyntacticDiagnostics =
      env.languageService.getSyntacticDiagnostics(filePath);
    let SemanticDiagnostic =
      env.languageService.getSemanticDiagnostics(filePath);
    let SuggestionDiagnostics =
      env.languageService.getSuggestionDiagnostics(filePath);

    type Diagnostics = typeof SyntacticDiagnostics &
      typeof SemanticDiagnostic &
      typeof SuggestionDiagnostics;
    let result: Diagnostics = [].concat(
      SyntacticDiagnostics,
      SemanticDiagnostic,
      SuggestionDiagnostics
    );

    postMessage({
      event: "lint-results",
      details: result.map((result) => {
        const from = result.start;
        const to = result.start + result.length;
        // const codeActions = env.languageService.getCodeFixesAtPosition(
        //   filePath,
        //   from,
        //   to,
        //   [result.category],
        //   {},
        //   {}
        // );

        const formatMessage = (
          message: string | { messageText: string }
        ): string => {
          if (typeof message === "string") return message;

          // TODO: get nested errors
          return message.messageText;
        };

        const severity: Diagnostic["severity"][] = [
          "warning",
          "error",
          "info",
          "info",
        ];

        const diag: Diagnostic = {
          from,
          to,
          message: formatMessage(result.messageText),
          source: result?.source,
          severity: severity[result.category],
          // actions: codeActions as any as Diagnostic["actions"]
        };

        return diag;
      }),
    });
  };

  /**
   * Listeners
   */
  _emitter.once(
    "create-system",
    async (payload: {
      files: Record<string, { code: string }>;
      entry: string;
    }) => {
      createTsSystem(payload.files, payload.entry);
    }
  );
  _emitter.on("lint-request", (payload: { filePath: string }) =>
    lintSystem(payload.filePath)
  );
  _emitter.on("updateText", (payload: { filePath: string; content: string }) =>
    updateFile(payload.filePath, payload.content)
  );
  _emitter.on(
    "autocomplete-request",
    (payload: { pos: number; filePath: string }) => {
      autocompleteAtPosition(payload.pos, payload.filePath);
    }
  );
  _emitter.on(
    "tooltip-request",
    (payload: { pos: number; filePath: string }) => {
      infoAtPosition(payload.pos, payload.filePath);
    }
  );
})();

addEventListener(
  "message",
  ({ data }: MessageEvent<{ event: string; details: any }>) => {
    let { event, details } = data;
    _emitter.emit(event, details);
  }
);
