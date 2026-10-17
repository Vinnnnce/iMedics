import { useState } from "react";
import { createRoot } from "react-dom/client";
import { WorkspaceDashboard } from "../src/components/workspace/dashboard";
import { demoWorkspace } from "../src/lib/workspace/demo";
import type { WorkspaceRole } from "../src/lib/workspace/types";

function Preview() {
  const [role, setRole] = useState<WorkspaceRole>("PATIENT");
  const [data, setData] = useState(() => demoWorkspace(role));
  return <WorkspaceDashboard initialData={data} onDemoRole={next => { setRole(next); setData(demoWorkspace(next)); }} />;
}
createRoot(document.getElementById("root")!).render(<Preview />);
