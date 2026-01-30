import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueChart, type RevenueChartPoint } from "@/components/admin/revenue-chart";

export function PaymentSourceChart({
  title,
  data,
}: {
  title: string;
  data: RevenueChartPoint[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <RevenueChart data={data} />
      </CardContent>
    </Card>
  );
}

