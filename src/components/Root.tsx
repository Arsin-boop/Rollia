import { Outlet } from "react-router-dom";

export function Root() {
  return (
    <div className="app-shell">
      <main className="app-shell-content">
        <Outlet />
      </main>
    </div>
  );
}


