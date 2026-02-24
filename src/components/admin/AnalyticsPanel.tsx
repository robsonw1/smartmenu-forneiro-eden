import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Order, Product } from '@/data/products';
import { useOrdersStore } from '@/store/useOrdersStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { format, startOfDay, endOfDay, subDays, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, Download, DollarSign, ShoppingBag, Users, TrendingDown } from 'lucide-react';

const COLORS = ['#FF8C42', '#FFB84D', '#FFD93D', '#6BCB77', '#4D96FF', '#9D84B7', '#FF6B6B', '#FFE66D', '#95E1D3', '#F38181'];

interface DateRangeState {
  startDate: string;
  endDate: string;
}

export function AnalyticsPanel() {
  const orders = useOrdersStore((s) => s.orders);
  const productsById = useCatalogStore((s) => s.productsById);

  const [dateRange, setDateRange] = useState<DateRangeState>({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  });

  const filteredOrders = useMemo(() => {
    const start = startOfDay(new Date(dateRange.startDate));
    const end = endOfDay(new Date(dateRange.endDate));
    return orders.filter(
      (order) =>
        isWithinInterval(new Date(order.createdAt), { start, end }) &&
        order.status !== 'cancelled'
    );
  }, [orders, dateRange]);

  // VENDAS & FATURAMENTO
  const salesMetrics = useMemo(() => {
    const totalSales = filteredOrders.reduce((sum, o) => sum + o.total, 0);
    const totalOrders = filteredOrders.length;
    const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

    // Crescimento (comparar com período anterior)
    const daysDiff = Math.ceil(
      (new Date(dateRange.endDate).getTime() - new Date(dateRange.startDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const prevStart = subDays(new Date(dateRange.startDate), daysDiff);
    const prevEnd = new Date(dateRange.startDate);
    const prevSales = orders
      .filter((o) => isWithinInterval(new Date(o.createdAt), { start: prevStart, end: prevEnd }) && o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.total, 0);

    const growth = prevSales > 0 ? ((totalSales - prevSales) / prevSales) * 100 : 0;

    return { totalSales, totalOrders, avgTicket, growth };
  }, [filteredOrders, orders, dateRange]);

  // PRODUTOS MAIS VENDIDOS
  const topProducts = useMemo(() => {
    const productStats: Record<string, { name: string; quantity: number; revenue: number }> = {};

    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (!productStats[item.product.id]) {
          productStats[item.product.id] = {
            name: item.product.name,
            quantity: 0,
            revenue: 0,
          };
        }
        productStats[item.product.id].quantity += item.quantity;
        productStats[item.product.id].revenue += item.totalPrice;
      });
    });

    return Object.values(productStats)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  }, [filteredOrders]);

  // FORMA DE PAGAMENTO
  const paymentMethods = useMemo(() => {
    const methods: Record<string, { count: number; value: number }> = {
      pix: { count: 0, value: 0 },
      card: { count: 0, value: 0 },
      cash: { count: 0, value: 0 },
    };

    filteredOrders.forEach((order) => {
      const method = order.paymentMethod || 'pix';
      methods[method].count += 1;
      methods[method].value += order.total;
    });

    return [
      { name: 'PIX', value: methods.pix.value, count: methods.pix.count },
      { name: 'Cartão', value: methods.card.value, count: methods.card.count },
      { name: 'Dinheiro', value: methods.cash.value, count: methods.cash.count },
    ].filter((m) => m.value > 0);
  }, [filteredOrders]);

  // CLIENTES
  const topCustomers = useMemo(() => {
    const customers: Record<string, { name: string; email: string; orders: number; totalSpent: number }> = {};

    filteredOrders.forEach((order) => {
      const email = order.customer.email;
      if (!customers[email]) {
        customers[email] = {
          name: order.customer.name,
          email,
          orders: 0,
          totalSpent: 0,
        };
      }
      customers[email].orders += 1;
      customers[email].totalSpent += order.total;
    });

    return Object.values(customers)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);
  }, [filteredOrders]);

  // OPERACIONAL
  const operational = useMemo(() => {
    const deliveryOrders = filteredOrders.filter((o) => o.deliveryType === 'delivery').length;
    const pickupOrders = filteredOrders.filter((o) => o.deliveryType === 'pickup').length;
    const totalDeliveryValue = filteredOrders
      .filter((o) => o.deliveryType === 'delivery')
      .reduce((sum, o) => sum + o.total, 0);
    const totalPickupValue = filteredOrders
      .filter((o) => o.deliveryType === 'pickup')
      .reduce((sum, o) => sum + o.total, 0);

    return {
      delivery: { count: deliveryOrders, value: totalDeliveryValue },
      pickup: { count: pickupOrders, value: totalPickupValue },
      deliveryRate: filteredOrders.length > 0 ? ((deliveryOrders / filteredOrders.length) * 100).toFixed(1) : '0',
    };
  }, [filteredOrders]);

  // PONTOS DE LEALDADE
  const loyaltyMetrics = useMemo(() => {
    let pointsSold = 0;
    let pointsRedeemed = 0;
    let pointsPending = 0;

    filteredOrders.forEach((order) => {
      pointsPending += order.pendingPoints || 0;
      pointsRedeemed += order.pointsRedeemed || 0;
    });

    pointsSold = pointsPending + pointsRedeemed;
    return { pointsSold, pointsRedeemed, pointsPending, netPoints: pointsSold - pointsRedeemed };
  }, [filteredOrders]);

  // DADOS POR DIA (gráfico de linha)
  const salesByDay = useMemo(() => {
    const dayData: Record<string, number> = {};

    filteredOrders.forEach((order) => {
      const day = format(new Date(order.createdAt), 'dd/MM');
      dayData[day] = (dayData[day] || 0) + order.total;
    });

    return Object.entries(dayData)
      .map(([day, value]) => ({ day, value }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [filteredOrders]);

  // EXPORT CSV
  const exportToCSV = () => {
    const timestamp = format(new Date(), 'dd-MM-yyyy_HH-mm-ss');
    const filename = `relatorio_pizzaria_${timestamp}.csv`;

    let csvContent = 'Relatório de Vendas - Forneiro Eden\n';
    csvContent += `Período: ${dateRange.startDate} até ${dateRange.endDate}\n`;
    csvContent += `Data de Geração: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}\n\n`;

    // RESUMO
    csvContent += 'RESUMO EXECUTIVO\n';
    csvContent += `Total de Vendas,R$ ${salesMetrics.totalSales.toFixed(2)}\n`;
    csvContent += `Total de Pedidos,${salesMetrics.totalOrders}\n`;
    csvContent += `Ticket Médio,R$ ${salesMetrics.avgTicket.toFixed(2)}\n`;
    csvContent += `Crescimento,${salesMetrics.growth.toFixed(2)}%\n\n`;

    // FORMA DE PAGAMENTO
    csvContent += 'FORMA DE PAGAMENTO\n';
    csvContent += 'Método,Quantidade,Valor\n';
    paymentMethods.forEach((m) => {
      csvContent += `${m.name},${m.count},R$ ${m.value.toFixed(2)}\n`;
    });
    csvContent += '\n';

    // OPERACIONAL
    csvContent += 'OPERACIONAL\n';
    csvContent += `Entregas,${operational.delivery.count},R$ ${operational.delivery.value.toFixed(2)}\n`;
    csvContent += `Retiradas,${operational.pickup.count},R$ ${operational.pickup.value.toFixed(2)}\n`;
    csvContent += `Taxa de Entrega,${operational.deliveryRate}%\n\n`;

    // TOP PRODUTOS
    csvContent += 'TOP 10 PRODUTOS\n';
    csvContent += 'Produto,Quantidade,Receita\n';
    topProducts.forEach((p) => {
      csvContent += `${p.name},${p.quantity},R$ ${p.revenue.toFixed(2)}\n`;
    });
    csvContent += '\n';

    // TOP CLIENTES
    csvContent += 'TOP 10 CLIENTES\n';
    csvContent += 'Nome,Email,Pedidos,Total Gasto\n';
    topCustomers.forEach((c) => {
      csvContent += `${c.name},${c.email},${c.orders},R$ ${c.totalSpent.toFixed(2)}\n`;
    });
    csvContent += '\n';

    // PONTOS
    csvContent += 'PONTOS DE LEALDADE\n';
    csvContent += `Pontos Vendidos,${loyaltyMetrics.pointsSold}\n`;
    csvContent += `Pontos Resgatados,${loyaltyMetrics.pointsRedeemed}\n`;
    csvContent += `Pontos Pendentes,${loyaltyMetrics.pointsPending}\n`;

    const link = document.createElement('a');
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
    link.download = filename;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Seletor de Período */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Filtrar Período</span>
            <Button size="sm" onClick={exportToCSV} className="gap-2">
              <Download className="w-4 h-4" />
              Exportar CSV
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-date">Data Inicial</Label>
              <Input
                id="start-date"
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="end-date">Data Final</Label>
              <Input
                id="end-date"
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-orange-500" />
              Total de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {salesMetrics.totalSales.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {salesMetrics.growth >= 0 ? (
                <span className="text-green-500 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  +{salesMetrics.growth.toFixed(1)}%
                </span>
              ) : (
                <span className="text-red-500 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />
                  {salesMetrics.growth.toFixed(1)}%
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-blue-500" />
              Total de Pedidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesMetrics.totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">neste período</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {salesMetrics.avgTicket.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">por pedido</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" />
              Clientes Únicos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(filteredOrders.map((o) => o.customer.email)).size}
            </div>
            <p className="text-xs text-muted-foreground mt-1">neste período</p>
          </CardContent>
        </Card>
      </div>

      {/* GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vendas por Dia */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Vendas por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip formatter={(value: any) => `R$ ${Number(value).toFixed(2)}`} />
                <Line type="monotone" dataKey="value" stroke="#FF8C42" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Forma de Pagamento */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Forma de Pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={paymentMethods} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {paymentMethods.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `R$ ${Number(value).toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {paymentMethods.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    {m.name}
                  </span>
                  <span className="font-medium">{m.count} pedidos</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DELIVERY VS RETIRADA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Operacional - Entrega vs Retirada</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Entregas</p>
              <p className="text-2xl font-bold">{operational.delivery.count}</p>
              <p className="text-xs text-muted-foreground">R$ {operational.delivery.value.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Retiradas</p>
              <p className="text-2xl font-bold">{operational.pickup.count}</p>
              <p className="text-xs text-muted-foreground">R$ {operational.pickup.value.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Taxa de Entrega</p>
              <p className="text-2xl font-bold">{operational.deliveryRate}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TOP PRODUTOS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Top 10 Produtos Mais Vendidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.map((product, i) => (
                  <TableRow key={i}>
                    <TableCell>{product.name}</TableCell>
                    <TableCell className="text-right font-medium">{product.quantity}</TableCell>
                    <TableCell className="text-right">R$ {product.revenue.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* TOP CLIENTES */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Top 10 Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Total Gasto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCustomers.map((customer, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell className="text-sm">{customer.email}</TableCell>
                    <TableCell className="text-right">{customer.orders}</TableCell>
                    <TableCell className="text-right font-medium">R$ {customer.totalSpent.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* PONTOS DE LEALDADE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pontos de Lealdade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Pontos Vendidos</p>
              <p className="text-2xl font-bold">{loyaltyMetrics.pointsSold}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Pontos Resgatados</p>
              <p className="text-2xl font-bold">{loyaltyMetrics.pointsRedeemed}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Pontos Pendentes</p>
              <p className="text-2xl font-bold">{loyaltyMetrics.pointsPending}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Saldo Líquido</p>
              <p className="text-2xl font-bold text-primary">{loyaltyMetrics.netPoints}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
