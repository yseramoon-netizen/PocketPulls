export default function AuthMessage({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const classes = {
    error:
      "border-red-200/15 bg-red-400/[0.08] text-red-100",
    success:
      "border-emerald-200/15 bg-emerald-400/[0.08] text-emerald-100",
    info:
      "border-cyan-200/15 bg-cyan-300/[0.07] text-cyan-50",
  };

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm font-semibold leading-6 ${classes[tone]}`}
    >
      {children}
    </div>
  );
}
