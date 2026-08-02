type SectionProps = {
  children: React.ReactNode;
  title?: string;
  icon?: string;
  className?: string;
};

export default function Section({
  children,
  title,
  icon,
  className = "",
}: SectionProps) {
  return (
    <section
      className={`
        bg-white
        rounded-3xl
        border
        border-emerald-100
        shadow-lg
        p-6
        ${className}
      `}
    >
      {title && (
        <h2 className="
          text-2xl
          font-bold
          text-emerald-700
          mb-5
        ">
          {icon && `${icon} `}
          {title}
        </h2>
      )}

      {children}
    </section>
  );
}