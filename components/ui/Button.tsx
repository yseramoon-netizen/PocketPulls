type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  disabled?: boolean;
};

export default function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  className = "",
  disabled = false,
}: ButtonProps) {
  const variants = {
    primary:
      "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg hover:shadow-xl",

    secondary:
      "bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 shadow",

    danger:
      "bg-red-500 hover:bg-red-600 text-white shadow-lg",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        px-6
        py-3
        rounded-2xl
        font-semibold
        transition-all
        duration-200
        hover:-translate-y-0.5
        active:translate-y-0
        disabled:opacity-50
        disabled:cursor-not-allowed
        ${variants[variant]}
        ${className}
      `}
    >
      {children}
    </button>
  );
}