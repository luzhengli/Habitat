import { useState } from "react";
import ProjectApp from "./App";
import FirstRunApp from "./FirstRunApp";
import RecoveryApp from "./RecoveryApp";

const qaMode = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("qa") : null;

export default function RootApp() {
  const [setupComplete, setSetupComplete] = useState(
    qaMode?.startsWith("first-run-")
      ? false
      : qaMode?.startsWith("project-") || qaMode?.startsWith("recovery-") || window.localStorage.getItem("habitat.setupComplete") === "true",
  );
  const [surface, setSurface] = useState<"project" | "recovery">(
    qaMode?.startsWith("recovery-") ? "recovery" : "project",
  );
  const [recoveryLinks, setRecoveryLinks] = useState<string[]>([]);

  const storeRoot = window.localStorage.getItem("habitat.storeRoot") ?? "";

  if (surface === "recovery") {
    return <RecoveryApp
      storeRoot={storeRoot}
      onExit={() => setSurface("project")}
      onHandleProject={(projectRoot, links) => {
        window.localStorage.setItem("habitat.projectRoot", projectRoot);
        setRecoveryLinks(links);
        setSurface("project");
      }}
      onComplete={() => {
        window.localStorage.removeItem("habitat.setupComplete");
        setRecoveryLinks([]);
        setSetupComplete(false);
        setSurface("project");
      }}
    />;
  }

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

  return <ProjectApp
    onOpenRecovery={() => setSurface("recovery")}
    recoveryLinks={recoveryLinks}
    onReturnRecovery={recoveryLinks.length ? () => {
      setRecoveryLinks([]);
      setSurface("recovery");
    } : undefined}
  />;
}
