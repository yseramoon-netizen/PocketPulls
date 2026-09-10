import Card from "./Card";

type MetricCardProps = {
  title: string;
  value: string | number;
  icon: string;
};

export default function MetricCard({
  title,
  value,
  icon,
}: MetricCardProps) {
  return (
    <Card>
      <p className="text-gray-500">
        {icon} {title}
      </p>

      <h2 className="text-4xl font-bold text-emerald-700 mt-3">
        {value}
      </h2>
    </Card>
  );
}