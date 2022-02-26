import { SandpackTypescript } from "./sandpack-components/SandpackTypescript";
import "./index.css";

export default function App() {
  return (
    <div className="content">
      <h1>Sandpack + TypeScript LSP</h1>
      <p>
        It implements an interface between Sandpack, which uses CodeMirror under
        the hood, and TypeScript Virtual File System to consume all the benefits
        a language server protocol can provide, but inside a browser.
      </p>

      <ul>
        <li>IntelliSense;</li>
        <li>Tooltip error;</li>
        <li>Multiple files;</li>
        <li>Support tsconfig.json;</li>
        <li>Automatically dependency-types fetching (CodeSandbox CDN);</li>
        <li>In-browser dependency cache;</li>
      </ul>

      <br />

      <h2>Vanilla TypeScript</h2>
      <SandpackTypescript
        template="vanilla-ts"
        customSetup={{
          files: {
            "/src/index.ts": `import "./styles.css";
            
type List<R extends string> = R[]
            
const data: List<number> = [123, "foo"]
const selector = document.getElementById("app")

selector.innerHTML = \`
<h1>Hello Vanilla!</h1>
<p>\${data}</p>
\`;`,
          },
        }}
      />

      <h2>Basic React</h2>
      <SandpackTypescript
        template="react-ts"
        customSetup={{
          files: {
            "/App.tsx": `import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState<number>("0");

  function handleClick() {
    setCount(count + 1);
  }

  return (
    <button onClick={handleClick}>
      You pressed me {count} times
    </button>
  );
}`,
          },
        }}
      />

      <h2>React + Dependency</h2>
      <SandpackTypescript
        template="react-ts"
        customSetup={{
          dependencies: {
            "@chakra-ui/react": "latest",
            "@emotion/react": "latest",
            "@emotion/styled": "latest",
            "framer-motion": "latest",
          },
          files: {
            "/App.tsx": {
              code: `import React from "react"
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
          },
        }}
      />

      <h2>React + Dependency + Multiple files</h2>
      <SandpackTypescript
        template="react-ts"
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
      <Button active>Primary button!</Button>
    </div>
  )
}`,
          },
        }}
      />
    </div>
  );
}
