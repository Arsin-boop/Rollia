import { Outlet } from "react-router-dom";
import { GlobalHeader } from "./GlobalHeader";

export function Root() {
  return (
    <div className="app-shell">
      <GlobalHeader />
      <main className="app-shell-content">
        <Outlet />
      </main>
    </div>
  );
}


