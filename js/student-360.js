const student360State = {
    students: [],
    currentStudent: null,
    feeSummary: {},
    ledgerTransactions: [],
    marksDoc: null,
    marksheetRows: []
};

const student360Params = new URLSearchParams(window.location.search);
const STUDENT360_MONTHS = [
    'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December', 'January', 'February', 'March'
];

function student360Money(value) {
    return (Number(value) || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function student360Date(value) {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-IN');
}

function student360Escape(value = '') {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function student360SetText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value || '-';
}

function student360ApiHeaders() {
    return {
        Authorization: `Bearer ${Auth.getToken()}`,
        'Content-Type': 'application/json'
    };
}

async function student360FetchJson(path) {
    const response = await fetch(`${CONFIG.API_URL}${path}`, {
        headers: student360ApiHeaders()
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || 'Unable to load data');
    }
    return data;
}

function student360ApiOrigin() {
    try {
        return new URL(CONFIG.API_URL).origin;
    } catch (error) {
        return window.location.origin;
    }
}

function student360PhotoUrl(photo) {
    if (!photo) return '../assets/images/logo.png';
    if (/^https?:\/\//i.test(photo)) return photo;
    return `${student360ApiOrigin()}${photo}`;
}

function currentStudent360SessionLabel() {
    return student360State.currentStudent?.session || CONFIG.CURRENT_SESSION || '-';
}

function student360ClassLabel(student = {}) {
    return `${student.class || '-'}${student.section ? ` - ${student.section}` : ''}`;
}

function student360FormatDobForMarksheet(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${String(date.getDate()).padStart(2, '0')}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

function buildStudent360MarksheetUrl(student = {}, marksDoc = null) {
    const params = new URLSearchParams();
    const values = {
        studentId: student._id,
        rollNo: student.rollNo || '0',
        className: student.class,
        section: student.section,
        academicYear: student.session || CONFIG.CURRENT_SESSION || 'Default',
        studentName: student.name,
        admissionNo: student.studentId,
        fatherName: student.fatherName,
        gender: student.gender,
        contactNo: student.contactNo,
        dob: student360FormatDobForMarksheet(student.dob),
        rank: marksDoc?.rank || ''
    };

    Object.entries(values).forEach(([key, value]) => {
        if (value) params.set(key, value);
    });

    return `skymarksheet.html?${params.toString()}`;
}

function student360BuildStudentUrl(admissionNo, session = '') {
    const query = new URLSearchParams();
    if (session) query.set('session', session);
    return `/student/${encodeURIComponent(admissionNo)}${query.toString() ? `?${query}` : ''}`;
}

async function student360LoadStudents(session = '') {
    const query = new URLSearchParams();
    if (session) query.set('session', session);
    const result = await student360FetchJson(`/student${query.toString() ? `?${query}` : ''}`);
    student360State.students = Array.isArray(result.students) ? result.students : [];
    renderStudent360Suggestions(student360State.students);
}

function renderStudent360Suggestions(students = []) {
    const options = students.slice(0, 500).map((student) => `
        <option value="${student360Escape(student.studentId || '')}">
            ${student360Escape(student.name || '')} | ${student360Escape(student360ClassLabel(student))} | Father: ${student360Escape(student.fatherName || '-')}
        </option>
    `).join('');
    document.getElementById('student360Suggestions').innerHTML = options;
}

function normalizeStudent360SessionName(session) {
    return String(session?.name || session || '').trim();
}

function renderStudent360SessionOptions(sessions = [], selectedSession = '') {
    const select = document.getElementById('student360SessionInput');
    const uniqueSessions = [...new Set(sessions.map(normalizeStudent360SessionName).filter(Boolean))]
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

    select.innerHTML = `
        <option value="">All / Latest</option>
        ${uniqueSessions.map((session) => `<option value="${student360Escape(session)}">${student360Escape(session)}</option>`).join('')}
    `;
    select.value = selectedSession;
}

async function loadStudent360Sessions(selectedSession = '') {
    let sessions = await API.sessions.getAll();
    if (!Array.isArray(sessions) || !sessions.length) {
        sessions = student360State.students.map((student) => student.session);
    }

    if (selectedSession && !sessions.map(normalizeStudent360SessionName).includes(selectedSession)) {
        sessions = [...sessions, selectedSession];
    }

    renderStudent360SessionOptions(sessions, selectedSession);
}

function findStudent360Candidate(searchText = '') {
    const query = String(searchText || '').trim().toLowerCase();
    if (!query) return null;

    return student360State.students.find((student) => {
        const fields = [
            student.studentId,
            student.name,
            student.fatherName,
            student.class,
            student.section,
            student.rollNo
        ].join(' ').toLowerCase();
        return fields.includes(query);
    });
}

function renderStudent360Profile(student = {}) {
    student360State.currentStudent = student;
    document.getElementById('student360PrintBooklet').disabled = false;
    document.getElementById('student360Content').classList.remove('d-none');
    document.getElementById('student360Empty').classList.add('d-none');

    document.getElementById('student360Photo').src = student360PhotoUrl(student.photo);
    student360SetText('student360Name', student.name);
    student360SetText('student360Subtitle', `${student360ClassLabel(student)} | Roll ${student.rollNo || '-'} | ${student.session || '-'}`);
    student360SetText('student360Admission', student.studentId);
    student360SetText('student360Father', student.fatherName);
    student360SetText('student360Mother', student.motherName);
    student360SetText('student360Contact', student.contactNo);
    student360SetText('student360Dob', student360Date(student.dob));
    student360SetText('student360AdmissionDate', student360Date(student.admissionDate));
    student360SetText('student360Address', student.address);
    student360SetText('student360SessionBadge', `Session: ${student.session || '-'}`);
    student360SetText('student360TuitionFee', `Rs. ${student360Money(student.tuitionFee || 0)}`);
    student360SetText('student360TransportFee', student.transport?.required
        ? `Rs. ${student360Money(student.transport?.fees || 0)}`
        : 'Not required');

    const transport = student.transport?.required
        ? `${student.transport.busNumber || '-'} | ${student.transport.route || '-'} | Rs. ${student360Money(student.transport.fees)}`
        : 'Not required';
    student360SetText('student360Transport', transport);

    const admissionNo = encodeURIComponent(student.studentId || '');
    const session = encodeURIComponent(student.session || '');
    document.getElementById('student360CollectFee').href = `fee-collection.html?admissionNo=${admissionNo}`;
    document.getElementById('student360CollectDue').href = `fee-collection.html?admissionNo=${admissionNo}&collectDue=1`;
    document.getElementById('student360Ledger').href = `student-fee-ledger.html?admissionNo=${admissionNo}&session=${session}`;
    document.getElementById('student360Database').href = `student-database.html?admissionNo=${admissionNo}&session=${session}`;
    document.getElementById('student360Marks').href = '#student360Marksheets';
}

function renderStudent360Fee(summary = {}, transactions = []) {
    student360SetText('student360Paid', student360Money(summary.totalPaid || 0));
    student360SetText('student360Due', student360Money(summary.totalOutstanding || 0));
    student360SetText('student360Charges', student360Money(summary.totalCharges || 0));
    student360SetText('student360LastReceipt', summary.lastReceiptDate ? student360Date(summary.lastReceiptDate) : '-');
}

function getStudent360LedgerBilled(transaction = {}) {
    return (transaction.lineItems || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

function splitStudent360LedgerPayment(transaction = {}) {
    const paymentBreakdown = Array.isArray(transaction.paymentBreakdown) ? transaction.paymentBreakdown : [];
    if (!paymentBreakdown.length) {
        const amount = Number(transaction.paidAmount) || 0;
        return String(transaction.paymentMode || '').toLowerCase() === 'online'
            ? { cash: 0, online: amount }
            : { cash: amount, online: 0 };
    }

    return paymentBreakdown.reduce((summary, entry) => {
        const amount = Number(entry.amount) || 0;
        const mode = String(entry.baseMode || entry.modeLabel || '').toLowerCase();
        if (mode === 'cash') {
            summary.cash += amount;
        } else {
            summary.online += amount;
        }
        return summary;
    }, { cash: 0, online: 0 });
}

function formatStudent360LedgerDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).replace(/ /g, '-');
}

function getStudent360TransactionSession(transaction = {}, fallbackSession = '') {
    return transaction.sessionName || transaction.session || fallbackSession || 'Unknown Session';
}

function renderStudent360ReceiptDetails(transactions = [], fallbackSession = '') {
    const body = document.getElementById('student360ReceiptsBody');
    const foot = document.getElementById('student360ReceiptsFoot');
    const sortedTransactions = (Array.isArray(transactions) ? transactions : [])
        .slice()
        .sort((a, b) => new Date(a.receiptDate || a.createdAt || 0) - new Date(b.receiptDate || b.createdAt || 0));

    const totals = sortedTransactions.reduce((summary, transaction) => {
        const billed = getStudent360LedgerBilled(transaction);
        const payment = splitStudent360LedgerPayment(transaction);
        const due = billed - payment.cash - payment.online;
        summary.billed += billed;
        summary.cash += payment.cash;
        summary.online += payment.online;
        summary.due += due;
        return summary;
    }, { billed: 0, cash: 0, online: 0, due: 0 });

    student360SetText('student360ReceiptCount', `${sortedTransactions.length} receipts`);

    if (!sortedTransactions.length) {
        body.innerHTML = '<tr><td colspan="11" class="text-center text-muted py-3">No fee receipts found.</td></tr>';
        foot.innerHTML = '';
        return;
    }

    body.innerHTML = sortedTransactions.map((transaction, index) => {
        const billed = getStudent360LedgerBilled(transaction);
        const payment = splitStudent360LedgerPayment(transaction);
        const due = billed - payment.cash - payment.online;
        const particulars = (transaction.lineItems || [])
            .map((item) => `${student360Escape(item.particular || '-')} (${student360Money(item.amount || 0)})`)
            .join('<br>');

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${formatStudent360LedgerDate(transaction.receiptDate || transaction.createdAt)}</td>
                <td>${student360Escape(getStudent360TransactionSession(transaction, fallbackSession))}</td>
                <td>${student360Escape(transaction.voucherNo || transaction.receiptNo || '-')}</td>
                <td>${particulars || '-'}</td>
                <td>${student360Escape(transaction.month || '-')}</td>
                <td class="text-end">${student360Money(billed)}</td>
                <td class="text-end">${payment.cash > 0 ? student360Money(payment.cash) : '-'}</td>
                <td class="text-end">${payment.online > 0 ? student360Money(payment.online) : '-'}</td>
                <td class="text-end">${due !== 0 ? student360Money(due) : '-'}</td>
                <td>${student360Escape(transaction.notes || '-')}</td>
            </tr>
        `;
    }).join('');

    foot.innerHTML = `
        <tr class="table-light fw-semibold">
            <td colspan="6">Grand Total</td>
            <td class="text-end">${student360Money(totals.billed)}</td>
            <td class="text-end">${student360Money(totals.cash)}</td>
            <td class="text-end">${student360Money(totals.online)}</td>
            <td class="text-end">${student360Money(totals.due)}</td>
            <td></td>
        </tr>
    `;
}

function normalizeStudent360Month(value) {
    const input = String(value || '').trim().toLowerCase();
    return STUDENT360_MONTHS.find((month) => month.toLowerCase() === input) || '';
}

function normalizeStudent360MonthFromDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('en-US', { month: 'long' });
}

function normalizeStudent360Particular(particular = '') {
    return String(particular || '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\u00A0/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

function getStudent360StatusBucket(particular = '') {
    const key = normalizeStudent360Particular(particular);
    if (key === 'tuition fee') return 'tuition';
    if (key === 'transport fee') return 'transport';
    if (key === 'late fee') return 'lateFee';
    return '';
}

function buildStudent360MonthlyStatusRows(transactions = []) {
    const rows = STUDENT360_MONTHS.map((month) => ({
        month,
        tuition: 0,
        transport: 0,
        lateFee: 0
    }));
    const byMonth = new Map(rows.map((row) => [row.month, row]));

    transactions.forEach((transaction) => {
        const month = normalizeStudent360Month(transaction.month)
            || normalizeStudent360MonthFromDate(transaction.receiptDate || transaction.createdAt);
        const row = byMonth.get(month);
        if (!row) return;

        (transaction.lineItems || []).forEach((item) => {
            const bucket = getStudent360StatusBucket(item.particular);
            const amount = Number(item.amount) || 0;
            if (bucket && amount) {
                row[bucket] += amount;
            }
        });
    });

    return rows;
}

function groupStudent360TransactionsBySession(transactions = [], fallbackSession = '') {
    const grouped = new Map();
    (Array.isArray(transactions) ? transactions : []).forEach((transaction) => {
        const session = getStudent360TransactionSession(transaction, fallbackSession);
        if (!grouped.has(session)) grouped.set(session, []);
        grouped.get(session).push(transaction);
    });

    if (!grouped.size && fallbackSession) {
        grouped.set(fallbackSession, []);
    }

    return Array.from(grouped.entries())
        .sort(([a], [b]) => String(b).localeCompare(String(a), undefined, { numeric: true }))
        .map(([session, rows]) => ({ session, rows }));
}

function renderStudent360MonthlyStatusTable(transactions = [], session = '') {
    const rows = buildStudent360MonthlyStatusRows(transactions);
    const statusTypes = [
        { key: 'tuition', label: 'Tuition Fee' },
        { key: 'transport', label: 'Transport Fee' },
        { key: 'lateFee', label: 'Late Fee' }
    ];

    const bodyRows = statusTypes.map((type) => {
        const total = rows.reduce((sum, row) => sum + Number(row[type.key] || 0), 0);
        return `
            <tr>
                <td class="fw-semibold">${type.label}</td>
                ${rows.map((row) => `<td>${row[type.key] ? student360Money(row[type.key]) : '-'}</td>`).join('')}
                <td class="fw-semibold">${total ? student360Money(total) : '-'}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="student360-monthly-status-group mb-3">
            <div class="fw-semibold mb-2">Session: ${student360Escape(session || 'Unknown Session')}</div>
            <div class="table-responsive">
                <table class="table table-bordered table-sm align-middle mb-0 student360-monthly-status-table">
                    <thead class="table-light">
                        <tr>
                            <th>Particular</th>
                            ${STUDENT360_MONTHS.map((month) => `<th>${student360Escape(month)}</th>`).join('')}
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>${bodyRows}</tbody>
                </table>
            </div>
        </div>
    `;
}

function renderStudent360MonthlyStatus(transactions = [], fallbackSession = '') {
    const wrap = document.getElementById('student360MonthlyStatusWrap');
    const groups = groupStudent360TransactionsBySession(transactions, fallbackSession);
    const label = groups.length === 1 ? '1 session' : `${groups.length} sessions`;
    student360SetText('student360MonthlyStatusSession', label);

    if (!wrap) return;
    if (!groups.length) {
        wrap.innerHTML = '<div class="text-center text-muted py-3 border rounded">No monthly fee status found.</div>';
        return;
    }

    wrap.innerHTML = groups
        .map((group) => renderStudent360MonthlyStatusTable(group.rows, group.session))
        .join('');
}

function calculateExamSummary(marks = [], examKey = 'final') {
    return marks.reduce((total, subject) => {
        const exam = subject[examKey] || {};
        total.obtained += (Number(exam.written) || 0) + (Number(exam.oral) || 0);
        total.maximum += (Number(exam.maxMarksWritten) || 0) + (Number(exam.maxMarksOral) || 0);
        return total;
    }, { obtained: 0, maximum: 0 });
}

function renderStudent360Marks(marksDoc = null) {
    marksDoc = normalizeStudent360MarksDoc(marksDoc);
    if (!marksDoc) {
        student360SetText('student360AcademicYear', '-');
        student360SetText('student360Rank', '-');
        student360SetText('student360Attendance', '-');
        student360SetText('student360Remarks', '-');
        document.getElementById('student360MarksSummary').textContent = 'No marks found for this student yet.';
        return;
    }

    const finalSummary = calculateExamSummary(marksDoc.marks || [], 'final');
    const percent = finalSummary.maximum > 0 ? ((finalSummary.obtained / finalSummary.maximum) * 100).toFixed(2) : '0.00';
    const attendance = marksDoc.attendance?.totalDays
        ? `${marksDoc.attendance.daysPresent || 0}/${marksDoc.attendance.totalDays} days`
        : '-';

    student360SetText('student360AcademicYear', marksDoc.academicYear);
    student360SetText('student360Rank', marksDoc.rank ? String(marksDoc.rank) : '-');
    student360SetText('student360Attendance', attendance);
    student360SetText('student360Remarks', marksDoc.teacherRemarks || '-');
    document.getElementById('student360MarksSummary').innerHTML = `
        <div class="progress mb-2" style="height: 10px;">
            <div class="progress-bar bg-info" style="width: ${Math.min(100, Number(percent))}%"></div>
        </div>
        <strong>Final:</strong> ${student360Money(finalSummary.obtained)} / ${student360Money(finalSummary.maximum)} (${percent}%)
    `;
}

function normalizeStudent360MarksDoc(marksDoc) {
    if (!marksDoc || Array.isArray(marksDoc)) return null;
    return marksDoc._id || Array.isArray(marksDoc.marks) ? marksDoc : null;
}

async function loadStudent360SessionRows(admissionNo) {
    const result = await student360FetchJson('/student');
    const rows = (Array.isArray(result.students) ? result.students : [])
        .filter((student) => String(student.studentId || '').toLowerCase() === String(admissionNo || '').toLowerCase())
        .sort((a, b) => String(b.session || '').localeCompare(String(a.session || ''), undefined, { numeric: true }));

    return rows.length ? rows : (student360State.currentStudent ? [student360State.currentStudent] : []);
}

async function renderStudent360MarksheetTable(admissionNo) {
    const body = document.getElementById('student360MarksheetsBody');
    body.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Loading marksheets...</td></tr>';

    const sessionRows = await loadStudent360SessionRows(admissionNo);
    document.getElementById('student360MarksheetCount').textContent = `${sessionRows.length} sessions`;

    if (!sessionRows.length) {
        body.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">No session records found.</td></tr>';
        return;
    }

    const rowsWithMarks = await Promise.all(sessionRows.map(async (student) => {
        try {
            const marksDoc = student._id ? await API.marks.getStudentMarks(student._id, student.session) : null;
            return { student, marksDoc: normalizeStudent360MarksDoc(marksDoc) };
        } catch (error) {
            return { student, marksDoc: null };
        }
    }));
    student360State.marksheetRows = rowsWithMarks;

    body.innerHTML = rowsWithMarks.map(({ student, marksDoc }) => {
        const marksheetUrl = buildStudent360MarksheetUrl(student, marksDoc);
        return `
            <tr>
                <td>${student360Escape(student.session || '-')}</td>
                <td>${student360Escape(student360ClassLabel(student))}</td>
                <td>${student360Escape(student.rollNo || '-')}</td>
                <td>${student360Escape(marksDoc?.rank || '-')}</td>
                <td>${marksDoc ? '<span class="badge text-bg-success">Marks found</span>' : '<span class="badge text-bg-warning">Not prepared</span>'}</td>
                <td>
                    <a class="btn btn-sm btn-primary" href="${marksheetUrl}">
                        <i class="fas fa-eye me-1"></i>View Marksheet
                    </a>
                </td>
            </tr>
        `;
    }).join('');
}

function getStudent360BookletTable(id) {
    const table = document.getElementById(id);
    return table ? table.outerHTML : '';
}

function getStudent360BookletHtml(id) {
    const element = document.getElementById(id);
    return element ? element.innerHTML : '';
}

function buildStudent360BookletHtml() {
    const student = student360State.currentStudent;
    if (!student) {
        alert('Search a student first.');
        return '';
    }

    const photo = student360PhotoUrl(student.photo);
    const feeSummary = student360State.feeSummary || {};
    const marksDoc = student360State.marksDoc;
    const attendance = marksDoc?.attendance?.totalDays
        ? `${marksDoc.attendance.daysPresent || 0}/${marksDoc.attendance.totalDays} days`
        : '-';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Student Booklet - ${student360Escape(student.name || student.studentId || '')}</title>
            <style>
                body { font-family: Arial, sans-serif; color: #111827; margin: 18px; }
                .booklet-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
                .booklet-header h1 { margin: 0; font-size: 24px; }
                .booklet-header p { margin: 4px 0 0; font-size: 12px; color: #475569; }
                .student-head { display: grid; grid-template-columns: 96px 1fr; gap: 14px; margin-bottom: 14px; }
                .student-photo { width: 96px; height: 96px; object-fit: cover; border: 1px solid #94a3b8; }
                .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
                .box { border: 1px solid #cbd5e1; padding: 8px; min-height: 42px; }
                .box span { display: block; font-size: 10px; color: #64748b; text-transform: uppercase; }
                .box strong { display: block; margin-top: 3px; font-size: 12px; }
                h2 { font-size: 16px; margin: 18px 0 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
                th, td { border: 1px solid #334155; padding: 5px 4px; font-size: 10px; vertical-align: top; color: #000; }
                th { background: #e2e8f0; font-weight: 700; }
                tfoot td { font-weight: 700; background: #f8fafc; }
                .text-end { text-align: right; }
                .badge, .btn { border: 0; background: transparent; padding: 0; color: #000; font-size: 10px; }
                .student360-monthly-status-group { margin-bottom: 16px; }
                .student360-monthly-status-group .fw-semibold { font-weight: 700; margin-bottom: 6px; }
                .page-break { page-break-before: always; }
                @page { size: A4 portrait; margin: 10mm; }
            </style>
        </head>
        <body>
            <div class="booklet-header">
                <div>
                    <h1>Student Booklet</h1>
                    <p>Skyview Public School | Session: ${student360Escape(currentStudent360SessionLabel())}</p>
                </div>
                <div>${new Date().toLocaleDateString('en-IN')}</div>
            </div>

            <div class="student-head">
                <img class="student-photo" src="${student360Escape(photo)}" alt="Student Photo">
                <div>
                    <h1 style="margin:0 0 6px;">${student360Escape(student.name || '-')}</h1>
                    <div>${student360Escape(student360ClassLabel(student))} | Roll ${student360Escape(student.rollNo || '-')} | Admission No. ${student360Escape(student.studentId || '-')}</div>
                    <div>Father: ${student360Escape(student.fatherName || '-')} | Contact: ${student360Escape(student.contactNo || '-')}</div>
                </div>
            </div>

            <div class="grid">
                <div class="box"><span>Mother</span><strong>${student360Escape(student.motherName || '-')}</strong></div>
                <div class="box"><span>DOB</span><strong>${student360Date(student.dob)}</strong></div>
                <div class="box"><span>Admission Date</span><strong>${student360Date(student.admissionDate)}</strong></div>
                <div class="box"><span>Tuition Fee</span><strong>Rs. ${student360Money(student.tuitionFee || 0)}</strong></div>
                <div class="box"><span>Transport Fee</span><strong>${student.transport?.required ? `Rs. ${student360Money(student.transport?.fees || 0)}` : 'Not required'}</strong></div>
                <div class="box"><span>Total Paid</span><strong>Rs. ${student360Money(feeSummary.totalPaid || 0)}</strong></div>
                <div class="box"><span>Outstanding Due</span><strong>Rs. ${student360Money(feeSummary.totalOutstanding || 0)}</strong></div>
                <div class="box"><span>Last Receipt</span><strong>${feeSummary.lastReceiptDate ? student360Date(feeSummary.lastReceiptDate) : '-'}</strong></div>
            </div>

            <h2>Fee Receipt Details</h2>
            ${getStudent360BookletTable('student360ReceiptsTable')}

            <h2>Monthly Fee Status</h2>
            ${getStudent360BookletHtml('student360MonthlyStatusWrap')}

            <h2>Academic Snapshot</h2>
            <div class="grid">
                <div class="box"><span>Academic Year</span><strong>${student360Escape(marksDoc?.academicYear || '-')}</strong></div>
                <div class="box"><span>Rank</span><strong>${student360Escape(marksDoc?.rank || '-')}</strong></div>
                <div class="box"><span>Attendance</span><strong>${student360Escape(attendance)}</strong></div>
                <div class="box"><span>Remarks</span><strong>${student360Escape(marksDoc?.teacherRemarks || '-')}</strong></div>
            </div>

            <h2>Session Wise Marksheets</h2>
            ${getStudent360BookletTable('student360MarksheetsTable')}
        </body>
        </html>
    `;
}

function printStudent360Booklet() {
    const html = buildStudent360BookletHtml();
    if (!html) return;

    const printWindow = window.open('', 'Student360Booklet', 'width=1000,height=900');
    if (!printWindow) {
        alert('Popup blocked. Please allow popups for printing.');
        return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
    }, 400);
}

async function loadStudent360(admissionNo, session = '') {
    const searchButton = document.getElementById('student360SearchBtn');
    const originalHtml = searchButton.innerHTML;
    searchButton.disabled = true;
    searchButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Loading...';

    try {
        const studentResult = await student360FetchJson(student360BuildStudentUrl(admissionNo, session));
        const student = studentResult.student;
        renderStudent360Profile(student);

        const feePromise = API.fees.getStudentFeeSummary(student.studentId);
        const ledgerPromise = API.fees.getTransactions({ admissionNo: student.studentId, limit: 500 });
        const marksPromise = student._id
            ? API.marks.getStudentMarks(student._id, student.session).then(normalizeStudent360MarksDoc).catch(() => null)
            : Promise.resolve(null);

        const [feeResult, ledgerResult, marksResult] = await Promise.all([feePromise, ledgerPromise, marksPromise]);
        const ledgerTransactions = ledgerResult?.transactions || feeResult?.transactions || [];
        student360State.feeSummary = feeResult?.summary || {};
        student360State.ledgerTransactions = ledgerTransactions;
        student360State.marksDoc = marksResult || null;
        renderStudent360Fee(feeResult?.summary || {}, ledgerTransactions);
        renderStudent360ReceiptDetails(ledgerTransactions, student.session);
        renderStudent360MonthlyStatus(ledgerTransactions, student.session);
        renderStudent360Marks(marksResult);
        await renderStudent360MarksheetTable(student.studentId);
    } finally {
        searchButton.disabled = false;
        searchButton.innerHTML = originalHtml;
    }
}

function resetStudent360() {
    student360State.currentStudent = null;
    document.getElementById('student360SearchForm').reset();
    document.getElementById('student360Content').classList.add('d-none');
    document.getElementById('student360Empty').classList.remove('d-none');
    document.getElementById('student360PrintBooklet').disabled = true;
    student360State.feeSummary = {};
    student360State.ledgerTransactions = [];
    student360State.marksDoc = null;
    student360State.marksheetRows = [];
    student360SetText('student360SessionBadge', 'Session: -');
    document.getElementById('student360MarksheetCount').textContent = '0 sessions';
    document.getElementById('student360MarksheetsBody').innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Search a student to view marksheets.</td></tr>';
    student360SetText('student360ReceiptCount', '0 receipts');
    document.getElementById('student360ReceiptsBody').innerHTML = '<tr><td colspan="11" class="text-center text-muted py-3">Search a student to view fee receipts.</td></tr>';
    document.getElementById('student360ReceiptsFoot').innerHTML = '';
    student360SetText('student360MonthlyStatusSession', '0 sessions');
    document.getElementById('student360MonthlyStatusWrap').innerHTML = '<div class="text-center text-muted py-3 border rounded">Search a student to view monthly status.</div>';
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        Auth.redirectToLogin();
        return;
    }

    const sessionInput = document.getElementById('student360SessionInput');
    const initialAdmissionNo = student360Params.get('admissionNo') || student360Params.get('studentId') || '';
    const initialSession = student360Params.get('session') || '';

    try {
        await loadStudent360Sessions(initialSession);
        await student360LoadStudents(initialSession);
        if (initialAdmissionNo) {
            document.getElementById('student360SearchInput').value = initialAdmissionNo;
            await loadStudent360(initialAdmissionNo, initialSession);
        }
    } catch (error) {
        console.error(error);
        alert(error.message || 'Unable to load Student 360');
    }

    document.getElementById('student360SearchForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const session = sessionInput.value.trim();
        const inputValue = document.getElementById('student360SearchInput').value.trim();
        const candidate = findStudent360Candidate(inputValue);
        const admissionNo = candidate?.studentId || inputValue;

        if (!admissionNo) {
            alert('Please search admission number or student name.');
            return;
        }

        try {
            await loadStudent360(admissionNo, session);
        } catch (error) {
            console.error(error);
            alert(error.message || 'Unable to open student profile');
        }
    });

    document.getElementById('student360ResetBtn').addEventListener('click', resetStudent360);
    document.getElementById('student360PrintBooklet').addEventListener('click', printStudent360Booklet);
    sessionInput.addEventListener('change', () => {
        student360LoadStudents(sessionInput.value.trim()).catch((error) => console.error(error));
    });
});
