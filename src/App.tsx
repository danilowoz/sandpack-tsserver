import { Sandpack } from "@codesandbox/sandpack-react";
import "@codesandbox/sandpack-react/dist/index.css";

import { EventEmitter } from "@okikio/emitter";
import { EditorView } from "@codemirror/view";
import { autocompletion, completeFromList } from "@codemirror/autocomplete";
import { hoverTooltip } from "@codemirror/tooltip";
import { Diagnostic, linter } from "@codemirror/lint";

import debounce from "lodash.debounce";
import debounceAsync from "debounce-async";

let tsServer = new Worker(
  new URL("/workers/tsserver.js", window.location.origin),
  {
    name: "ts-server",
  }
);

const emitter = new EventEmitter();

const extensions = [
  EditorView.updateListener.of(
    debounce((update: ViewUpdate) => {
      if (update.docChanged) {
        tsServer.postMessage({
          event: "updateText",
          details: update.state.doc,
        });
      }
    }, 150)
  ),

  autocompletion({
    activateOnTyping: true,
    override: [
      debounceAsync(
        async (ctx: CompletionContext): Promise<CompletionResult | null> => {
          const { pos } = ctx;

          try {
            tsServer.postMessage({
              event: "autocomplete-request",
              details: { pos },
            });

            const completions = await new Promise((resolve) => {
              emitter.on("autocomplete-results", (completions) => {
                resolve(completions);
              });
            });

            if (!completions) {
              console.log("Unable to get completions", { pos });
              return null;
            }

            return completeFromList(
              // @ts-ignore
              completions.entries.map((c, i) => {
                let suggestions: Completion = {
                  type: c.kind,
                  label: c.name,
                  // TODO:: populate details and info
                  boost: 1 / Number(c.sortText),
                };

                return suggestions;
              })
            )(ctx);
          } catch (e) {
            console.log("Unable to get completions", { pos, error: e });
            return null;
          }
        },
        200
      ),
    ],
  }),

  hoverTooltip(
    async ({ state }: EditorView, pos: number): Promise<Tooltip | null> => {
      tsServer.postMessage({
        event: "tooltip-request",
        details: { pos },
      });

      const { result: quickInfo, tootltipText } = await new Promise(
        (resolve) => {
          emitter.on("tooltip-results", (completions) => {
            resolve(completions);
          });
        }
      );

      if (!quickInfo) return null;

      return {
        pos,
        create() {
          const dom = document.createElement("div");
          dom.setAttribute("class", "cm-quickinfo-tooltip");
          dom.textContent = tootltipText;

          return { dom };
        },
      };
    },
    {
      hideOnChange: true,
    }
  ),

  linter(
    async (view: EditorView): Promise<Diagnostic[] | null> => {
      tsServer.postMessage({
        event: "lint-request",
        details: [],
      });

      const diagnostics = await new Promise((resolve) => {
        emitter.on("lint-results", (completions) => {
          resolve(completions);
        });
      });

      if (!diagnostics) return null;

      return diagnostics as Diagnostic[];
    },
    {
      delay: 400,
    }
  ),
];

const code = `import React, { useState } from "react"

export default function App(): JSX.Element {
  const [state, setState] = useState()
  
  return <h1>Hello World</h1>
}`;

emitter.on("ready", () => {
  tsServer.postMessage({
    event: "updateText",
    details: code,
  });
});

tsServer.addEventListener(
  "message",
  ({ data }: MessageEvent<{ event: string; details: any }>) => {
    let { event, details } = data;
    emitter.emit(event, details);
  }
);

export default function App() {
  return (
    <Sandpack
      template="react-ts"
      files={{ "/App.tsx": code }}
      options={{ showTabs: true, codeEditor: { extensions } }}
    />
  );
}
