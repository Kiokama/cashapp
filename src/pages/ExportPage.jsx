import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { FileText, Download, FileSpreadsheet, Table2, Calendar, CheckCircle } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/helpers';
import { CATEGORIES } from '../utils/constants';
import './ExportPage.css';

export default function ExportPage() {
  const { state, dispatch } = useApp();
  const { transactions, users, currentUser } = state;
  const [exportType, setExportType] = useState('csv');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exported, setExported] = useState(false);

  const filteredTransactions = transactions.filter(tx => {
    if (tx.isSettlement) return false;
    if (dateFrom && new Date(tx.date) < new Date(dateFrom)) return false;
    if (dateTo && new Date(tx.date) > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  }).sort((a, b) => new Date(a.date) - new Date(b.date));

  const handleExportCSV = () => {
    const headers = ['Ngày', 'Mô tả', 'Danh mục', 'Số tiền', 'Người trả', 'Phần của bạn', 'Cách chia'];
    const rows = filteredTransactions.map(tx => {
      const cat = CATEGORIES.find(c => c.id === tx.category);
      const payer = users[tx.paidBy];
      return [
        formatDate(tx.date),
        tx.description,
        cat?.label || tx.category,
        tx.amount,
        payer?.name || '',
        tx.splits[currentUser?.id] || 0,
        tx.splitType === 'equal' ? 'Chia đều' : tx.splitType === 'percentage' ? 'Theo %' : 'Số tiền cụ thể',
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cashapp_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    setExported(true);
    dispatch({ type: 'ADD_TOAST', payload: { message: 'Đã xuất file CSV thành công!', type: 'success' } });
    setTimeout(() => setExported(false), 3000);
  };

  const handleExportPDF = () => {
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF();

      // Title
      doc.setFontSize(18);
      doc.text('CashApp - Bao cao chi tieu', 14, 22);

      doc.setFontSize(10);
      doc.text(`Xuat ngay: ${new Date().toLocaleDateString('vi-VN')}`, 14, 30);
      if (dateFrom || dateTo) {
        doc.text(`Tu: ${dateFrom || 'Bat dau'} - Den: ${dateTo || 'Hien tai'}`, 14, 36);
      }

      // Table
      let y = 46;
      doc.setFontSize(9);
      doc.setTextColor(100);

      // Header
      const cols = [14, 44, 94, 124, 154, 180];
      const headerLabels = ['Ngay', 'Mo ta', 'Danh muc', 'So tien', 'Nguoi tra', 'Phan ban'];
      headerLabels.forEach((label, i) => doc.text(label, cols[i], y));

      y += 4;
      doc.setDrawColor(200);
      doc.line(14, y, 196, y);
      y += 6;

      doc.setTextColor(50);
      filteredTransactions.forEach(tx => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }

        const cat = CATEGORIES.find(c => c.id === tx.category);
        const payer = users[tx.paidBy];

        doc.text(formatDate(tx.date), cols[0], y);
        doc.text(tx.description.substring(0, 28), cols[1], y);
        doc.text(cat?.label || '', cols[2], y);
        doc.text(tx.amount.toLocaleString(), cols[3], y);
        doc.text((payer?.name || '').substring(0, 12), cols[4], y);
        doc.text((tx.splits[currentUser?.id] || 0).toLocaleString(), cols[5], y);

        y += 7;
      });

      // Total
      y += 4;
      doc.line(14, y, 196, y);
      y += 8;
      const total = filteredTransactions.reduce((s, tx) => s + tx.amount, 0);
      doc.setFontSize(11);
      doc.text(`Tong: ${total.toLocaleString()} VND`, 14, y);

      doc.save(`cashapp_export_${new Date().toISOString().split('T')[0]}.pdf`);

      setExported(true);
      dispatch({ type: 'ADD_TOAST', payload: { message: 'Đã xuất file PDF thành công!', type: 'success' } });
      setTimeout(() => setExported(false), 3000);
    });
  };

  const handleExport = () => {
    if (exportType === 'csv') handleExportCSV();
    else handleExportPDF();
  };

  return (
    <div className="export-page">
      <div className="export-container animate-fadeInUp">
        {/* Export options */}
        <div className="export-card glass-card">
          <div className="export-header">
            <div className="export-icon-wrap">
              <FileText size={28} />
            </div>
            <div>
              <h2>Xuất báo cáo chi tiêu</h2>
              <p className="export-desc">Tải xuống dữ liệu chi tiêu dưới dạng CSV hoặc PDF</p>
            </div>
          </div>

          {/* Format selection */}
          <div className="export-formats">
            <button
              className={`format-card glass-card-sm ${exportType === 'csv' ? 'active' : ''}`}
              onClick={() => setExportType('csv')}
            >
              <FileSpreadsheet size={24} />
              <div>
                <strong>CSV / Excel</strong>
                <p>Dữ liệu bảng tính, dễ phân tích</p>
              </div>
            </button>
            <button
              className={`format-card glass-card-sm ${exportType === 'pdf' ? 'active' : ''}`}
              onClick={() => setExportType('pdf')}
            >
              <FileText size={24} />
              <div>
                <strong>PDF</strong>
                <p>Báo cáo dạng tài liệu, dễ in ấn</p>
              </div>
            </button>
          </div>

          {/* Date range */}
          <div className="export-date-range">
            <h3>
              <Calendar size={16} />
              Khoảng thời gian
            </h3>
            <div className="date-inputs">
              <div className="form-group">
                <label className="form-label">Từ ngày</label>
                <input
                  type="date"
                  className="form-input"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Đến ngày</label>
                <input
                  type="date"
                  className="form-input"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="export-preview">
            <div className="preview-info">
              <Table2 size={16} />
              <span>{filteredTransactions.length} giao dịch sẽ được xuất</span>
            </div>
            {filteredTransactions.length > 0 && (
              <div className="preview-total">
                Tổng: <strong>{formatCurrency(filteredTransactions.reduce((s, tx) => s + tx.amount, 0))}</strong>
              </div>
            )}
          </div>

          {/* Export button */}
          <button
            className={`btn-primary btn-lg export-btn ${exported ? 'exported' : ''}`}
            onClick={handleExport}
            disabled={filteredTransactions.length === 0}
          >
            {exported ? (
              <>
                <CheckCircle size={20} />
                Đã xuất thành công!
              </>
            ) : (
              <>
                <Download size={20} />
                Xuất {exportType.toUpperCase()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
