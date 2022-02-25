import {
  SandpackCodeEditor,
  SandpackConsumer,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  SandpackThemeProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";
import "@codesandbox/sandpack-react/dist/index.css";

import { EventEmitter } from "@okikio/emitter";
import codemirrorExtensions from "./codemirror-extensions";
import { memo, useEffect, useRef } from "react";

const CodeEditor: React.FC<{ activePath?: string }> = memo(({ activePath }) => {
  const tsServer = useRef(
    new Worker(new URL("/workers/tsserver.js", window.location.origin), {
      name: "ts-server",
    })
  );
  const emitter = useRef(new EventEmitter());
  const { sandpack } = useSandpack();

  useEffect(function listener() {
    const serverMessageCallback = ({
      data: { event, details },
    }: MessageEvent<{ event: string; details: any }>) => {
      emitter.current.emit(event, details);
    };

    tsServer.current.addEventListener("message", serverMessageCallback);

    return () => {
      tsServer.current.removeEventListener("message", serverMessageCallback);
    };
  }, []);

  useEffect(function init() {
    emitter.current.on("ready", () => {
      const getTypescriptCache = () => {
        const cache = new Map();
        const keys = Object.keys(localStorage);

        keys.forEach((key) => {
          if (key.startsWith("ts-lib-")) {
            cache.set(key, localStorage.getItem(key));
          }
        });

        return cache;
      };

      tsServer.current.postMessage({
        event: "create-system",
        details: {
          files: sandpack.files,
          entry: sandpack.activePath,
          fsMapCached: getTypescriptCache(),
        },
      });
    });

    emitter.current.on(
      "cache-typescript-fsmap",
      ({ version, fsMap }: { version: string; fsMap: Map<string, string> }) => {
        fsMap.forEach((file, lib) => {
          const cacheKey = "ts-lib-" + version + "-" + lib;
          localStorage.setItem(cacheKey, file);
        });
      }
    );
  }, []);

  const extensions = codemirrorExtensions(
    tsServer.current,
    emitter.current
  )(activePath);

  return <SandpackCodeEditor showTabs extensions={extensions} />;
});

const SandpackTypescript = ({ customSetup }) => {
  return (
    <SandpackProvider template="react-ts" customSetup={customSetup}>
      <SandpackThemeProvider>
        <SandpackLayout>
          <SandpackConsumer>
            {(state) => <CodeEditor activePath={state?.activePath} />}
          </SandpackConsumer>
          <SandpackPreview />
        </SandpackLayout>
      </SandpackThemeProvider>
    </SandpackProvider>
  );
};

export default function App() {
  return (
    <>
      <SandpackTypescript
        customSetup={{
          dependencies: {
            "styled-components": "latest",
          },
          files: {
            "/Button.ts": `import styled, { css } from "styled-components";
          
export const Button = styled.a<{ primary?: boolean }>\`
  /* This renders the buttons above... Edit me! */
  background: transparent;
  border: 2px solid palevioletred;
  color: palevioletred;
  margin: 1em;
  padding: 0.25em 1em;

  \${props => props.primary && css\`
    background: palevioletred;
    color: white;
  \`};
\``,
            "/App.tsx": `import React from "react"
import { Button } from "./Button"

export default function App(): JSX.Element {
  return (
    <div>
      <Button>Hello world!</Button>
      <Button active>I must be a primary button!</Button>
    </div>
  )
}`,
          },
        }}
      />

      <SandpackTypescript
        customSetup={{
          dependencies: {
            "@chakra-ui/react": "latest",
            "@emotion/react": "latest",
            "@emotion/styled": "latest",
            "framer-motion": "latest",
          },
          files: {
            "/App.tsx": `import React from "react"
import { Flex } from '@chakra-ui/react'

export default function App(): JSX.Element {
  return (
    <Flex 
      w="100vw" 
      h="100vh" 
      justifyContent="center" 
      alignItems
    >
      <h2>Hello world!</h2>
    </Flex>
  )
}`,
          },
        }}
      />
    </>
  );
}
