export function Badge({ children, className = "" }: any) {
    return (
      <span
        className={
          "inline-block px-2 py-1 text-xs rounded bg-slate-600 text-white " +
          className
        }
      >
        {children}
      </span>
    );
  }
  