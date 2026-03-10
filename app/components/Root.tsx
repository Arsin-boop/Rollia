import { Outlet } from "react-router";

export function Root() {
  return (
    <div className="size-full">
      <Outlet />
    </div>
  );
}
