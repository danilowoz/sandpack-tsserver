import { SandpackFiles } from "@codesandbox/sandpack-react";
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
    let tsconfig = null;

    for (const filePath in files) {
      if (filePath === "tsconfig.json") {
        tsconfig = files[filePath].code;
      }

      if (/^[^.]+.tsx?$/.test(filePath)) {
        // Only ts files
        tsFiles.set(filePath, files[filePath].code);
        rootPaths.push(filePath);
      }
    }

    const compilerOpts = getCompileOptions(JSON.parse(tsconfig));

    const fsMap = await createDefaultMapFromCDN(
      compilerOpts,
      ts.version,
      false,
      ts
    );

    tsFiles.forEach((content, filePath) => {
      fsMap.set(filePath, content);
    });

    // TODO - dependencies
    const reactTypes = await fetch(
      "https://unpkg.com/@types/react@17.0.11/index.d.ts"
    ).then((data) => data.text());
    fsMap.set("/node_modules/@types/react/index.d.ts", reactTypes);
    const reactDomTypes = await fetch(
      "https://unpkg.com/@types/react-dom@17.0.11/index.d.ts"
    ).then((data) => data.text());
    fsMap.set("/node_modules/@types/react-dom/index.d.ts", reactDomTypes);

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
