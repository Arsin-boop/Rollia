export function Textarea({ className = "", ...props }: any) {
    return (
      <textarea
        className={
          "w-full px-3 py-2 rounded-md bg-slate-700 border border-slate-600 text-white resize-none " +
          className
        }
        {...props}
      />
    );
  }
  