import type { ReactNode } from "react";

interface WorkspaceScrollProps {
  children: ReactNode;
  fullHeight?: boolean;
}

export default function WorkspaceScroll({
  children,
  fullHeight = false,
}: WorkspaceScrollProps) {
  return (
    <div className="h-full overflow-y-auto p-6 scrollbar-thin">
      <div
        className={`mx-auto w-full max-w-page${fullHeight ? " h-full" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}
