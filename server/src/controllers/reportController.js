// ============================================================
// College Grievance Portal — Report Controller
// HOD/Dean: Monthly statistics + Excel export
// PostgreSQL-compatible queries (EXTRACT, TO_CHAR, $1 params)
// ============================================================
const pool = require('../config/db');
const ExcelJS = require('exceljs');

// ─── GET /api/reports/summary ─────────────────────────────────
async function getSummary(req, res) {
  try {
    const { year } = req.query;
    let yearFilter = '';
    const params = [];
    if (year) {
      yearFilter = 'WHERE EXTRACT(YEAR FROM created_at)::int = $1';
      params.push(parseInt(year));
    }

    // SUM(CASE WHEN ...) works on both PostgreSQL and MySQL
    const result = await pool.query(`
      SELECT
        COUNT(*)                                                   AS total,
        SUM(CASE WHEN status = 'Submitted' THEN 1 ELSE 0 END)     AS submitted,
        SUM(CASE WHEN status = 'Assigned' THEN 1 ELSE 0 END)      AS assigned,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END)   AS in_progress,
        SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END)      AS resolved,
        SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END)        AS closed,
        SUM(CASE WHEN source = 'Google Form' THEN 1 ELSE 0 END)   AS from_google_form,
        SUM(CASE WHEN source = 'Portal' THEN 1 ELSE 0 END)        AS from_portal,
        SUM(CASE WHEN source = 'Internal' THEN 1 ELSE 0 END)      AS internal_tasks
      FROM grievances
      ${yearFilter}
    `, params);

    // Normalize values to strings for frontend consistency
    const row = result.rows[0] || {};
    const summary = {};
    for (const key of Object.keys(row)) {
      summary[key] = String(row[key] || 0);
    }

    res.json({ summary });
  } catch (err) {
    console.error('Get summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── GET /api/reports/monthly ─────────────────────────────────
async function getMonthlyReport(req, res) {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    // PostgreSQL: EXTRACT + TO_CHAR for month name
    const result = await pool.query(`
      SELECT
        EXTRACT(MONTH FROM created_at)::int                        AS month,
        TO_CHAR(created_at, 'Month')                               AS month_name,
        COUNT(*)                                                   AS total,
        SUM(CASE WHEN status = 'Submitted' THEN 1 ELSE 0 END)     AS submitted,
        SUM(CASE WHEN status = 'Assigned' THEN 1 ELSE 0 END)      AS assigned,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END)   AS in_progress,
        SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END)      AS resolved,
        SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END)        AS closed
      FROM grievances
      WHERE EXTRACT(YEAR FROM created_at)::int = $1
      GROUP BY EXTRACT(MONTH FROM created_at)::int, TO_CHAR(created_at, 'Month')
      ORDER BY month ASC
    `, [year]);

    // Fill in all 12 months (even those with 0 records)
    const monthNames = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
    const filled = monthNames.map((name, i) => {
      const found = result.rows.find(r => parseInt(r.month) === i + 1);
      return found ? {
        month: parseInt(found.month),
        month_name: (found.month_name || name).trim(),
        total: String(found.total || 0),
        submitted: String(found.submitted || 0),
        assigned: String(found.assigned || 0),
        in_progress: String(found.in_progress || 0),
        resolved: String(found.resolved || 0),
        closed: String(found.closed || 0),
      } : {
        month: i + 1,
        month_name: name,
        total: '0', submitted: '0', assigned: '0',
        in_progress: '0', resolved: '0', closed: '0',
      };
    });

    res.json({ year, report: filled });
  } catch (err) {
    console.error('Get monthly report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── GET /api/reports/export — Download Excel ─────────────────
async function exportExcel(req, res) {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const collegeName = process.env.COLLEGE_NAME || 'College Grievance Portal';

    // Fetch monthly data (PostgreSQL-compatible)
    const result = await pool.query(`
      SELECT
        EXTRACT(MONTH FROM created_at)::int                        AS month,
        TO_CHAR(created_at, 'Month')                               AS month_name,
        COUNT(*)                                                   AS total,
        SUM(CASE WHEN status = 'Submitted' THEN 1 ELSE 0 END)     AS submitted,
        SUM(CASE WHEN status = 'Assigned' THEN 1 ELSE 0 END)      AS assigned,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END)   AS in_progress,
        SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END)      AS resolved,
        SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END)        AS closed
      FROM grievances
      WHERE EXTRACT(YEAR FROM created_at)::int = $1
      GROUP BY EXTRACT(MONTH FROM created_at)::int, TO_CHAR(created_at, 'Month')
      ORDER BY month ASC
    `, [year]);

    const monthNames = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
    const rows = monthNames.map((name, i) => {
      const found = result.rows.find(r => parseInt(r.month) === i + 1);
      return found || { month: i + 1, month_name: name, total: 0, submitted: 0, assigned: 0, in_progress: 0, resolved: 0, closed: 0 };
    });

    // Build Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = collegeName;
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(`Grievance Report ${year}`, {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
    });

    // ── Column Widths
    sheet.columns = [
      { key: 'month',       width: 6  },
      { key: 'month_name',  width: 16 },
      { key: 'total',       width: 10 },
      { key: 'submitted',   width: 13 },
      { key: 'assigned',    width: 12 },
      { key: 'in_progress', width: 13 },
      { key: 'resolved',    width: 12 },
      { key: 'closed',      width: 10 },
    ];

    // ── Title Row
    sheet.mergeCells('A1:H1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `${collegeName} — Grievance Monthly Report (${year})`;
    titleCell.font = { bold: true, size: 16, color: { argb: 'FF1D4ED8' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
    sheet.getRow(1).height = 36;

    // ── Generated Date Row
    sheet.mergeCells('A2:H2');
    const dateCell = sheet.getCell('A2');
    dateCell.value = `Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    dateCell.font = { italic: true, size: 11, color: { argb: 'FF64748B' } };
    dateCell.alignment = { horizontal: 'center' };
    sheet.getRow(2).height = 22;

    // ── Header Row
    const headerRow = sheet.addRow([
      '#', 'Month', 'Total', 'Pending (Submitted)', 'Assigned', 'In Progress', 'Resolved', 'Closed'
    ]);
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { bottom: { style: 'medium', color: { argb: 'FF1E40AF' } } };
    });
    sheet.getRow(3).height = 28;

    // ── Data Rows
    let totalSum = 0, submittedSum = 0, assignedSum = 0, inProgressSum = 0, resolvedSum = 0, closedSum = 0;
    rows.forEach((row, i) => {
      const t = parseInt(row.total) || 0;
      const sub = parseInt(row.submitted) || 0;
      const asgn = parseInt(row.assigned) || 0;
      const ip = parseInt(row.in_progress) || 0;
      const reso = parseInt(row.resolved) || 0;
      const cls = parseInt(row.closed) || 0;

      totalSum += t; submittedSum += sub; assignedSum += asgn;
      inProgressSum += ip; resolvedSum += reso; closedSum += cls;

      const monthNameStr = typeof row.month_name === 'string' ? row.month_name.trim() : monthNames[i];
      const dataRow = sheet.addRow([i + 1, monthNameStr, t, sub, asgn, ip, reso, cls]);
      dataRow.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: colNumber <= 2 ? 'left' : 'center', vertical: 'middle' };
        cell.border = {
          top:    { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left:   { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right:  { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        if (i % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
        }
      });

      // Color code the resolved column
      const resolvedCell = dataRow.getCell(7);
      if (reso > 0) {
        resolvedCell.font = { bold: true, color: { argb: 'FF059669' } };
      }
      const pendingCell = dataRow.getCell(4);
      if (sub > 0) {
        pendingCell.font = { bold: true, color: { argb: 'FFD97706' } };
      }
      dataRow.height = 22;
    });

    // ── Summary Row
    const summaryRow = sheet.addRow(['', 'TOTAL', totalSum, submittedSum, assignedSum, inProgressSum, resolvedSum, closedSum]);
    summaryRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      cell.alignment = { horizontal: colNumber <= 2 ? 'left' : 'center', vertical: 'middle' };
      cell.border = { top: { style: 'medium', color: { argb: 'FF1D4ED8' } } };
    });
    summaryRow.height = 26;

    // ── Stream to response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Grievance_Report_${year}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export Excel error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── GET /api/reports/grievances-detail — Full list for export
async function exportGrievancesDetail(req, res) {
  try {
    const { year, status } = req.query;
    const collegeName = process.env.COLLEGE_NAME || 'College Grievance Portal';

    let where = [];
    let params = [];
    let idx = 1;
    if (year) { where.push(`EXTRACT(YEAR FROM g.created_at)::int = $${idx++}`); params.push(parseInt(year)); }
    if (status) { where.push(`g.status = $${idx++}`); params.push(status); }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT
        g.grievance_id, g.title, g.status, g.source,
        COALESCE(g.student_name, u_c.name) AS student_name,
        COALESCE(g.student_email, u_c.email) AS student_email,
        g.admission_no, g.program_name,
        u_f.name AS faculty_name,
        u_h.name AS hod_name,
        g.remark_student, g.created_at, g.resolved_at
      FROM grievances g
      LEFT JOIN users u_c ON g.created_by   = u_c.user_id
      LEFT JOIN users u_f ON g.assigned_to  = u_f.user_id
      LEFT JOIN users u_h ON g.assigned_hod = u_h.user_id
      ${whereClause}
      ORDER BY g.created_at DESC
    `, params);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Grievances Detail');

    sheet.columns = [
      { header: 'ID',           key: 'grievance_id', width: 8  },
      { header: 'Title',        key: 'title',        width: 30 },
      { header: 'Status',       key: 'status',       width: 14 },
      { header: 'Source',       key: 'source',       width: 14 },
      { header: 'Student',      key: 'student_name', width: 20 },
      { header: 'Email',        key: 'student_email',width: 25 },
      { header: 'Adm. No.',     key: 'admission_no', width: 14 },
      { header: 'Program',      key: 'program_name', width: 20 },
      { header: 'Faculty',      key: 'faculty_name', width: 20 },
      { header: 'HOD',          key: 'hod_name',     width: 20 },
      { header: 'Remark',       key: 'remark_student', width: 30 },
      { header: 'Submitted On', key: 'created_at',   width: 20 },
      { header: 'Resolved On',  key: 'resolved_at',  width: 20 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center' };
    });
    headerRow.height = 24;

    result.rows.forEach((row, i) => {
      const r = sheet.addRow({
        ...row,
        created_at: row.created_at ? new Date(row.created_at).toLocaleDateString('en-IN') : '',
        resolved_at: row.resolved_at ? new Date(row.resolved_at).toLocaleDateString('en-IN') : '',
      });
      if (i % 2 === 1) {
        r.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
        });
      }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Grievances_Detail_${year || 'All'}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getSummary, getMonthlyReport, exportExcel, exportGrievancesDetail };
