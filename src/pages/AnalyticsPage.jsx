import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler } from 'chart.js';
import { Pie, Bar, Line } from 'react-chartjs-2';
import { calculateCategoryBreakdown, calculateMonthlyTrend, formatCurrency } from '../utils/helpers';
import { CATEGORIES, MONTHS_VI } from '../utils/constants';
import { TrendingUp, PieChart as PieIcon, BarChart3, Calendar } from 'lucide-react';
import './AnalyticsPage.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#0F172A',
        font: { family: 'Space Grotesk', size: 12, weight: 700 },
        padding: 16,
        usePointStyle: true,
        pointStyleWidth: 10,
      },
    },
    tooltip: {
      backgroundColor: '#FFFFFF',
      titleColor: '#0F172A',
      bodyColor: '#0F172A',
      borderColor: '#0F172A',
      borderWidth: 3,
      padding: 12,
      cornerRadius: 0,
      titleFont: { family: 'Space Grotesk', weight: 800 },
      bodyFont: { family: 'Space Grotesk', weight: 600 },
      callbacks: {
        label: (ctx) => {
          const val = ctx.parsed.y !== undefined ? ctx.parsed.y : ctx.parsed;
          return ` ${ctx.label}: ${val.toLocaleString('vi-VN')}₫`;
        },
      },
    },
  },
};

export default function AnalyticsPage() {
  const { state } = useApp();
  const { transactions, currentUser, users } = state;
  const partner = Object.values(users).find(u => u.id !== currentUser?.id);

  const [timeRange, setTimeRange] = useState(6); // months
  const [chartType, setChartType] = useState('bar'); // bar or line

  // Category breakdown (this month)
  const now = new Date();
  const thisMonthTx = transactions.filter(tx => {
    if (tx.isSettlement) return false;
    const d = new Date(tx.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  const categoryBreakdown = useMemo(() => calculateCategoryBreakdown(thisMonthTx), [thisMonthTx]);

  const pieData = useMemo(() => {
    const entries = Object.entries(categoryBreakdown);
    entries.sort((a, b) => b[1] - a[1]);
    const labels = entries.map(([catId]) => CATEGORIES.find(c => c.id === catId)?.label || catId);
    const data = entries.map(([, val]) => val);
    const colors = entries.map(([catId]) => {
      const cat = CATEGORIES.find(c => c.id === catId);
      // Convert CSS var references to actual hex colors
      const colorMap = {
        food: '#F59E0B',
        housing: '#8B5CF6',
        dating: '#EC4899',
        shopping: '#FBBF24',
        transport: '#3B82F6',
        entertainment: '#A855F7',
        utilities: '#10B981',
        health: '#14B8A6',
        other: '#64748B',
      };
      return colorMap[catId] || '#64748B';
    });

    return {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: '#0F172A',
        borderWidth: 3,
        hoverOffset: 8,
      }],
    };
  }, [categoryBreakdown]);

  // Monthly trend
  const monthlyTrend = useMemo(() => calculateMonthlyTrend(transactions, timeRange), [transactions, timeRange]);

  const trendData = useMemo(() => ({
    labels: monthlyTrend.map(m => m.label),
    datasets: [{
      label: 'Tổng chi tiêu',
      data: monthlyTrend.map(m => m.total),
      backgroundColor: chartType === 'bar' ? '#FBBF24' : '#FBBF24',
      borderColor: '#0F172A',
      borderWidth: 3,
      borderRadius: 0,
      fill: chartType === 'line',
      tension: 0,
      pointBackgroundColor: '#FBBF24',
      pointBorderColor: '#0F172A',
      pointBorderWidth: 3,
      pointRadius: chartType === 'line' ? 6 : 0,
      pointHoverRadius: 8,
    }],
  }), [monthlyTrend, chartType]);

  const barOptions = {
    ...chartOptions,
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#0F172A', font: { family: 'Space Grotesk', size: 12, weight: 700 } },
      },
      y: {
        grid: { color: '#E2E8F0', drawBorder: true, borderColor: '#0F172A' },
        ticks: {
          color: '#0F172A',
          font: { family: 'Space Grotesk', size: 11, weight: 700 },
          callback: (val) => (val / 1000000).toFixed(1) + 'M',
        },
      },
    },
    plugins: {
      ...chartOptions.plugins,
      legend: { display: false },
    },
  };

  // Per-person spending
  const perPersonStats = useMemo(() => {
    const userAPaid = transactions.filter(tx => !tx.isSettlement && tx.paidBy === currentUser?.id)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const userBPaid = transactions.filter(tx => !tx.isSettlement && tx.paidBy === partner?.id)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const total = userAPaid + userBPaid;
    return {
      userAPaid, userBPaid, total,
      userAPercent: total > 0 ? Math.round((userAPaid / total) * 100) : 0,
      userBPercent: total > 0 ? Math.round((userBPaid / total) * 100) : 0,
    };
  }, [transactions, currentUser, partner]);

  const totalThisMonth = Object.values(categoryBreakdown).reduce((a, b) => a + b, 0);

  return (
    <div className="analytics-page">
      {/* Summary strip */}
      <div className="analytics-summary animate-fadeInUp">
        <div className="summary-item glass-card-sm">
          <span className="summary-label">Tổng chi tiêu tháng này</span>
          <span className="summary-value">{formatCurrency(totalThisMonth)}</span>
        </div>
        <div className="summary-item glass-card-sm">
          <span className="summary-label">{currentUser?.name} đã trả</span>
          <span className="summary-value" style={{ color: 'var(--accent-primary)' }}>{formatCurrency(perPersonStats.userAPaid)} ({perPersonStats.userAPercent}%)</span>
        </div>
        <div className="summary-item glass-card-sm">
          <span className="summary-label">{partner?.name} đã trả</span>
          <span className="summary-value" style={{ color: 'var(--cat-dating)' }}>{formatCurrency(perPersonStats.userBPaid)} ({perPersonStats.userBPercent}%)</span>
        </div>
      </div>

      <div className="analytics-grid">
        {/* Pie Chart */}
        <div className="chart-card glass-card animate-fadeInUp stagger-2">
          <div className="chart-header">
            <h2 className="chart-title">
              <PieIcon size={18} />
              Cơ cấu chi tiêu
            </h2>
            <span className="badge badge-accent">Tháng này</span>
          </div>
          <div className="chart-container pie-container">
            {Object.keys(categoryBreakdown).length > 0 ? (
              <Pie data={pieData} options={{
                ...chartOptions,
                plugins: {
                  ...chartOptions.plugins,
                  legend: {
                    ...chartOptions.plugins.legend,
                    position: 'bottom',
                  },
                },
              }} />
            ) : (
              <div className="empty-state">
                <p className="empty-state-desc">Chưa có dữ liệu</p>
              </div>
            )}
          </div>
          {/* Legend details */}
          {Object.keys(categoryBreakdown).length > 0 && (
            <div className="pie-details">
              {Object.entries(categoryBreakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([catId, amount]) => {
                  const cat = CATEGORIES.find(c => c.id === catId);
                  const percent = totalThisMonth > 0 ? Math.round((amount / totalThisMonth) * 100) : 0;
                  return (
                    <div key={catId} className="pie-detail-item">
                      <span className="pie-detail-label">
                        <span className="category-dot" style={{ background: cat?.color }} />
                        {cat?.label}
                      </span>
                      <span className="pie-detail-value">{percent}%</span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Trend Chart */}
        <div className="chart-card glass-card animate-fadeInUp stagger-3">
          <div className="chart-header">
            <h2 className="chart-title">
              <TrendingUp size={18} />
              Xu hướng chi tiêu
            </h2>
            <div className="chart-controls">
              <div className="chart-type-toggle">
                <button
                  className={`toggle-btn ${chartType === 'bar' ? 'active' : ''}`}
                  onClick={() => setChartType('bar')}
                >
                  <BarChart3 size={14} />
                </button>
                <button
                  className={`toggle-btn ${chartType === 'line' ? 'active' : ''}`}
                  onClick={() => setChartType('line')}
                >
                  <TrendingUp size={14} />
                </button>
              </div>
              <select
                className="form-select time-select"
                value={timeRange}
                onChange={(e) => setTimeRange(parseInt(e.target.value))}
              >
                <option value={3}>3 tháng</option>
                <option value={6}>6 tháng</option>
                <option value={12}>12 tháng</option>
              </select>
            </div>
          </div>
          <div className="chart-container trend-container">
            {chartType === 'bar' ? (
              <Bar data={trendData} options={barOptions} />
            ) : (
              <Line data={trendData} options={barOptions} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
