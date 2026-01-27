export function Input({ className = "", ...props }: any) {
    return (
      <input
        className={
          "w-full px-3 py-2 rounded-md bg-slate-700 border border-slate-600 text-white " +
          className
        }
        {...props}
      />
    );
  }
  