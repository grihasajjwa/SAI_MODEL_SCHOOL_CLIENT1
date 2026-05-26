let editingRoutineId = null;
let routineClasses = [];
let routineRows = [];
let savedExamRoutines = [];
let academicSessions = [];
let sessionExamNames = [];
const ROUTINE_CLASS_ORDER_PREFIX = 'examRoutineClassOrder:';
const LAST_ROUTINE_ID_KEY = 'examRoutineLastRoutineId';

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}

function formatRoutineDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB').replace(/\//g, '-');
}

function showRoutineMessage(message) {
    const box = document.getElementById('routineMessage');
    box.textContent = message;
    box.classList.remove('d-none');
}

function hideRoutineMessage() {
    const box = document.getElementById('routineMessage');
    box.textContent = '';
    box.classList.add('d-none');
}

function getTodayInputDate() {
    return new Date().toISOString().split('T')[0];
}

function normalizeInputDate(value) {
    if (!value) return getTodayInputDate();
    return new Date(value).toISOString().split('T')[0];
}

function createRoutineRowId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `row-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getClassOrderStorageKey(academicYear = '') {
    return `${ROUTINE_CLASS_ORDER_PREFIX}${academicYear || 'all'}`;
}

function getPreferredSession(sessionList = []) {
    if (!Array.isArray(sessionList) || !sessionList.length) return '';
    const currentSession = sessionList.find((session) => session?.isCurrent);
    if (currentSession) return currentSession.name || currentSession;
    const activeSession = sessionList.find((session) => session?.active);
    if (activeSession) return activeSession.name || activeSession;
    const firstSession = sessionList[0];
    return firstSession?.name || firstSession || '';
}

function populateSessionSelect(selectId, selectedValue = '') {
    const select = document.getElementById(selectId);
    if (!select) return;

    const previousValue = selectedValue || select.value;
    select.innerHTML = '<option value="">Select Session</option>';
    academicSessions.forEach((session) => {
        const value = session.name || session;
        select.appendChild(new Option(value, value));
    });

    if (previousValue) {
        select.value = previousValue;
    }
}

async function loadAcademicSessions() {
    academicSessions = await API.sessions.getAll();
    const preferredSession = getPreferredSession(academicSessions);
    populateSessionSelect('routineAcademicYear', document.getElementById('routineAcademicYear')?.value || preferredSession);
    populateSessionSelect('examClassAcademicYear', document.getElementById('examClassAcademicYear')?.value || preferredSession);
    await loadExamNamesForRoutineSession();
    populateClasswiseFilters();
}

async function loadExamNamesForRoutineSession(selectedValue = '') {
    const session = document.getElementById('routineAcademicYear')?.value.trim();
    const select = document.getElementById('routineExamName');
    if (!select) return;

    const previousValue = selectedValue || select.value;
    sessionExamNames = [];
    select.innerHTML = '<option value="">Select Exam</option>';
    if (!session) return;

    const result = await API.examNames.getBySession(session);
    const exams = result?.config?.exams || [];
    sessionExamNames = exams.filter((exam) => exam.active !== false);
    select.innerHTML = '<option value="">Select Exam</option>' + sessionExamNames
        .map((exam) => `<option value="${escapeHtml(exam.name)}">${escapeHtml(exam.name)}</option>`)
        .join('');
    if (previousValue) select.value = previousValue;
    if (!select.value && sessionExamNames[0]) select.value = sessionExamNames[0].name;
    renderRoutinePreview();
}

function saveRoutineClassOrder() {
    const academicYear = document.getElementById('routineAcademicYear')?.value.trim() || '';
    localStorage.setItem(getClassOrderStorageKey(academicYear), JSON.stringify(routineClasses));
}

function applySavedRoutineClassOrder(classNames, academicYear = '') {
    let savedOrder = [];
    try {
        savedOrder = JSON.parse(localStorage.getItem(getClassOrderStorageKey(academicYear)) || '[]');
    } catch (error) {
        savedOrder = [];
    }

    if (!Array.isArray(savedOrder) || !savedOrder.length) return classNames;

    const classSet = new Set(classNames);
    const ordered = savedOrder.filter((className) => classSet.has(className));
    const newlyAdded = classNames.filter((className) => !ordered.includes(className));
    return [...ordered, ...newlyAdded];
}

function addRoutineClass(value = '') {
    const className = String(value || `CLASS-${routineClasses.length + 1}`).trim();
    if (!className || routineClasses.includes(className)) return;
    routineClasses.push(className);
    routineRows.forEach((row) => {
        row.subjects[className] = row.subjects[className] || '';
    });
    saveRoutineClassOrder();
    renderRoutineEditor();
}

function openExamClassModal() {
    hideRoutineMessage();
    document.getElementById('examClassForm').reset();
    populateSessionSelect('examClassAcademicYear', document.getElementById('routineAcademicYear').value.trim() || getPreferredSession(academicSessions));
    document.getElementById('examClassSection').value = 'A';
    const modal = new bootstrap.Modal(document.getElementById('examAddClassModal'));
    modal.show();
}

async function saveExamClassFromModal() {
    const academicYear = document.getElementById('examClassAcademicYear').value.trim();
    const className = document.getElementById('examClassName').value.trim();
    const section = document.getElementById('examClassSection').value.trim() || 'A';
    const classTeacher = document.getElementById('examClassTeacher').value.trim();
    const button = document.getElementById('saveExamClassBtn');
    const originalHtml = button.innerHTML;

    if (!academicYear || !className || !classTeacher) {
        showRoutineMessage('Please fill in Academic Year, Class Name and Class Teacher.');
        return;
    }

    try {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Saving';
        await API.class.createClass({ academicYear, className, section, classTeacher });
        document.getElementById('routineAcademicYear').value = academicYear;
        const modal = bootstrap.Modal.getInstance(document.getElementById('examAddClassModal'));
        if (modal) modal.hide();
        await loadClassesFromRecords();
    } catch (error) {
        console.error(error);
        showRoutineMessage(error.message || 'Unable to save class');
    } finally {
        button.disabled = false;
        button.innerHTML = originalHtml;
    }
}

function removeRoutineClass(index) {
    const removed = routineClasses[index];
    routineClasses.splice(index, 1);
    routineRows.forEach((row) => {
        delete row.subjects[removed];
    });
    saveRoutineClassOrder();
    renderRoutineEditor();
}

async function persistRoutineMetaSilently() {
    if (!editingRoutineId) return;

    try {
        await API.examRoutine.update(editingRoutineId, getRoutinePayload());
        await loadRoutineList();
    } catch (error) {
        console.warn('Unable to persist routine class order:', error);
    }
}

function moveRoutineClass(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= routineClasses.length) return;

    const [className] = routineClasses.splice(index, 1);
    routineClasses.splice(nextIndex, 0, className);
    saveRoutineClassOrder();
    renderRoutineEditor();
    persistRoutineMetaSilently();
}

function addRoutineRow(date = getTodayInputDate()) {
    const subjects = {};
    routineClasses.forEach((className) => {
        subjects[className] = '';
    });
    routineRows.push({ rowId: createRoutineRowId(), date, subjects });
    renderRoutineEditor();
}

function removeRoutineRow(index) {
    routineRows.splice(index, 1);
    renderRoutineEditor();
}

function renderRoutineClasses() {
    const container = document.getElementById('routineClassesContainer');
    if (!routineClasses.length) {
        container.innerHTML = '<div class="col-12 text-muted small">No classes loaded from Academic Records yet.</div>';
        return;
    }

    container.innerHTML = routineClasses.map((className, index) => `
        <div class="col-12">
            <div class="input-group input-group-sm">
                <span class="input-group-text" style="width: 42px;">${index + 1}</span>
                <input type="text" class="form-control routine-class-input" data-index="${index}" value="${escapeHtml(className)}">
                <button type="button" class="btn btn-outline-secondary move-routine-class-btn" data-index="${index}" data-direction="-1" ${index === 0 ? 'disabled' : ''} title="Move up">
                    <i class="fas fa-arrow-up"></i>
                </button>
                <button type="button" class="btn btn-outline-secondary move-routine-class-btn" data-index="${index}" data-direction="1" ${index === routineClasses.length - 1 ? 'disabled' : ''} title="Move down">
                    <i class="fas fa-arrow-down"></i>
                </button>
                <button type="button" class="btn btn-outline-danger remove-routine-class-btn" data-index="${index}" ${routineClasses.length <= 1 ? 'disabled' : ''} title="Delete class">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.routine-class-input').forEach((input) => {
        input.addEventListener('change', () => {
            const index = Number(input.dataset.index);
            const oldName = routineClasses[index];
            const newName = input.value.trim() || oldName;
            routineClasses[index] = newName;
            routineRows.forEach((row) => {
                row.subjects[newName] = row.subjects[oldName] || '';
                if (newName !== oldName) delete row.subjects[oldName];
            });
            renderRoutineEditor();
        });
    });

    container.querySelectorAll('.remove-routine-class-btn').forEach((button) => {
        button.addEventListener('click', () => removeRoutineClass(Number(button.dataset.index)));
    });

    container.querySelectorAll('.move-routine-class-btn').forEach((button) => {
        button.addEventListener('click', () => moveRoutineClass(
            Number(button.dataset.index),
            Number(button.dataset.direction)
        ));
    });
}

function renderRoutineEditor() {
    renderRoutineClasses();
    const head = document.getElementById('routineEditorHead');
    const body = document.getElementById('routineEditorBody');
    head.innerHTML = `
        <tr>
            <th>Date</th>
            ${routineClasses.map((className) => `<th>${escapeHtml(className)}</th>`).join('')}
            <th>Action</th>
        </tr>
    `;

    body.innerHTML = routineRows.map((row, rowIndex) => `
        <tr>
            <td>
                <input type="date" class="form-control form-control-sm routine-date-input" data-row="${rowIndex}" value="${normalizeInputDate(row.date)}">
            </td>
            ${routineClasses.map((className) => `
                <td>
                    <textarea class="form-control form-control-sm routine-subject-input" data-row="${rowIndex}" data-class="${escapeHtml(className)}" rows="2">${escapeHtml(row.subjects[className] || '')}</textarea>
                </td>
            `).join('')}
            <td class="text-nowrap">
                <button type="button" class="btn btn-sm btn-outline-success save-routine-row-btn me-1" data-row="${rowIndex}" title="Save this date row">
                    <i class="fas fa-save"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-danger remove-routine-row-btn" data-row="${rowIndex}" ${routineRows.length <= 1 ? 'disabled' : ''}>
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    body.querySelectorAll('.routine-date-input').forEach((input) => {
        input.addEventListener('change', () => {
            routineRows[Number(input.dataset.row)].date = input.value;
            renderRoutinePreview();
        });
    });

    body.querySelectorAll('.routine-subject-input').forEach((input) => {
        input.addEventListener('input', () => {
            routineRows[Number(input.dataset.row)].subjects[input.dataset.class] = input.value.trim();
            renderRoutinePreview();
        });
    });

    body.querySelectorAll('.remove-routine-row-btn').forEach((button) => {
        button.addEventListener('click', () => removeRoutineRow(Number(button.dataset.row)));
    });

    body.querySelectorAll('.save-routine-row-btn').forEach((button) => {
        button.addEventListener('click', () => saveRoutineRow(Number(button.dataset.row), button));
    });

    renderRoutinePreview();
}

function getRoutinePayload() {
    return {
        title: document.getElementById('routineTitle').value.trim(),
        examName: document.getElementById('routineExamName').value.trim(),
        academicYear: document.getElementById('routineAcademicYear').value.trim(),
        timeText: document.getElementById('routineTimeText').value.trim(),
        schoolOverText: document.getElementById('routineSchoolOverText').value.trim(),
        notes: document.getElementById('routineNotes').value.split('\n').map((line) => line.trim()).filter(Boolean),
        classes: routineClasses.map((className) => className.trim()).filter(Boolean),
        rows: routineRows.map((row) => ({
            rowId: row.rowId || createRoutineRowId(),
            date: row.date,
            subjects: row.subjects
        }))
    };
}

function getRoutineMetaPayload() {
    const payload = getRoutinePayload();
    return {
        title: payload.title,
        examName: payload.examName,
        academicYear: payload.academicYear,
        timeText: payload.timeText,
        schoolOverText: payload.schoolOverText,
        notes: payload.notes,
        classes: payload.classes
    };
}

async function saveRoutineRow(rowIndex, button) {
    hideRoutineMessage();
    const row = routineRows[rowIndex];
    if (!row) return;
    if (!row.rowId) row.rowId = createRoutineRowId();

    const originalHtml = button.innerHTML;

    try {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        if (!editingRoutineId) {
            const payload = getRoutinePayload();
            const result = await API.examRoutine.save(payload);
            if (!result?.success) {
                throw new Error(result?.message || 'Unable to create exam routine before saving row');
            }
            editingRoutineId = result.routine?._id;
            if (editingRoutineId) {
                localStorage.setItem(LAST_ROUTINE_ID_KEY, editingRoutineId);
            }
            document.getElementById('routineFormTitle').textContent = 'Edit Exam Routine';
        } else {
            const result = await API.examRoutine.saveRow(editingRoutineId, {
                ...getRoutineMetaPayload(),
                row: {
                    rowId: row.rowId,
                    date: row.date,
                    subjects: row.subjects
                }
            });
            if (!result?.success) {
                throw new Error(result?.message || 'Unable to save this date row');
            }
        }

        await loadRoutineList();
        button.classList.remove('btn-outline-success');
        button.classList.add('btn-success');
        setTimeout(() => {
            button.classList.add('btn-outline-success');
            button.classList.remove('btn-success');
        }, 900);
    } catch (error) {
        console.error(error);
        showRoutineMessage(error.message || 'Unable to save this date row');
    } finally {
        button.disabled = false;
        button.innerHTML = originalHtml;
    }
}

function renderRoutinePreview() {
    const payload = getRoutinePayload();
    const rows = payload.rows.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    const preview = document.getElementById('routinePreview');
    preview.innerHTML = `
        <div class="datesheet-title">${escapeHtml(payload.title || 'Skyview Public School')}</div>
        <div class="datesheet-subtitle">Datesheet for ${escapeHtml(payload.examName || 'EXAMINATION')} ( ${escapeHtml(payload.academicYear || 'Academic Year')} )</div>
        <table class="datesheet">
            <thead>
                <tr>
                    <th style="width: 110px;">DATE</th>
                    ${payload.classes.map((className) => `<th>${escapeHtml(className)}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${rows.map((row) => `
                    <tr>
                        <td>${escapeHtml(formatRoutineDate(row.date))}</td>
                        ${payload.classes.map((className) => {
                            const subject = row.subjects?.[className] || '';
                            const cellClass = subject ? '' : ' class="routine-empty-cell"';
                            return `<td${cellClass}>${escapeHtml(subject).replace(/\n/g, '<br>')}</td>`;
                        }).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div class="datesheet-note">N.B.</div>
        <div class="datesheet-note">${escapeHtml(payload.timeText || '')}</div>
        <div class="datesheet-note">${escapeHtml(payload.schoolOverText || '')}</div>
        ${(payload.notes || []).map((note) => `<div class="datesheet-note">${escapeHtml(note)}</div>`).join('')}
    `;
}

function getSelectedClasswiseRoutine() {
    const session = document.getElementById('classwiseSessionSelect').value;
    const selectedClass = document.getElementById('classwiseClassSelect').value;
    const examName = document.getElementById('classwiseExamSelect').value;
    return savedExamRoutines.find((routine) => (
        routine.academicYear === session
        && routine.examName === examName
        && (!selectedClass || (routine.classes || []).includes(selectedClass))
    ));
}

function populateClasswiseFilters() {
    const sessionSelect = document.getElementById('classwiseSessionSelect');
    const examSelect = document.getElementById('classwiseExamSelect');
    const classSelect = document.getElementById('classwiseClassSelect');
    const selectedSession = sessionSelect.value;
    const selectedClass = classSelect.value;
    const selectedExam = examSelect.value;
    const routineSessions = [...new Set(savedExamRoutines.map((routine) => routine.academicYear).filter(Boolean))];
    const sessionNames = academicSessions.map((session) => session.name || session).filter(Boolean);
    const sessions = [
        ...routineSessions,
        ...sessionNames.filter((session) => !routineSessions.includes(session))
    ];

    sessionSelect.innerHTML = '<option value="">Select Session</option>' + sessions
        .map((session) => `<option value="${escapeHtml(session)}">${escapeHtml(session)}</option>`)
        .join('');
    if (sessions.includes(selectedSession)) {
        sessionSelect.value = selectedSession;
    } else {
        const preferredSession = getPreferredSession(academicSessions);
        if (routineSessions.includes(preferredSession)) {
            sessionSelect.value = preferredSession;
        } else if (routineSessions.length) {
            sessionSelect.value = routineSessions[0];
        } else if (sessions.includes(preferredSession)) {
            sessionSelect.value = preferredSession;
        }
    }

    const sessionRoutines = savedExamRoutines.filter((routine) => (
        !sessionSelect.value || routine.academicYear === sessionSelect.value
    ));
    const classes = [...new Set(sessionRoutines.flatMap((routine) => routine.classes || []))];
    classSelect.innerHTML = '<option value="">Select Class</option>' + classes
        .map((className) => `<option value="${escapeHtml(className)}">${escapeHtml(className)}</option>`)
        .join('');
    if (classes.includes(selectedClass)) {
        classSelect.value = selectedClass;
    } else if (classes.length) {
        classSelect.value = classes[0];
    }

    const classRoutines = sessionRoutines.filter((routine) => (
        !classSelect.value || (routine.classes || []).includes(classSelect.value)
    ));
    const uniqueExams = [...new Set(classRoutines.map((routine) => routine.examName).filter(Boolean))];
    examSelect.innerHTML = '<option value="">Select Exam</option>' + uniqueExams
        .map((examName) => `<option value="${escapeHtml(examName)}">${escapeHtml(examName)}</option>`)
        .join('');
    if (uniqueExams.includes(selectedExam)) {
        examSelect.value = selectedExam;
    } else if (uniqueExams.length) {
        examSelect.value = uniqueExams[0];
    }

    renderClasswiseRoutinePreview();
}

function renderClasswiseRoutinePreview() {
    const preview = document.getElementById('classwiseRoutinePreview');
    const selectedRoutine = getSelectedClasswiseRoutine();
    const selectedClass = document.getElementById('classwiseClassSelect').value;

    if (!selectedRoutine || !selectedClass) {
        const message = savedExamRoutines.length
            ? 'Select session, class and exam name to view classwise routine.'
            : 'No saved exam routine found. Please save an Exam Routine first.';
        preview.innerHTML = `<div class="text-muted text-center py-3">${message}</div>`;
        return;
    }

    const rows = (selectedRoutine.rows || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    preview.innerHTML = `
        <div class="datesheet-title">${escapeHtml(selectedRoutine.title || 'Skyview Public School')}</div>
        <div class="datesheet-subtitle">${escapeHtml(selectedClass)} - ${escapeHtml(selectedRoutine.examName || 'EXAMINATION')} ( ${escapeHtml(selectedRoutine.academicYear || '')} )</div>
        <table class="datesheet">
            <thead>
                <tr>
                    <th style="width: 180px;">DATE</th>
                    <th>SUBJECT</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map((row) => {
                    const subject = row.subjects?.[selectedClass] || '';
                    return `
                        <tr>
                            <td>${escapeHtml(formatRoutineDate(row.date))}</td>
                            <td${subject ? '' : ' class="routine-empty-cell"'}>${escapeHtml(subject).replace(/\n/g, '<br>')}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        <div class="datesheet-note">N.B.</div>
        <div class="datesheet-note">${escapeHtml(selectedRoutine.timeText || '')}</div>
        <div class="datesheet-note">${escapeHtml(selectedRoutine.schoolOverText || '')}</div>
        ${(selectedRoutine.notes || []).map((note) => `<div class="datesheet-note">${escapeHtml(note)}</div>`).join('')}
    `;
}

async function switchRoutinePanel(panelId) {
    document.querySelectorAll('.routine-panel').forEach((panel) => {
        panel.classList.toggle('d-none', panel.id !== panelId);
    });
    document.querySelectorAll('.routine-tab-btn').forEach((button) => {
        button.classList.toggle('active', button.dataset.panel === panelId);
    });

    if (panelId === 'classwiseRoutinePane') {
        await loadRoutineList();
        populateClasswiseFilters();
    }
}

async function loadClassesFromRecords(options = {}) {
    const silent = Boolean(options.silent);
    if (!silent) hideRoutineMessage();
    const button = document.getElementById('loadRoutineClassesBtn');
    const originalHtml = button.innerHTML;
    const academicYear = document.getElementById('routineAcademicYear').value.trim();

    try {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Loading';
        const classes = academicYear
            ? await API.class.getClassesByAcademicYear(academicYear)
            : await API.class.getClassDetails();
        const labels = (Array.isArray(classes) ? classes : [])
            .map((item) => {
                const className = String(item.className || item.name || item.class || '').trim();
                const section = String(item.section || '').trim();
                if (!className) return '';
                if (!section || className.toLowerCase().includes(section.toLowerCase())) return className;
                return `${className}-${section}`;
            })
            .filter(Boolean);
        const uniqueLabels = [...new Set(labels)];

        if (!uniqueLabels.length) {
            if (!silent) {
                showRoutineMessage(academicYear
                    ? `No classes found in Academic Records for ${academicYear}.`
                    : 'No classes found in Academic Records.');
            }
            return;
        }

        routineClasses = applySavedRoutineClassOrder(uniqueLabels, academicYear);
        routineRows.forEach((row) => {
            const nextSubjects = {};
            routineClasses.forEach((className) => {
                nextSubjects[className] = row.subjects[className] || '';
            });
            row.subjects = nextSubjects;
        });
        saveRoutineClassOrder();
        renderRoutineEditor();
    } catch (error) {
        console.error(error);
        if (!silent) showRoutineMessage(error.message || 'Unable to load classes');
    } finally {
        button.disabled = false;
        button.innerHTML = originalHtml;
    }
}

function resetRoutineForm() {
    editingRoutineId = null;
    document.getElementById('routineFormTitle').textContent = 'Create Exam Routine';
    document.getElementById('routineTitle').value = 'Skyview Public School';
    document.getElementById('routineAcademicYear').value = '';
    document.getElementById('routineExamName').value = '';
    document.getElementById('routineTimeText').value = 'Time 10:30 am to 12:00 pm.';
    document.getElementById('routineSchoolOverText').value = 'School will get over at 1.00 pm for all the classes.';
    document.getElementById('routineNotes').value = 'No alternative or re-examination will be conducted under any circumstances if a student remains absent during the examination.';
    routineClasses = [];
    routineRows = [];
    addRoutineRow(getTodayInputDate());
    populateSessionSelect('routineAcademicYear', getPreferredSession(academicSessions));
    loadExamNamesForRoutineSession();
    renderRoutinePreview();
}

function loadRoutineIntoForm(routine) {
    editingRoutineId = routine._id;
    if (editingRoutineId) {
        localStorage.setItem(LAST_ROUTINE_ID_KEY, editingRoutineId);
    }
    document.getElementById('routineFormTitle').textContent = 'Edit Exam Routine';
    document.getElementById('routineTitle').value = routine.title || 'Skyview Public School';
    document.getElementById('routineAcademicYear').value = routine.academicYear || '';
    loadExamNamesForRoutineSession(routine.examName || '');
    document.getElementById('routineTimeText').value = routine.timeText || '';
    document.getElementById('routineSchoolOverText').value = routine.schoolOverText || '';
    document.getElementById('routineNotes').value = (routine.notes || []).join('\n');
    routineClasses = routine.classes?.length
        ? applySavedRoutineClassOrder([...routine.classes], routine.academicYear || '')
        : [];
    saveRoutineClassOrder();
    routineRows = (routine.rows || []).map((row) => ({
        rowId: row.rowId || createRoutineRowId(),
        date: normalizeInputDate(row.date),
        subjects: Object.fromEntries(Object.entries(row.subjects || {}))
    }));
    if (!routineRows.length) addRoutineRow(getTodayInputDate());
    renderRoutineEditor();
}

async function loadRoutineList() {
    const list = document.getElementById('routineList');
    const result = await API.examRoutine.getAll();
    if (!result?.success) {
        if (list) list.innerHTML = '<div class="text-muted">Unable to load routines.</div>';
        return;
    }

    if (!result.routines?.length) {
        savedExamRoutines = [];
        populateClasswiseFilters();
        if (list) list.innerHTML = '<div class="text-muted">No exam routines saved yet.</div>';
        return;
    }

    savedExamRoutines = result.routines;
    populateClasswiseFilters();
    if (!list) return;

    list.innerHTML = result.routines.map((routine) => `
        <button type="button" class="list-group-item list-group-item-action routine-list-item" data-id="${routine._id}">
            <div class="fw-semibold">${escapeHtml(routine.examName || '-')}</div>
            <div class="text-muted">${escapeHtml(routine.academicYear || '-')} | ${routine.classes?.length || 0} classes | ${routine.rows?.length || 0} dates</div>
        </button>
    `).join('');

    list.querySelectorAll('.routine-list-item').forEach((button) => {
        button.addEventListener('click', async () => {
            const detail = await API.examRoutine.getById(button.dataset.id);
            if (detail?.success) {
                loadRoutineIntoForm(detail.routine);
            }
        });
    });
}

async function loadLastRoutineIntoForm() {
    const lastRoutineId = localStorage.getItem(LAST_ROUTINE_ID_KEY);
    let routineToLoad = null;

    if (lastRoutineId) {
        routineToLoad = savedExamRoutines.find((routine) => routine._id === lastRoutineId);
    }

    if (!routineToLoad && savedExamRoutines.length) {
        routineToLoad = savedExamRoutines[0];
    }

    if (!routineToLoad?._id) return false;

    const detail = await API.examRoutine.getById(routineToLoad._id);
    if (detail?.success && detail.routine) {
        loadRoutineIntoForm(detail.routine);
        return true;
    }

    return false;
}

async function loadRoutineForSelectedMeta() {
    const academicYear = document.getElementById('routineAcademicYear').value.trim();
    const examName = document.getElementById('routineExamName').value.trim();
    if (!academicYear || !examName) return;

    await loadRoutineList();
    const matchingRoutine = savedExamRoutines.find((routine) => (
        routine.academicYear === academicYear && routine.examName === examName
    ));

    if (matchingRoutine?._id) {
        const detail = await API.examRoutine.getById(matchingRoutine._id);
        if (detail?.success && detail.routine) {
            loadRoutineIntoForm(detail.routine);
            return;
        }
    }

    editingRoutineId = null;
    localStorage.removeItem(LAST_ROUTINE_ID_KEY);
    routineRows = [];
    addRoutineRow(getTodayInputDate());
    document.getElementById('routineFormTitle').textContent = 'Create Exam Routine';
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '../pages/login.html';
        return;
    }

    resetRoutineForm();
    await loadAcademicSessions();
    await loadClassesFromRecords({ silent: true });
    await loadRoutineList();
    await loadLastRoutineIntoForm();

    ['routineTitle', 'routineAcademicYear', 'routineExamName', 'routineTimeText', 'routineSchoolOverText', 'routineNotes'].forEach((id) => {
        document.getElementById(id).addEventListener('input', renderRoutinePreview);
    });
    document.getElementById('routineAcademicYear').addEventListener('change', async () => {
        await loadExamNamesForRoutineSession();
        await loadClassesFromRecords();
        await loadRoutineForSelectedMeta();
    });
    document.getElementById('routineExamName').addEventListener('change', loadRoutineForSelectedMeta);

    document.getElementById('addRoutineClassBtn').addEventListener('click', openExamClassModal);
    document.getElementById('saveExamClassBtn').addEventListener('click', saveExamClassFromModal);
    document.getElementById('examClassForm').addEventListener('submit', (event) => {
        event.preventDefault();
        saveExamClassFromModal();
    });
    document.getElementById('loadRoutineClassesBtn').addEventListener('click', loadClassesFromRecords);
    document.getElementById('addRoutineDateBtn').addEventListener('click', () => addRoutineRow(getTodayInputDate()));
    document.getElementById('newRoutineBtn').addEventListener('click', async () => {
        resetRoutineForm();
        populateSessionSelect('routineAcademicYear', getPreferredSession(academicSessions));
        await loadClassesFromRecords({ silent: true });
    });
    document.getElementById('printRoutineBtn').addEventListener('click', () => window.print());
    document.getElementById('classwiseSessionSelect').addEventListener('change', populateClasswiseFilters);
    document.getElementById('classwiseClassSelect').addEventListener('change', populateClasswiseFilters);
    document.getElementById('classwiseExamSelect').addEventListener('change', renderClasswiseRoutinePreview);
    document.getElementById('printClasswiseRoutineBtn').addEventListener('click', async () => {
        await switchRoutinePanel('classwiseRoutinePane');
        window.print();
    });
    document.querySelectorAll('.routine-tab-btn').forEach((button) => {
        button.addEventListener('click', () => switchRoutinePanel(button.dataset.panel));
    });

    document.getElementById('examRoutineForm').addEventListener('submit', (event) => {
        event.preventDefault();
    });
});
