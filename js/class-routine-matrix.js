(function () {
    if (!window.CONFIG) {
        return;
    }

    if (window.Auth && typeof window.Auth.isAuthenticated === 'function' && !window.Auth.isAuthenticated()) {
        window.Auth.redirectToLogin();
        return;
    }

    const API_BASE_URL = CONFIG.API_URL;
    const PERIOD_ORDER = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];
    const TIME_MAP = {
        '1st': '10.25 - 11.05',
        '2nd': '11.05 - 11.45',
        '3rd': '11.45 - 12.25',
        '4th': '12.50 - 01.30',
        '5th': '01.30 - 02.05',
        '6th': '02.05 - 02.40',
        '7th': '02.40 - 03.15'
    };

    const state = {
        academicSession: 'Default',
        currentTable: null,
        classList: [],
        teachers: [],
        subjects: [],
        currentDataMap: {},
        originalDataMap: {},
        changedCells: {}
    };

    const elements = {
        daySelect: document.getElementById('daySelect'),
        sessionSelect: document.getElementById('sessionSelect'),
        heading: document.getElementById('matrix-heading'),
        matrixContainer: document.getElementById('matrixContainer'),
        messageEl: document.getElementById('matrixMessage'),
        fetchMatrixBtn: document.getElementById('fetchMatrixBtn'),
        editTeacherCheck: document.getElementById('editTeacherCheck'),
        editSubjectCheck: document.getElementById('editSubjectCheck'),
        editBookCheck: document.getElementById('editBookCheck'),
        hideActionCheck: document.getElementById('hideActionCheck'),
        saveAllBtn: document.getElementById('saveAllBtn'),
        resetAllBtn: document.getElementById('resetAllBtn')
    };

    function getAuthHeaders(extraHeaders = {}) {
        const token = window.Auth && typeof window.Auth.getToken === 'function'
            ? window.Auth.getToken()
            : '';

        return token
            ? { ...extraHeaders, Authorization: `Bearer ${token}` }
            : extraHeaders;
    }

    async function fetchJson(url) {
        const response = await fetch(url, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
    }

    function setMessage(text, type = 'info') {
        elements.messageEl.textContent = text;
        elements.messageEl.className = `message ${type}`;
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function cloneData(value) {
        return JSON.parse(JSON.stringify(value || {}));
    }

    function buildRoutineClassKey(className, section) {
        const normalizedClassName = String(className || '').trim();
        const normalizedSection = String(section || '').trim();
        return normalizedSection
            ? `${normalizedClassName} - Section ${normalizedSection}`
            : normalizedClassName;
    }

    function getClassOrder(className) {
        const name = String(className || '').toLowerCase().trim();

        if (name.startsWith('nursery')) return 0;
        if (name.startsWith('lkg')) return 1;
        if (name.startsWith('ukg')) return 2;

        const numericPart = parseInt(name.replace(/\D/g, ''), 10);
        return Number.isNaN(numericPart) ? 999 : 3 + numericPart;
    }

    function makeCellKey(className, period) {
        return `${className}||${period}`;
    }

    function parseCellKey(key) {
        const [className, period] = key.split('||');
        return { className, period };
    }

    function getSelectedDay() {
        return elements.daySelect.value;
    }

    function setSessionOptions(sessions, currentSession) {
        elements.sessionSelect.innerHTML = '';

        sessions.forEach((sessionName) => {
            const option = document.createElement('option');
            option.value = sessionName;
            option.textContent = sessionName;
            elements.sessionSelect.appendChild(option);
        });

        elements.sessionSelect.value = currentSession || sessions[0] || 'Default';
        state.academicSession = elements.sessionSelect.value || 'Default';
    }

    async function loadSessions() {
        try {
            const [sessionsPayload, currentPayload] = await Promise.all([
                fetchJson(`${API_BASE_URL}/sessions`).catch(() => ({})),
                fetchJson(`${API_BASE_URL}/sessions/current`).catch(() => ({}))
            ]);

            const sessionRecords = Array.isArray(sessionsPayload.sessions) ? sessionsPayload.sessions : [];
            const sessionNames = sessionRecords
                .map((entry) => (typeof entry === 'string' ? entry : entry?.name))
                .filter(Boolean);

            const fallbackCurrent = sessionRecords.find((entry) => entry && typeof entry === 'object' && entry.isCurrent)?.name;
            const currentSession = currentPayload?.session?.name || fallbackCurrent || sessionNames[0] || 'Default';

            setSessionOptions(sessionNames.length ? sessionNames : ['Default'], currentSession);
        } catch (error) {
            console.error('Failed to load sessions:', error);
            setSessionOptions(['Default'], 'Default');
        }
    }

    async function loadClassesForSession() {
        try {
            const payload = await fetchJson(`${API_BASE_URL}/classes/year/${encodeURIComponent(state.academicSession)}`);
            const seen = new Set();

            state.classList = (Array.isArray(payload) ? payload : [])
                .map((entry) => {
                    const key = buildRoutineClassKey(entry.className, entry.section);
                    if (!key || seen.has(key)) {
                        return '';
                    }
                    seen.add(key);
                    return key;
                })
                .filter(Boolean)
                .sort((a, b) => getClassOrder(a) - getClassOrder(b) || a.localeCompare(b, undefined, { numeric: true }));
        } catch (error) {
            console.error('Failed to load classes:', error);
            state.classList = [];
        }
    }

    async function loadTeachers() {
        try {
            const payload = await fetchJson(`${API_BASE_URL}/teachers?session=${encodeURIComponent(state.academicSession)}`);
            state.teachers = (payload.teachers || []).map((teacher) => teacher.name).filter(Boolean);
        } catch (error) {
            console.error('Failed to load teachers:', error);
            state.teachers = [];
        }
    }

    async function loadSubjects() {
        try {
            const payload = await fetchJson(`${API_BASE_URL}/routine-subjects?session=${encodeURIComponent(state.academicSession)}`);
            state.subjects = (payload.subjects || []).map((subject) => subject.name).filter(Boolean);
        } catch (error) {
            console.error('Failed to load routine subjects:', error);
            state.subjects = [];
        }
    }

    function createBlankPeriod(period) {
        return {
            period,
            time: TIME_MAP[period] || '',
            teacher: '',
            subject: '',
            book: ''
        };
    }

    function buildInitialDataMap(routinesArray) {
        const dataMap = {};

        state.classList.forEach((className) => {
            dataMap[className] = {};
            PERIOD_ORDER.forEach((period) => {
                dataMap[className][period] = createBlankPeriod(period);
            });
        });

        routinesArray.forEach((routine) => {
            const className = routine.class || routine.className || 'Unknown';
            if (!dataMap[className]) {
                dataMap[className] = {};
                PERIOD_ORDER.forEach((period) => {
                    dataMap[className][period] = createBlankPeriod(period);
                });
                if (!state.classList.includes(className)) {
                    state.classList.push(className);
                }
            }

            (routine.periods || []).forEach((period) => {
                const periodLabel = String(period.period || '').trim();
                if (!periodLabel || periodLabel === 'Break') {
                    return;
                }

                dataMap[className][periodLabel] = {
                    period: periodLabel,
                    time: period.time || TIME_MAP[periodLabel] || '',
                    teacher: period.teacher || '',
                    subject: period.subject || '',
                    book: period.book || ''
                };
            });
        });

        state.classList.sort((a, b) => getClassOrder(a) - getClassOrder(b) || a.localeCompare(b, undefined, { numeric: true }));
        return dataMap;
    }

    async function loadMatrixData() {
        const selectedDay = getSelectedDay();

        try {
            const payload = await fetchJson(
                `${API_BASE_URL}/routines/get-routine?day=${encodeURIComponent(selectedDay)}&session=${encodeURIComponent(state.academicSession)}`
            );
            const routinesArray = payload.routines || payload || [];
            state.currentDataMap = buildInitialDataMap(Array.isArray(routinesArray) ? routinesArray : []);
            state.originalDataMap = cloneData(state.currentDataMap);
            state.changedCells = {};
        } catch (error) {
            console.error('Failed to load routine matrix:', error);
            state.currentDataMap = buildInitialDataMap([]);
            state.originalDataMap = cloneData(state.currentDataMap);
            state.changedCells = {};
        }
    }

    function getTeacherUsage() {
        const teacherCount = {};
        const teacherBookedPerPeriod = {};

        Object.values(state.currentDataMap).forEach((periodMap) => {
            PERIOD_ORDER.forEach((period) => {
                const entry = periodMap[period];
                const teacher = entry?.teacher || '';
                if (!teacher) {
                    return;
                }

                teacherCount[teacher] = (teacherCount[teacher] || 0) + 1;
                if (!teacherBookedPerPeriod[period]) {
                    teacherBookedPerPeriod[period] = new Set();
                }
                teacherBookedPerPeriod[period].add(teacher);
            });
        });

        return { teacherCount, teacherBookedPerPeriod };
    }

    function isTeacherAvailable(teacher, period, currentTeacher) {
        if (!teacher || teacher === currentTeacher) {
            return true;
        }

        const { teacherBookedPerPeriod } = getTeacherUsage();
        return !(teacherBookedPerPeriod[period] && teacherBookedPerPeriod[period].has(teacher));
    }

    function getTeacherDisplayName(teacher) {
        if (!teacher) {
            return '';
        }

        const { teacherCount } = getTeacherUsage();
        return `${teacher} (${teacherCount[teacher] || 0})`;
    }

    function stripTeacherCountLabel(value) {
        return String(value || '').replace(/\s*\(\d+\)\s*$/, '').trim();
    }

    function updateChangedState(className, period) {
        const key = makeCellKey(className, period);
        const current = state.currentDataMap[className][period];
        const original = (state.originalDataMap[className] && state.originalDataMap[className][period]) || createBlankPeriod(period);
        const changedFields = {};

        ['teacher', 'subject', 'book'].forEach((field) => {
            if ((current[field] || '') !== (original[field] || '')) {
                changedFields[field] = current[field] || '';
            }
        });

        if (Object.keys(changedFields).length > 0) {
            state.changedCells[key] = changedFields;
        } else {
            delete state.changedCells[key];
        }
    }

    function updateField(className, period, field, value) {
        if (!state.currentDataMap[className]) {
            state.currentDataMap[className] = {};
        }
        if (!state.currentDataMap[className][period]) {
            state.currentDataMap[className][period] = createBlankPeriod(period);
        }

        state.currentDataMap[className][period][field] = value;
        updateChangedState(className, period);
    }

    function getChangedKeysForClass(className) {
        return Object.keys(state.changedCells).filter((key) => parseCellKey(key).className === className);
    }

    function createTeacherSelect(className, period, entry) {
        const select = document.createElement('select');
        select.className = 'edit-field';
        select.setAttribute('aria-label', 'Select Teacher');

        const currentTeacher = entry.teacher || '';
        const options = ['<option value="">--Select--</option>'].concat(
            state.teachers.map((teacher) => {
                const disabled = isTeacherAvailable(teacher, period, currentTeacher) ? '' : ' disabled';
                const selected = teacher === currentTeacher ? ' selected' : '';
                const label = escapeHtml(getTeacherDisplayName(teacher) || teacher);
                return `<option value="${escapeHtml(teacher)}"${selected}${disabled}>${label}</option>`;
            })
        );

        select.innerHTML = options.join('');

        const stripSelectedLabel = () => {
            const selectedValue = select.value;
            if (!selectedValue) return;
            Array.from(select.options).forEach((option) => {
                if (option.value === selectedValue) {
                    option.textContent = selectedValue;
                }
            });
        };

        const refreshOptions = () => {
            const selectedValue = select.value || currentTeacher;
            const nextOptions = ['<option value="">--Select--</option>'].concat(
                state.teachers.map((teacher) => {
                    const disabled = isTeacherAvailable(teacher, period, selectedValue) ? '' : ' disabled';
                    const selected = teacher === selectedValue ? ' selected' : '';
                    const label = escapeHtml(getTeacherDisplayName(teacher) || teacher);
                    return `<option value="${escapeHtml(teacher)}"${selected}${disabled}>${label}</option>`;
                })
            );
            select.innerHTML = nextOptions.join('');
            if (selectedValue) {
                select.value = selectedValue;
            }
        };

        select.addEventListener('focus', refreshOptions);
        select.addEventListener('blur', stripSelectedLabel);
        select.addEventListener('change', () => {
            updateField(className, period, 'teacher', select.value);
            renderMatrix();
        });

        stripSelectedLabel();
        return select;
    }

    function createSubjectField(className, period, entry) {
        const select = document.createElement('select');
        select.className = 'edit-field';
        const options = ['<option value="">--Select--</option>'].concat(
            state.subjects.map((subject) => {
                const selected = subject === (entry.subject || '') ? ' selected' : '';
                return `<option value="${escapeHtml(subject)}"${selected}>${escapeHtml(subject)}</option>`;
            })
        );

        select.innerHTML = options.join('');
        select.addEventListener('change', () => {
            updateField(className, period, 'subject', select.value);
            renderMatrix();
        });
        return select;
    }

    function createBookField(className, period, entry) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'edit-field';
        input.value = entry.book || '';
        input.placeholder = 'Book name';
        input.addEventListener('change', () => {
            updateField(className, period, 'book', input.value.trim());
            renderMatrix();
        });
        return input;
    }

    function appendCellContent(cell, className, period, entry) {
        const wrapper = document.createElement('div');
        wrapper.className = 'cell-content';

        if (elements.editTeacherCheck.checked) {
            wrapper.appendChild(createTeacherSelect(className, period, entry));
        } else {
            const teacherDiv = document.createElement('div');
            teacherDiv.className = 'cell-teacher';
            teacherDiv.textContent = entry.teacher ? getTeacherDisplayName(entry.teacher) : 'Free';
            wrapper.appendChild(teacherDiv);
        }

        if (elements.editSubjectCheck.checked) {
            wrapper.appendChild(createSubjectField(className, period, entry));
        } else {
            const subjectDiv = document.createElement('div');
            subjectDiv.className = 'cell-subject';
            subjectDiv.textContent = entry.subject || '';
            wrapper.appendChild(subjectDiv);
        }

        if (elements.editBookCheck.checked) {
            wrapper.appendChild(createBookField(className, period, entry));
        } else {
            const bookDiv = document.createElement('div');
            bookDiv.className = 'cell-book';
            bookDiv.textContent = entry.book || '';
            wrapper.appendChild(bookDiv);
        }

        cell.appendChild(wrapper);
    }

    function buildClassPeriodsPayload(className) {
        return PERIOD_ORDER.map((period) => {
            const entry = (state.currentDataMap[className] && state.currentDataMap[className][period]) || createBlankPeriod(period);
            return {
                period,
                time: entry.time || TIME_MAP[period] || '',
                teacher: entry.teacher || '',
                subject: entry.subject || '',
                book: entry.book || ''
            };
        });
    }

    async function saveClass(className, button) {
        const changedKeys = getChangedKeysForClass(className);
        if (changedKeys.length === 0) {
            setMessage(`No changes to save for ${className}`, 'error');
            return;
        }

        const originalLabel = button ? button.textContent : '';
        if (button) {
            button.disabled = true;
            button.textContent = 'Saving...';
        }

        try {
            const payload = {
                class: className,
                day: getSelectedDay(),
                session: state.academicSession,
                periods: buildClassPeriodsPayload(className)
            };

            const response = await fetch(`${API_BASE_URL}/routines/save-routine`, {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Unable to save routine');
            }

            state.originalDataMap[className] = cloneData(state.currentDataMap[className]);
            changedKeys.forEach((key) => delete state.changedCells[key]);
            renderMatrix();
            setMessage(`${className} saved successfully`, 'success');
        } catch (error) {
            console.error(`Failed to save ${className}:`, error);
            setMessage(error.message || `Unable to save ${className}`, 'error');
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = originalLabel;
            }
        }
    }

    function resetClass(className) {
        const changedKeys = getChangedKeysForClass(className);
        if (changedKeys.length === 0) {
            setMessage(`No changes to reset for ${className}`, 'error');
            return;
        }

        state.currentDataMap[className] = cloneData(state.originalDataMap[className]);
        changedKeys.forEach((key) => delete state.changedCells[key]);
        renderMatrix();
        setMessage(`${className} reset successfully`, 'success');
    }

    async function saveAllChanges() {
        const changedClasses = state.classList.filter((className) => getChangedKeysForClass(className).length > 0);
        if (!changedClasses.length) {
            setMessage('No changes to save', 'error');
            return;
        }

        elements.saveAllBtn.disabled = true;
        const originalLabel = elements.saveAllBtn.textContent;
        elements.saveAllBtn.textContent = 'Saving...';

        try {
            for (const className of changedClasses) {
                await saveClass(className);
            }
            setMessage('All changes saved successfully', 'success');
        } finally {
            elements.saveAllBtn.disabled = false;
            elements.saveAllBtn.textContent = originalLabel;
        }
    }

    function resetAllChanges() {
        if (!Object.keys(state.changedCells).length) {
            setMessage('No changes to reset', 'error');
            return;
        }

        state.currentDataMap = cloneData(state.originalDataMap);
        state.changedCells = {};
        renderMatrix();
        setMessage('All unsaved changes reset', 'success');
    }

    function createHeaderRow() {
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');

        const classHeader = document.createElement('th');
        classHeader.textContent = 'Class';
        headRow.appendChild(classHeader);

        PERIOD_ORDER.forEach((period) => {
            const th = document.createElement('th');
            const time = TIME_MAP[period] || '';
            th.textContent = time ? `${period} (${time})` : period;
            headRow.appendChild(th);
        });

        if (!elements.hideActionCheck.checked) {
            const actionHeader = document.createElement('th');
            actionHeader.textContent = 'Action';
            actionHeader.className = 'action-column';
            headRow.appendChild(actionHeader);
        }

        thead.appendChild(headRow);
        return thead;
    }

    function appendFreeTeachersRow(tbody) {
        const row = document.createElement('tr');

        const labelCell = document.createElement('td');
        labelCell.className = 'period-cell';
        labelCell.textContent = 'Free Teachers';
        row.appendChild(labelCell);

        const { teacherBookedPerPeriod } = getTeacherUsage();

        PERIOD_ORDER.forEach((period) => {
            const cell = document.createElement('td');
            const bookedTeachers = teacherBookedPerPeriod[period] || new Set();
            const freeTeachers = state.teachers.filter((teacher) => !bookedTeachers.has(teacher));
            cell.textContent = freeTeachers.length ? freeTeachers.join(', ') : '-';
            row.appendChild(cell);
        });

        if (!elements.hideActionCheck.checked) {
            const actionCell = document.createElement('td');
            actionCell.className = 'action-column';
            actionCell.textContent = '-';
            row.appendChild(actionCell);
        }

        tbody.appendChild(row);
    }

    function buildPrintTableHtml() {
        const tableClone = state.currentTable.cloneNode(true);

        tableClone.querySelectorAll('.action-column').forEach((cell) => {
            cell.remove();
        });

        tableClone.querySelectorAll('.cell-teacher').forEach((element) => {
            element.textContent = stripTeacherCountLabel(element.textContent);
        });

        return tableClone.outerHTML;
    }

    function renderMatrix() {
        const table = document.createElement('table');
        const tbody = document.createElement('tbody');

        table.appendChild(createHeaderRow());

        state.classList.forEach((className) => {
            const row = document.createElement('tr');
            if (getChangedKeysForClass(className).length > 0) {
                row.classList.add('changed-row');
            }

            const classCell = document.createElement('td');
            classCell.className = 'period-cell';
            classCell.textContent = className;
            row.appendChild(classCell);

            PERIOD_ORDER.forEach((period) => {
                const cell = document.createElement('td');
                const entry = (state.currentDataMap[className] && state.currentDataMap[className][period]) || createBlankPeriod(period);
                if (state.changedCells[makeCellKey(className, period)]) {
                    cell.classList.add('changed-cell');
                }
                appendCellContent(cell, className, period, entry);
                row.appendChild(cell);
            });

            if (!elements.hideActionCheck.checked) {
                const actionCell = document.createElement('td');
                const actionWrapper = document.createElement('div');
                actionWrapper.className = 'row-actions';
                actionCell.className = 'action-column';

                const saveButton = document.createElement('button');
                saveButton.type = 'button';
                saveButton.textContent = `Save ${className}`;
                saveButton.addEventListener('click', () => saveClass(className, saveButton));

                const resetButton = document.createElement('button');
                resetButton.type = 'button';
                resetButton.textContent = `Reset ${className}`;
                resetButton.addEventListener('click', () => resetClass(className));

                actionWrapper.appendChild(saveButton);
                actionWrapper.appendChild(resetButton);
                actionCell.appendChild(actionWrapper);
                row.appendChild(actionCell);
            }

            tbody.appendChild(row);
        });

        appendFreeTeachersRow(tbody);

        table.appendChild(tbody);
        state.currentTable = table;
        elements.heading.textContent = `Class Routine Matrix - ${getSelectedDay()}`;
        elements.matrixContainer.innerHTML = '';
        elements.matrixContainer.appendChild(table);

        if (state.classList.length === 0) {
            setMessage('No classes found for the selected session', 'error');
        }
    }

    async function reloadMatrixView() {
        elements.heading.textContent = `Class Routine Matrix - ${getSelectedDay()}`;
        elements.matrixContainer.innerHTML = '';
        setMessage('Loading...', 'info');

        await Promise.all([
            loadClassesForSession(),
            loadTeachers(),
            loadSubjects()
        ]);
        await loadMatrixData();
        renderMatrix();
        setMessage('Loaded successfully', 'info');
    }

    function exportToExcel() {
        if (!state.currentTable) {
            alert('No data');
            return;
        }

        const workbook = XLSX.utils.table_to_book(state.currentTable, { sheet: 'Routine' });
        XLSX.writeFile(workbook, `Class_Routine_Matrix_${getSelectedDay()}_${state.academicSession}.xlsx`);
    }

    function exportToPDF() {
        if (!state.currentTable) {
            alert('No data');
            return;
        }

        const printWindow = window.open('', '', 'width=900,height=700');
        if (!printWindow) {
            return;
        }

        printWindow.document.write(`
            <html>
                <head>
                    <title>Routine PDF</title>
                    <style>
                        table { border-collapse: collapse; width: 100%; }
                        th, td { border: 1px solid #000; padding: 6px; text-align: center; vertical-align: top; }
                    </style>
                </head>
                <body>
                    <h2>${elements.heading.textContent}</h2>
                    ${buildPrintTableHtml()}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }

    function bindEvents() {
        elements.fetchMatrixBtn.addEventListener('click', reloadMatrixView);
        elements.sessionSelect.addEventListener('change', async () => {
            state.academicSession = elements.sessionSelect.value || 'Default';
            await reloadMatrixView();
        });
        elements.editTeacherCheck.addEventListener('change', renderMatrix);
        elements.editSubjectCheck.addEventListener('change', renderMatrix);
        elements.editBookCheck.addEventListener('change', renderMatrix);
        elements.hideActionCheck.addEventListener('change', renderMatrix);
        elements.saveAllBtn.addEventListener('click', saveAllChanges);
        elements.resetAllBtn.addEventListener('click', resetAllChanges);
    }

    async function initializePage() {
        bindEvents();
        await loadSessions();
        await reloadMatrixView();
    }

    window.exportToExcel = exportToExcel;
    window.exportToPDF = exportToPDF;
    window.addEventListener('DOMContentLoaded', initializePage);
})();
