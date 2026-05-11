/* ============================================================
   js/dashboard.js — Dashboard chart helpers (placeholder for Chart.js integration)
   ============================================================ */

// Monthly claims trend data builder
async function buildMonthlyTrend() {
  try {
    const { data } = await db.from('claims')
      .select('status, submitted_at')
      .gte('submitted_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString());

    if (!data?.length) return null;

    // Group by month
    const months = {};
    data.forEach(c => {
      const m = new Date(c.submitted_at).toLocaleDateString('en-AE', { month: 'short', year: '2-digit' });
      if (!months[m]) months[m] = { pending: 0, approved: 0, rejected: 0, cancelled: 0, total: 0 };
      months[m][c.status] = (months[m][c.status] || 0) + 1;
      months[m].total++;
    });

    return months;
  } catch(e) {
    console.error('Trend error:', e);
    return null;
  }
}

// Top facilities by claim volume
async function buildFacilityRanking() {
  try {
    const { data: facilities } = await db.from('facilities').select('id, name').eq('is_active', true);
    if (!facilities?.length) return [];

    const rankings = await Promise.all(facilities.map(async f => {
      const { count: total } = await db.from('claims')
        .select('id', { count: 'exact', head: true })
        .eq('facility_id', f.id);
      const { count: approved } = await db.from('claims')
        .select('id', { count: 'exact', head: true })
        .eq('facility_id', f.id)
        .eq('status', 'approved');
      return { ...f, total: total || 0, approved: approved || 0 };
    }));

    return rankings.sort((a, b) => b.total - a.total).slice(0, 8);
  } catch(e) {
    console.error('Ranking error:', e);
    return [];
  }
}

// Insurance company breakdown
async function buildInsuranceBreakdown() {
  try {
    const { data: ins } = await db.from('insurance_companies').select('id, name').eq('is_active', true);
    if (!ins?.length) return [];

    const breakdown = await Promise.all(ins.map(async i => {
      const { count } = await db.from('claims')
        .select('id', { count: 'exact', head: true })
        .eq('insurance_id', i.id);
      const { data: amtData } = await db.from('invoices')
        .select('claim_amount')
        .eq('insurance_id', i.id);
      const totalAmt = (amtData || []).reduce((s, r) => s + (+r.claim_amount || 0), 0);
      return { ...i, count: count || 0, totalAmt };
    }));

    return breakdown.filter(b => b.count > 0).sort((a, b) => b.count - a.count);
  } catch(e) {
    console.error('Insurance breakdown error:', e);
    return [];
  }
}
