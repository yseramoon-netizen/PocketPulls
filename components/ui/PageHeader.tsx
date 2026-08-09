type PageHeaderProps = {
  title: string;
  subtitle?: string;
};

export default function PageHeader({
  title,
  subtitle,
}: PageHeaderProps) {
  return (
    <div className="text-center mb-10">
      <img
        src="/ancient-pulls/celestial-cat.png"
        alt="Nebu"
        className="w-28 h-28 mx-auto mb-4"
      />

      <h1 className="text-4xl md:text-5xl font-bold text-emerald-700">
        {title}
      </h1>

      {subtitle && (
        <p className="text-gray-500 mt-3 text-lg">
          {subtitle}
        </p>
      )}
    </div>
  );
}
