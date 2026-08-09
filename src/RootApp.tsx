import { useState } from "react";
import ProjectApp from "./App";
import FirstRunApp from "./FirstRunApp";

const qaMode = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("qa") : null;

export default function RootApp() {
  const [setupComplete, setSetupComplete] = useState(
    qaMode?.startsWith("first-run-")
      ? false
      : qaMode?.startsWith("project-") || window.localStorage.getItem("habitat.setupComplete") === "true",
  );

  if (!setupComplete) {
    return (
      <FirstRunApp
        onFinish={(storeRoot) => {
          window.localStorage.setItem("habitat.storeRoot", storeRoot);
          window.localStorage.setItem("habitat.setupComplete", "true");
          setSetupComplete(true);
        }}
      />
    );
  }

  return <ProjectApp />;
}
