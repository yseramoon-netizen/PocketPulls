type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export default function Card({
  children,
  className = "",
}: CardProps) {
  return (
    <div
      className={`
        bg-white
        rounded-3xl
        border
        border-emerald-100
        shadow-lg
        p-6
        transition-all
        duration-200
        hover:shadow-xl
        ${className}
      `}
    >
      {children}
    </div>
  );
}