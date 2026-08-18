import type { ReactNode } from "react";

interface WorkspaceFrameProps {
  children: ReactNode;
}

export default function WorkspaceFrame({ children }: WorkspaceFrameProps) {
  return <div className="h-full min-h-0 flex flex-col p-6">{children}</div>;
}
