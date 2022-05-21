import { SandpackCodeEditor, useSandpack } from "@codesandbox/sandpack-react";
import { memo, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { DEBUG_EDITOR_RENDER } from "./debug";
import { ChannelClient, ChannelServer } from "./ChannelBridge";
import {
  codemirrorTypescriptExtensions,
  normalizePath,
  normalizePaths,
} from "./codemirrorExtensions";
import { getLocalStorage } from "./localStorageHelper";
import type { TSServerWorker } from "./tsserver.worker";

export const CodeEditor: React.FC<{ activePath?: string }> = memo(
  // TODO: why get activePath from props, if we can get it from useSandpack()?
  ({ activePath }) => {
    const [tsServer] = useState(() => {
      const worker = new Worker(
        new URL("./tsserver.worker.ts", import.meta.url),
        {
          name: "ts-server",
        }
      );

      const postMessage = DEBUG_EDITOR_RENDER.wrap("tx", (msg) =>
        worker.postMessage(msg)
      );

      const renderer = new TSServerRender(getLocalStorage());

      return {
        worker,
        renderer,
        server: new ChannelServer({
          expose: renderer,
          responsePort: { postMessage },
        }),
        client: new ChannelClient<TSServerWorker>({ postMessage }, true),
      };
    });

    const { sandpack } = useSandpack();

    // Subscribe to responses from the worker.
    useEffect(
      function listener() {
        tsServer.worker.addEventListener("message", tsServer.client.onMessage);
        tsServer.worker.addEventListener("message", tsServer.server.onMessage);
        return () => {
          tsServer.worker.removeEventListener(
            "message",
            tsServer.client.onMessage
          );
          tsServer.worker.removeEventListener(
            "message",
            tsServer.server.onMessage
          );
        };
      },
      [tsServer]
    );

    // Send setup data to the worker once.
    useEffect(() => {
      const cache = tsServer.renderer.loadTypescriptCache();
      tsServer.client.call(
        "createTsSystem",
        normalizePaths(sandpack.files) as any /* TODO */,
        normalizePath(sandpack.activePath),
        cache
      );
    }, [tsServer /* other dependencies intentionally omitted */]);

    const [tooltipNode, setTooltipNode] = useState<HTMLElement | null>(null);
    useLayoutEffect(() => {
      setTooltipNode(sandpack.lazyAnchorRef.current?.parentElement ?? null);
    });

    const extensions = useMemo(
      () =>
        codemirrorTypescriptExtensions(
          tsServer.client,
          activePath,
          tooltipNode
        ),
      [tsServer.client, activePath, tooltipNode]
    );

    return (
      <SandpackCodeEditor
        key={tooltipNode ? "has-node" : "no-node"}
        showTabs
        extensions={extensions}
      />
    );
  }
);

class TSServerRender {
  constructor(private storage: Storage | undefined) {}

  loadTypescriptCache() {
    const cache = new Map<string, string>();
    const storage = this.storage;

    if (storage) {
      const keys = Object.keys(storage);

      keys.forEach((key) => {
        if (key.startsWith("ts-lib-")) {
          const item = storage.getItem(key);
          if (item) {
            cache.set(key, item);
          }
        }
      });
    }

    return cache;
  }

  saveTypescriptCache(version: string, fsMap: Map<string, string>) {
    fsMap.forEach((file, lib) => {
      const cacheKey = "ts-lib-" + version + "-" + lib;
      this.storage?.setItem(cacheKey, file);
    });
  }
}
