import {
  SandpackConsumer,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  SandpackSetup,
  SandpackThemeProvider,
  SandpackPredefinedTemplate,
} from "@codesandbox/sandpack-react";
import "@codesandbox/sandpack-react/dist/index.css";
import { CodeEditor } from "./CodeEditor";

export const SandpackTypescript: React.FC<{
  customSetup: SandpackSetup;
  template: SandpackPredefinedTemplate;
}> = ({ customSetup, template }) => {
  return (
    <SandpackProvider template={template} customSetup={customSetup}>
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
