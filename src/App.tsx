import { SandpackTypescript } from "./sandpack-components/SandpackTypescript";
import "./index.css";

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
    </>
  );
}
