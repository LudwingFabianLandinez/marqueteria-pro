/* prepareChartData.js
 * Utility to transform orders into Chart.js bar datasets
 * Attaches `prepareOrdersChartData` to `window` for browser usage.
 */
(function(global){
  function prepareOrdersChartData(orders, options) {
    options = options || {};
    const dateField = options.dateField || 'fecha';
    const totalField = options.totalField || 'total';
    const saldoField = options.saldoField || 'saldo';
    const excludeStates = options.excludeStates || ['Anulado'];
    const locale = options.locale;

    const map = new Map();

    const toKey = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    };

    function parseNumberValue(v) {
      if (v == null) return 0;
      if (typeof v === 'number') return v;
      let s = String(v).trim();
      // remove currency symbols and spaces
      s = s.replace(/[^0-9.,-]/g, '');
      if (!s) return 0;
      // If both dot and comma exist, assume dot thousands and comma decimal (es-CO)
      if (s.indexOf('.') !== -1 && s.indexOf(',') !== -1) {
        s = s.replace(/\./g, '').replace(/,/g, '.');
      } else if (s.indexOf('.') !== -1 && s.indexOf(',') === -1) {
        // only dots present, assume they are thousand separators
        s = s.replace(/\./g, '');
      } else if (s.indexOf(',') !== -1 && s.indexOf('.') === -1) {
        // only comma present, assume decimal
        s = s.replace(/,/g, '.');
      }
      const n = Number(s);
      return isNaN(n) ? 0 : n;
    }

    (orders || []).forEach(o => {
      if (excludeStates && excludeStates.includes(String(o.estado || '').trim())) return;
      const raw = o[dateField];
      const dt = raw instanceof Date ? raw : new Date(raw);
      if (isNaN(dt)) return;
      const key = toKey(dt);
      const existing = map.get(key);
      const totalVal = parseNumberValue(o[totalField] || o.totalFactura || 0);
      const saldoVal = parseNumberValue(o[saldoField] || o.saldo || o.total - (o.totalPagado || o.abono || 0) || 0);
      if (existing) {
        existing.total += totalVal;
        existing.saldo += saldoVal;
      } else {
        map.set(key, { date: new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()), total: totalVal, saldo: saldoVal });
      }
    });

    const rows = Array.from(map.values()).sort((a,b) => a.date - b.date);
    const labels = rows.map(r => r.date.toLocaleDateString(locale));
    const totals = rows.map(r => Math.round(r.total * 100) / 100);
    const saldos = rows.map(r => Math.round(r.saldo * 100) / 100);

    return {
      labels,
      datasets: [
        {
          label: 'Total Venta',
          backgroundColor: '#1e3a8a',
          borderColor: '#1e3a8a',
          data: totals
        },
        {
          label: 'Saldo Pendiente',
          backgroundColor: '#dc2626',
          borderColor: '#dc2626',
          data: saldos
        }
      ]
    };
  }

  global.prepareOrdersChartData = prepareOrdersChartData;
})(window);

/* Usage:
   <script src="/js/prepareChartData.js"></script>
   const cfg = prepareOrdersChartData(ordersArray, { dateField: 'fecha', totalField: 'total', saldoField: 'saldo', locale: 'es-CO' });
   new Chart(ctx, { type: 'bar', data: cfg, options: {} });
*/
