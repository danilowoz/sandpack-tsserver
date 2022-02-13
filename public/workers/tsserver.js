(() => {
  // public/workers/tsserver.ts
  importScripts("https://unpkg.com/@typescript/vfs@1.3.5/dist/vfs.globals.js");
  importScripts("https://cdnjs.cloudflare.com/ajax/libs/typescript/4.4.3/typescript.min.js");
  importScripts("https://unpkg.com/@okikio/emitter@2.1.7/lib/api.js");
  var {
    createDefaultMapFromCDN,
    createSystem,
    createVirtualTypeScriptEnvironment
  } = globalThis.tsvfs;
  var ts = globalThis.ts;
  var EventEmitter = globalThis.emitter.EventEmitter;
  var _emitter = new EventEmitter();
  globalThis.localStorage = globalThis.localStorage ?? {};
  var getCompileOptions = (tsconfigFile) => {
    const defaultValue = {
      target: ts.ScriptTarget.ES2021,
      module: ts.ScriptTarget.ES2020,
      lib: ["es2021", "es2020", "dom", "webworker"],
      esModuleInterop: true
    };
    if (tsconfigFile.compilerOptions) {
      return tsconfigFile.compilerOptions;
    }
    return defaultValue;
  };
  (async () => {
    let env;
    postMessage({
      event: "ready",
      details: []
    });
    const createTsSystem = async (files, entry) => {
      const tsFiles = /* @__PURE__ */ new Map();
      const rootPaths = [];
      let tsconfig = null;
      for (const filePath in files) {
        if (filePath === "tsconfig.json") {
          tsconfig = files[filePath].code;
        }
        if (/^[^.]+.tsx?$/.test(filePath)) {
          tsFiles.set(filePath, files[filePath].code);
          rootPaths.push(filePath);
        }
      }
      const compilerOpts = getCompileOptions(JSON.parse(tsconfig));
      const fsMap = await createDefaultMapFromCDN(compilerOpts, ts.version, false, ts);
      tsFiles.forEach((content, filePath) => {
        fsMap.set(filePath, content);
      });
      const reactTypes = await fetch("https://unpkg.com/@types/react@17.0.11/index.d.ts").then((data) => data.text());
      fsMap.set("/node_modules/@types/react/index.d.ts", reactTypes);
      const reactDomTypes = await fetch("https://unpkg.com/@types/react-dom@17.0.11/index.d.ts").then((data) => data.text());
      fsMap.set("/node_modules/@types/react-dom/index.d.ts", reactDomTypes);
      const system = createSystem(fsMap);
      env = createVirtualTypeScriptEnvironment(system, rootPaths, ts, compilerOpts);
      lintSystem(entry);
    };
    const updateFile = (filePath, content) => {
      env.updateFile(filePath, content);
    };
    const autocompleteAtPosition = (pos, filePath) => {
      let result = env.languageService.getCompletionsAtPosition(filePath, pos, {});
      postMessage({
        event: "autocomplete-results",
        details: result
      });
    };
    const infoAtPosition = (pos, filePath) => {
      let result = env.languageService.getQuickInfoAtPosition(filePath, pos);
      postMessage({
        event: "tooltip-results",
        details: result ? {
          result,
          tootltipText: ts.displayPartsToString(result.displayParts) + (result.documentation?.length ? "\n" + ts.displayPartsToString(result.documentation) : "")
        } : { result, tooltipText: "" }
      });
    };
    const lintSystem = (filePath) => {
      if (!env)
        return;
      let SyntacticDiagnostics = env.languageService.getSyntacticDiagnostics(filePath);
      let SemanticDiagnostic = env.languageService.getSemanticDiagnostics(filePath);
      let SuggestionDiagnostics = env.languageService.getSuggestionDiagnostics(filePath);
      let result = [].concat(SyntacticDiagnostics, SemanticDiagnostic, SuggestionDiagnostics);
      postMessage({
        event: "lint-results",
        details: result.map((result2) => {
          const from = result2.start;
          const to = result2.start + result2.length;
          const formatMessage = (message) => {
            if (typeof message === "string")
              return message;
            return message.messageText;
          };
          const severity = [
            "warning",
            "error",
            "info",
            "info"
          ];
          const diag = {
            from,
            to,
            message: formatMessage(result2.messageText),
            source: result2?.source,
            severity: severity[result2.category]
          };
          return diag;
        })
      });
    };
    _emitter.once("create-system", async (payload) => {
      createTsSystem(payload.files, payload.entry);
    });
    _emitter.on("lint-request", (payload) => lintSystem(payload.filePath));
    _emitter.on("updateText", (payload) => updateFile(payload.filePath, payload.content));
    _emitter.on("autocomplete-request", (payload) => {
      autocompleteAtPosition(payload.pos, payload.filePath);
    });
    _emitter.on("tooltip-request", (payload) => {
      infoAtPosition(payload.pos, payload.filePath);
    });
  })();
  addEventListener("message", ({ data }) => {
    let { event, details } = data;
    _emitter.emit(event, details);
  });
})();
