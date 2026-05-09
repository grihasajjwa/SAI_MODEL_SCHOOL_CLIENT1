let dataTable;
let sessions = [];
let currentAcademicYear = 'Default';
let currentSessionName = 'Default';

const classCache = new Map();
const marksCache = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000;
const EXAM_TYPES = ['pt1', 'hy', 'pt2', 'final'];
const PASS_MARKS = 33;
const TOP_PERFORMER_LIMIT = 10;
const TOPPER_CARDS_PER_SLIDE = 5;

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    await Navbar.loadNavbar();
    registerEventListeners();
    await initializeDashboard();
});

window.showStudents = showStudents;
window.generateRanks = generateRanks;

function registerEventListeners() {
    document.querySelector('.back-to-classes')?.addEventListener('click', () => {
        document.querySelector('.class-cards')?.style.setProperty('display', 'block');
        document.querySelector('.student-list')?.style.setProperty('display', 'none');
        document.querySelector('.back-to-classes')?.style.setProperty('display', 'none');
    });

    document.getElementById('sessionSelect')?.addEventListener('change', async (event) => {
        currentAcademicYear = event.target.value || currentSessionName || 'Default';
        updateSessionHeader();
        await loadClasses();
    });

    document.getElementById('reloadSessionBtn')?.addEventListener('click', async () => {
        classCache.clear();
        marksCache.clear();
        await initializeDashboard();
    });
}

async function initializeDashboard() {
    try {
        document.body.classList.add('loading');
        prepareHighlightLoadingState();
        await loadSessionsAndCurrent();
        populateSessionSelect();
        updateSessionHeader();
        await loadClasses();
    } catch (error) {
        console.error('Error initializing result dashboard:', error);
        renderEmptyState('Unable to prepare the result dashboard right now. Please try again.');
        renderTopPerformers([]);
        renderSpotlights(null);
        renderPerformanceTables(null);
    } finally {
        document.body.classList.remove('loading');
    }
}

async function loadSessionsAndCurrent() {
    const [sessionsResponse, currentResponse] = await Promise.all([
        fetch(`${CONFIG.API_URL}/sessions`, {
            headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
        }),
        fetch(`${CONFIG.API_URL}/sessions/current`, {
            headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
        })
    ]);

    if (!sessionsResponse.ok) {
        throw new Error('Failed to fetch academic sessions');
    }

    const sessionsPayload = await sessionsResponse.json();
    sessions = Array.isArray(sessionsPayload.sessions) && sessionsPayload.sessions.length
        ? sessionsPayload.sessions
        : [{ name: 'Default', active: true, isCurrent: true }];

    if (currentResponse.ok) {
        const currentPayload = await currentResponse.json();
        if (currentPayload?.session?.name) {
            currentSessionName = currentPayload.session.name;
        }
    } else {
        currentSessionName = sessions.find((session) => session.isCurrent)?.name || sessions[0]?.name || 'Default';
    }

    currentAcademicYear = currentAcademicYear && sessions.some((session) => session.name === currentAcademicYear)
        ? currentAcademicYear
        : currentSessionName;
}

function populateSessionSelect() {
    const select = document.getElementById('sessionSelect');
    if (!select) return;

    select.innerHTML = '';
    sessions.forEach((session) => {
        const option = document.createElement('option');
        option.value = session.name;
        option.textContent = session.name;
        select.appendChild(option);
    });

    select.value = currentAcademicYear;
}

function updateSessionHeader() {
    const selectedSession = sessions.find((session) => session.name === currentAcademicYear) || {};
    const statusFragments = [];

    if (selectedSession.isCurrent) statusFragments.push('Current Session');
    if (selectedSession.active) statusFragments.push('Active');
    if (selectedSession.startDate) statusFragments.push(`Starts ${formatDate(selectedSession.startDate)}`);
    if (selectedSession.endDate) statusFragments.push(`Ends ${formatDate(selectedSession.endDate)}`);

    const statusText = statusFragments.length
        ? statusFragments.join(' | ')
        : 'Session loaded and ready for result analysis.';

    setTextContent('heroCurrentSession', currentAcademicYear);
    setTextContent('heroDefaultSession', currentSessionName);
    setTextContent('sessionStatusText', statusText);
    setTextContent('sessionOverviewText', `A consolidated performance view for ${currentAcademicYear} with toppers, class trends, section strength, and result coverage.`);
}

async function loadClasses() {
    try {
        document.body.classList.add('loading');
        prepareHighlightLoadingState();

        const cacheKey = `class-summary-${currentAcademicYear}`;
        const cached = classCache.get(cacheKey);

        let groupedClasses;
        if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
            groupedClasses = cached.data;
        } else {
            const response = await fetch(`${CONFIG.API_URL}/classes/year/${encodeURIComponent(currentAcademicYear)}`, {
                headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch classes for the selected session');
            }

            const classes = await response.json();
            groupedClasses = groupClassesByName(classes);

            classCache.set(cacheKey, {
                data: groupedClasses,
                timestamp: Date.now()
            });
        }

        renderClassCards(groupedClasses);
        updateBaseStats(groupedClasses);
        await loadDashboardHighlights(groupedClasses);
    } catch (error) {
        console.error('Error loading classes:', error);
        renderEmptyState('No classes are available for this academic session yet.');
        updateBaseStats([]);
        renderTopPerformers([]);
        renderSpotlights(null);
        renderPerformanceTables(null);
    } finally {
        document.body.classList.remove('loading');
    }
}

function groupClassesByName(classes) {
    const grouped = new Map();

    (Array.isArray(classes) ? classes : []).forEach((entry) => {
        const className = entry.className || 'Unassigned';
        if (!grouped.has(className)) {
            grouped.set(className, {
                className,
                academicYear: entry.academicYear || currentAcademicYear,
                classTeacher: entry.classTeacher || 'Not Assigned',
                totalStudents: 0,
                totalSections: 0,
                subjectsCount: 0,
                sections: []
            });
        }

        const group = grouped.get(className);
        const count = Number(entry.studentCount) || 0;
        group.totalStudents += count;
        group.totalSections += 1;
        group.subjectsCount = Math.max(group.subjectsCount, Array.isArray(entry.subjects) ? entry.subjects.length : 0);
        group.sections.push({
            id: entry._id,
            section: entry.section || 'A',
            count,
            teacher: entry.classTeacher || 'Not Assigned'
        });
    });

    return Array.from(grouped.values()).sort((a, b) => compareClassNames(a.className, b.className));
}

function renderClassCards(groupedClasses) {
    const container = document.getElementById('classCardsContainer');
    if (!container) return;

    if (!groupedClasses.length) {
        renderEmptyState('No classes found for this academic session. Create class records or switch to another session.');
        return;
    }

    container.innerHTML = groupedClasses.map((group) => `
        <div class="col-12 col-xl-6">
            <article class="class-card card border-0 h-100">
                <div class="class-card-body">
                    <div class="class-card-top">
                        <div>
                            <p class="class-card-kicker mb-2">Result Workspace</p>
                            <h3 class="class-card-title mb-1">Class ${escapeHtml(group.className)}</h3>
                            <p class="class-card-subtitle mb-0">Teacher: ${escapeHtml(group.classTeacher || 'Not Assigned')}</p>
                        </div>
                        <div class="class-card-pill">
                            <span>${group.totalStudents}</span>
                            <small>Students</small>
                        </div>
                    </div>
                    <div class="class-card-metrics">
                        <div class="metric-chip">
                            <strong>${group.totalSections}</strong>
                            <span>Sections</span>
                        </div>
                        <div class="metric-chip">
                            <strong>${group.subjectsCount}</strong>
                            <span>Subjects</span>
                        </div>
                        <div class="metric-chip">
                            <strong>${escapeHtml(group.academicYear)}</strong>
                            <span>Session</span>
                        </div>
                    </div>
                    <div class="section-list">
                        ${group.sections
                            .sort((a, b) => String(a.section).localeCompare(String(b.section), undefined, { sensitivity: 'base' }))
                            .map((section) => `
                                <a
                                    class="section-link"
                                    href="class-marksheet.html?class=${encodeURIComponent(group.className)}&section=${encodeURIComponent(section.section)}&session=${encodeURIComponent(currentAcademicYear)}">
                                    <span class="section-link-name">Section ${escapeHtml(section.section)}</span>
                                    <span class="section-link-meta">${section.count} students</span>
                                </a>
                            `).join('')}
                    </div>
                </div>
            </article>
        </div>
    `).join('');
}

function renderEmptyState(message) {
    const container = document.getElementById('classCardsContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="col-12">
            <div class="empty-state">
                <i class="fas fa-folder-open fa-2x mb-3 text-secondary"></i>
                <p class="mb-0">${escapeHtml(message)}</p>
            </div>
        </div>
    `;
}

function updateBaseStats(groupedClasses) {
    const classCount = groupedClasses.length;
    const sectionCount = groupedClasses.reduce((sum, group) => sum + group.totalSections, 0);
    const studentCount = groupedClasses.reduce((sum, group) => sum + group.totalStudents, 0);

    setTextContent('statsClassCount', classCount);
    setTextContent('statsSectionCount', sectionCount);
    setTextContent('statsStudentCount', studentCount);
}

async function loadDashboardHighlights(groupedClasses) {
    const cacheKey = `dashboard-highlights-${currentAcademicYear}`;
    const cached = classCache.get(cacheKey);

    let highlights;
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
        highlights = cached.data;
    } else {
        highlights = await computeDashboardHighlights(groupedClasses);
        classCache.set(cacheKey, {
            data: highlights,
            timestamp: Date.now()
        });
    }

    updateInsightStats(highlights);
    renderTopPerformers(highlights.topPerformers);
    renderSpotlights(highlights);
    renderPerformanceTables(highlights);
}

async function computeDashboardHighlights(groupedClasses) {
    const allStudents = [];
    const classRows = [];
    const sectionRows = [];

    for (const group of groupedClasses) {
        const classPublishedStudents = [];
        let classEnrolled = 0;

        for (const section of group.sections) {
            const students = await fetchStudentsForSection(group.className, section.section);
            classEnrolled += students.length;

            const sectionStudents = await Promise.all(students.map(async (student) => {
                const marksRecord = await fetchMarksForStudent(student._id);
                const metrics = buildStudentMetrics(marksRecord?.marks || []);

                return {
                    id: student._id,
                    studentId: student.studentId || student.admissionNo || '',
                    name: student.name || 'Unnamed Student',
                    fatherName: student.fatherName || '',
                    className: group.className,
                    section: section.section,
                    teacher: section.teacher || group.classTeacher || 'Not Assigned',
                    rank: marksRecord?.rank ?? null,
                    marks: marksRecord?.marks || [],
                    examPercentages: metrics.examPercentages,
                    overallPercentage: metrics.overallPercentage,
                    overallGrade: calculateGrade(metrics.overallPercentage)
                };
            }));

            const publishedStudents = sectionStudents.filter((student) => student.overallPercentage > 0);
            const passCount = publishedStudents.filter((student) => student.overallPercentage >= PASS_MARKS).length;
            const averagePercentage = averageOf(publishedStudents.map((student) => student.overallPercentage));
            const topper = sortStudentsByPerformance(publishedStudents)[0] || null;

            allStudents.push(...publishedStudents);
            classPublishedStudents.push(...publishedStudents);

            sectionRows.push({
                className: group.className,
                section: section.section,
                teacher: section.teacher || group.classTeacher || 'Not Assigned',
                enrolledCount: students.length,
                publishedCount: publishedStudents.length,
                passCount,
                averagePercentage,
                topperName: topper?.name || '-',
                topperPercentage: topper?.overallPercentage || 0
            });
        }

        const classPassCount = classPublishedStudents.filter((student) => student.overallPercentage >= PASS_MARKS).length;
        classRows.push({
            className: group.className,
            teacher: group.classTeacher || 'Not Assigned',
            sectionCount: group.totalSections,
            enrolledCount: classEnrolled || group.totalStudents,
            publishedCount: classPublishedStudents.length,
            passCount: classPassCount,
            averagePercentage: averageOf(classPublishedStudents.map((student) => student.overallPercentage)),
            topperName: sortStudentsByPerformance(classPublishedStudents)[0]?.name || '-',
            topperPercentage: sortStudentsByPerformance(classPublishedStudents)[0]?.overallPercentage || 0
        });
    }

    const rankedStudents = assignDisplayRanks(sortStudentsByPerformance(allStudents));
    const topPerformers = rankedStudents.slice(0, TOP_PERFORMER_LIMIT);
    const publishedCount = rankedStudents.length;
    const totalStudents = groupedClasses.reduce((sum, group) => sum + group.totalStudents, 0);
    const passCount = rankedStudents.filter((student) => student.overallPercentage >= PASS_MARKS).length;
    const averagePercentage = averageOf(rankedStudents.map((student) => student.overallPercentage));
    const passRate = publishedCount ? (passCount / publishedCount) * 100 : 0;
    const completionRate = totalStudents ? (publishedCount / totalStudents) * 100 : 0;
    const examInsights = computeExamInsights(rankedStudents);

    classRows.sort((left, right) => {
        if (Math.abs(right.averagePercentage - left.averagePercentage) > 0.0001) {
            return right.averagePercentage - left.averagePercentage;
        }
        return String(left.className).localeCompare(String(right.className), undefined, { numeric: true, sensitivity: 'base' });
    });

    sectionRows.sort((left, right) => {
        if (Math.abs(right.averagePercentage - left.averagePercentage) > 0.0001) {
            return right.averagePercentage - left.averagePercentage;
        }
        const classCompare = compareClassNames(left.className, right.className);
        if (classCompare !== 0) {
            return classCompare;
        }
        return String(left.section).localeCompare(String(right.section), undefined, { sensitivity: 'base' });
    });

    return {
        totalStudents,
        publishedCount,
        passCount,
        averagePercentage,
        passRate,
        completionRate,
        topPerformers,
        classRows,
        sectionRows,
        strongestClass: classRows[0] || null,
        strongestSection: sectionRows[0] || null,
        examInsights
    };
}

function prepareHighlightLoadingState() {
    setTextContent('statsPublishedCount', '...');
    setTextContent('statsPassRate', '...');
    setTextContent('statsAveragePercentage', '...');
    setTextContent('topperSummaryText', 'Preparing session toppers and performance signals...');
    setHtmlContent('topPerformersCarouselInner', `
        <div class="carousel-item active">
            <div class="empty-state compact">
                <i class="fas fa-spinner fa-spin fa-2x mb-3 text-primary"></i>
                <p class="mb-0">Building topper cards and result highlights...</p>
            </div>
        </div>
    `);
    setHtmlContent('topPerformersIndicators', '');
    setHtmlContent('spotlightContainer', `
        <div class="col-12">
            <div class="empty-state compact">
                <i class="fas fa-chart-pie fa-2x mb-3 text-secondary"></i>
                <p class="mb-0">Loading result intelligence for this session...</p>
            </div>
        </div>
    `);
    setHtmlContent('classPerformanceTableBody', '');
    setHtmlContent('sectionPerformanceTableBody', '');
    setHtmlContent('examPerformanceTableBody', '');
}

function updateInsightStats(highlights) {
    setTextContent('statsPublishedCount', highlights.publishedCount);
    setTextContent('statsPassRate', `${highlights.passRate.toFixed(1)}%`);
    setTextContent('statsAveragePercentage', `${highlights.averagePercentage.toFixed(2)}%`);
    setTextContent(
        'resultPulseText',
        highlights.strongestClass
            ? `Best class right now: Class ${highlights.strongestClass.className} with ${highlights.strongestClass.averagePercentage.toFixed(2)}% average.`
            : 'No published results found yet for this session.'
    );
}

function renderTopPerformers(topPerformers) {
    const container = document.getElementById('topPerformersCarouselInner');
    const indicators = document.getElementById('topPerformersIndicators');
    if (!container || !indicators) return;

    if (!topPerformers.length) {
        setTextContent('topperSummaryText', 'No completed student results are available yet for topper cards.');
        container.innerHTML = `
            <div class="carousel-item active">
                <div class="empty-state compact">
                    <i class="fas fa-trophy fa-2x mb-3 text-warning"></i>
                    <p class="mb-0">Generate or publish marks to unlock the Top 10 rank holder carousel.</p>
                </div>
            </div>
        `;
        indicators.innerHTML = '';
        return;
    }

    setTextContent(
        'topperSummaryText',
        `Top ${Math.min(topPerformers.length, TOP_PERFORMER_LIMIT)} performers across ${currentAcademicYear}, ranked by overall percentage.`
    );

    const slides = chunkArray(topPerformers, TOPPER_CARDS_PER_SLIDE);
    container.innerHTML = slides.map((slide, slideIndex) => `
        <div class="carousel-item ${slideIndex === 0 ? 'active' : ''}">
            <div class="row g-3">
                ${slide.map((student, cardIndex) => `
                    <div class="col-12 col-md-6 col-xl-${slide.length < 5 ? '4' : '3'}">
                        <article class="topper-card topper-rank-${Math.min(student.displayRank, 4)}">
                            <div class="topper-rank-badge">${formatRank(student.displayRank)}</div>
                            <div class="topper-medal">${getMedalIcon(student.displayRank)}</div>
                            <h4 class="topper-name">${escapeHtml(student.name)}</h4>
                            <p class="topper-meta mb-2">${escapeHtml(student.className)} • Section ${escapeHtml(student.section)}</p>
                            <div class="topper-score">${student.overallPercentage.toFixed(2)}%</div>
                            <div class="topper-grade">${escapeHtml(student.overallGrade)}</div>
                            <div class="topper-details">
                                <span>${escapeHtml(student.studentId || 'N/A')}</span>
                                <span>${escapeHtml(student.teacher || 'Not Assigned')}</span>
                            </div>
                        </article>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');

    indicators.innerHTML = slides.map((_, index) => `
        <button type="button" data-bs-target="#topPerformersCarousel" data-bs-slide-to="${index}" class="${index === 0 ? 'active' : ''}" aria-label="Slide ${index + 1}"></button>
    `).join('');
}

function renderSpotlights(highlights) {
    const container = document.getElementById('spotlightContainer');
    if (!container) return;

    if (!highlights || !highlights.publishedCount) {
        container.innerHTML = `
            <div class="col-12">
                <div class="empty-state compact">
                    <i class="fas fa-lightbulb fa-2x mb-3 text-secondary"></i>
                    <p class="mb-0">Result spotlight cards will appear after marks are available.</p>
                </div>
            </div>
        `;
        return;
    }

    const strongestExam = highlights.examInsights.strongestExam;
    const weakestExam = highlights.examInsights.weakestExam;

    container.innerHTML = `
        <div class="col-12 col-md-6 col-xl-3">
            <article class="insight-card">
                <p class="insight-label">Strongest Class</p>
                <h4>Class ${escapeHtml(highlights.strongestClass?.className || '-')}</h4>
                <p class="insight-value">${highlights.strongestClass ? `${highlights.strongestClass.averagePercentage.toFixed(2)}% average` : 'No data'}</p>
                <p class="insight-note">${escapeHtml(highlights.strongestClass?.teacher || 'Teacher not assigned')}</p>
            </article>
        </div>
        <div class="col-12 col-md-6 col-xl-3">
            <article class="insight-card">
                <p class="insight-label">Best Section</p>
                <h4>${highlights.strongestSection ? `Class ${escapeHtml(highlights.strongestSection.className)}-${escapeHtml(highlights.strongestSection.section)}` : 'No data'}</h4>
                <p class="insight-value">${highlights.strongestSection ? `${highlights.strongestSection.averagePercentage.toFixed(2)}% average` : 'No data'}</p>
                <p class="insight-note">${escapeHtml(highlights.strongestSection?.topperName || 'Topper not available')}</p>
            </article>
        </div>
        <div class="col-12 col-md-6 col-xl-3">
            <article class="insight-card">
                <p class="insight-label">Result Coverage</p>
                <h4>${highlights.completionRate.toFixed(1)}%</h4>
                <p class="insight-value">${highlights.publishedCount} of ${highlights.totalStudents} students published</p>
                <p class="insight-note">Pass count: ${highlights.passCount}</p>
            </article>
        </div>
        <div class="col-12 col-md-6 col-xl-3">
            <article class="insight-card">
                <p class="insight-label">Exam Pulse</p>
                <h4>${strongestExam ? examLabel(strongestExam.examType) : 'No data'}</h4>
                <p class="insight-value">${strongestExam ? `${strongestExam.average.toFixed(2)}% average` : 'No data'}</p>
                <p class="insight-note">${weakestExam ? `Watch ${examLabel(weakestExam.examType)} at ${weakestExam.average.toFixed(2)}%` : 'All exams awaiting data'}</p>
            </article>
        </div>
    `;
}

function renderPerformanceTables(highlights) {
    const classBody = document.getElementById('classPerformanceTableBody');
    const sectionBody = document.getElementById('sectionPerformanceTableBody');
    const examBody = document.getElementById('examPerformanceTableBody');
    if (!classBody || !sectionBody || !examBody) return;

    if (!highlights || !highlights.publishedCount) {
        const emptyRow = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">No published result data available yet.</td>
            </tr>
        `;
        classBody.innerHTML = emptyRow;
        sectionBody.innerHTML = emptyRow;
        examBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-muted py-4">Exam comparison will appear after marks are loaded.</td>
            </tr>
        `;
        return;
    }

    classBody.innerHTML = highlights.classRows.slice(0, 8).map((row, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>Class ${escapeHtml(row.className)}</td>
            <td>${escapeHtml(row.teacher)}</td>
            <td>${row.publishedCount}/${row.enrolledCount}</td>
            <td>${row.averagePercentage.toFixed(2)}%</td>
            <td>${row.passCount}</td>
        </tr>
    `).join('');

    sectionBody.innerHTML = highlights.sectionRows.slice(0, 8).map((row, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>Class ${escapeHtml(row.className)}-${escapeHtml(row.section)}</td>
            <td>${escapeHtml(row.teacher)}</td>
            <td>${row.topperName === '-' ? '-' : escapeHtml(row.topperName)}</td>
            <td>${row.averagePercentage.toFixed(2)}%</td>
            <td>${row.passCount}/${row.publishedCount || 0}</td>
        </tr>
    `).join('');

    examBody.innerHTML = highlights.examInsights.rows.map((row) => `
        <tr>
            <td>${examLabel(row.examType)}</td>
            <td>${row.participants}</td>
            <td>${row.average.toFixed(2)}%</td>
            <td>${row.average >= PASS_MARKS ? 'Healthy' : 'Needs Attention'}</td>
        </tr>
    `).join('');
}

async function showStudents(className, section) {
    try {
        document.body.classList.add('loading');
        document.querySelector('.class-cards')?.style.setProperty('display', 'none');
        document.querySelector('.student-list')?.style.setProperty('display', 'block');
        document.querySelector('.back-to-classes')?.style.setProperty('display', 'block');
        setTextContent('selectedClassHeader', `Class ${className} Section ${section} - ${currentAcademicYear}`);

        const students = await fetchStudentsForSection(className, section);
        const studentsWithMarks = await Promise.all(students.map(async (student) => {
            const marksRecord = await fetchMarksForStudent(student._id);
            const metrics = buildStudentMetrics(marksRecord?.marks || []);

            return {
                ...student,
                marks: marksRecord?.marks || [],
                marksRecordId: marksRecord?._id || null,
                overallPercentage: metrics.overallPercentage,
                examPercentages: metrics.examPercentages,
                rank: marksRecord?.rank ?? null
            };
        }));

        initializeStudentTable(className, section, studentsWithMarks);
        document.body.classList.add('loaded');
    } catch (error) {
        console.error('Error loading students:', error);
        alert('Error loading students. Please try again.');
    } finally {
        document.body.classList.remove('loading');
    }
}

async function fetchStudentsForSection(className, section) {
    const cacheKey = `students-${currentAcademicYear}-${className}-${section}`;
    const cached = classCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
        return cached.data;
    }

    const response = await fetch(`${CONFIG.API_URL}/students/class/${className}/${section}?session=${encodeURIComponent(currentAcademicYear)}`, {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch students');
    }

    const students = await response.json();
    classCache.set(cacheKey, { data: students, timestamp: Date.now() });
    return students;
}

async function fetchMarksForStudent(studentId) {
    const cacheKey = `marks-${currentAcademicYear}-${studentId}`;
    const cached = marksCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
        return cached.data;
    }

    const response = await fetch(`${CONFIG.API_URL}/marks/${studentId}?academicYear=${encodeURIComponent(currentAcademicYear)}`, {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });

    if (!response.ok) {
        return null;
    }

    const marksRecord = await response.json();
    marksCache.set(cacheKey, { data: marksRecord, timestamp: Date.now() });
    return marksRecord;
}

function initializeStudentTable(className, section, students) {
    if (typeof $ !== 'function' || !document.getElementById('studentTable')) {
        return;
    }

    if (dataTable) {
        dataTable.destroy();
    }

    dataTable = $('#studentTable').DataTable({
        processing: true,
        order: [[7, 'desc'], [1, 'asc']],
        deferRender: true,
        pageLength: 25,
        dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>' +
             '<"row"<"col-sm-12"tr>>' +
             '<"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>',
        language: {
            processing: '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>'
        },
        data: students,
        columns: [
            { data: 'studentId' },
            { data: 'name' },
            { data: 'fatherName' },
            { data: null, render: (data) => formatPercentageValue(data.examPercentages?.pt1) },
            { data: null, render: (data) => formatPercentageValue(data.examPercentages?.hy) },
            { data: null, render: (data) => formatPercentageValue(data.examPercentages?.pt2) },
            { data: null, render: (data) => formatPercentageValue(data.examPercentages?.final) },
            { data: null, render: (data) => formatPercentageValue(data.overallPercentage) },
            {
                data: 'rank',
                render: (data) => data ? `${data}${getSuffix(data)}` : '-'
            },
            {
                data: null,
                orderable: false,
                searchable: false,
                render: (data) => buildActionButtons(className, section, data)
            }
        ]
    });
}

async function generateRanks() {
    try {
        if (!dataTable) {
            alert('Open a class section before generating ranks.');
            return;
        }

        document.body.classList.add('loading');
        const students = dataTable.rows().data().toArray();
        const rankableStudents = students
            .map((student) => ({
                ...student,
                overallPercentage: Number(student.overallPercentage) || 0
            }))
            .filter((student) => student.marksRecordId && student.overallPercentage > 0);

        if (!rankableStudents.length) {
            alert('No completed marks records were found for rank generation.');
            return;
        }

        rankableStudents.sort((a, b) => {
            if (Math.abs(b.overallPercentage - a.overallPercentage) > 0.0001) {
                return b.overallPercentage - a.overallPercentage;
            }
            return String(a.name || '').localeCompare(String(b.name || ''));
        });

        let previousPercentage = null;
        rankableStudents.forEach((student, index) => {
            if (previousPercentage !== null && Math.abs(student.overallPercentage - previousPercentage) < 0.0001) {
                student.generatedRank = rankableStudents[index - 1].generatedRank;
            } else {
                student.generatedRank = index + 1;
                previousPercentage = student.overallPercentage;
            }
        });

        const updates = await Promise.all(rankableStudents.map(async (student) => {
            const response = await fetch(`${CONFIG.API_URL}/marks/${student.marksRecordId}/rank`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ rank: student.generatedRank })
            });

            if (!response.ok) {
                throw new Error(`Failed to update rank for ${student.name}`);
            }

            const updatedRecord = await response.json();
            marksCache.set(`marks-${currentAcademicYear}-${student._id}`, {
                data: updatedRecord,
                timestamp: Date.now()
            });

            return {
                studentId: student._id,
                rank: updatedRecord.rank
            };
        }));

        const rankMap = new Map(updates.map((entry) => [entry.studentId, entry.rank]));
        const refreshedRows = students.map((student) => ({
            ...student,
            rank: rankMap.has(student._id) ? rankMap.get(student._id) : null
        }));

        dataTable.clear().rows.add(refreshedRows).draw(false);
        alert('Ranks generated successfully.');
    } catch (error) {
        console.error('Error generating ranks:', error);
        alert('Failed to generate ranks. Please try again.');
    } finally {
        document.body.classList.remove('loading');
    }
}

function buildStudentMetrics(marks = []) {
    const examPercentages = {};
    const validPercentages = [];

    EXAM_TYPES.forEach((examType) => {
        let total = 0;
        let maxTotal = 0;

        marks.forEach((subject) => {
            if (subject[examType]) {
                total += Number(subject[examType].written || 0) + Number(subject[examType].oral || 0);
                maxTotal += Number(subject[examType].maxMarksWritten || 80) + Number(subject[examType].maxMarksOral || 20);
            }
        });

        if (maxTotal > 0) {
            examPercentages[examType] = (total / maxTotal) * 100;
            validPercentages.push(examPercentages[examType]);
        } else {
            examPercentages[examType] = null;
        }
    });

    return {
        examPercentages,
        overallPercentage: validPercentages.length
            ? validPercentages.reduce((sum, percentage) => sum + percentage, 0) / validPercentages.length
            : 0
    };
}

function buildActionButtons(className, section, data) {
    const params = new URLSearchParams({
        studentId: data._id,
        className,
        section,
        academicYear: currentAcademicYear,
        studentName: data.name,
        admissionNo: data.studentId,
        fatherName: data.fatherName,
        gender: data.gender,
        contactNo: data.contactNo,
        rank: data.rank || ''
    });

    if (data.dob) {
        const dobDate = new Date(data.dob);
        if (!Number.isNaN(dobDate.getTime())) {
            const day = String(dobDate.getDate()).padStart(2, '0');
            const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dobDate.getMonth()];
            const year = dobDate.getFullYear();
            params.set('dob', `${day}-${month}-${year}`);
        }
    }

    return `
        <div class="action-buttons">
            <button class="btn btn-sm btn-primary me-1" onclick="window.location.href='marksheet-template.html?${params.toString()}'">
                <i class="fas fa-pen-to-square"></i> Marks
            </button>
            <button class="btn btn-sm btn-success" onclick="window.open('marksheet-template.html?${params.toString()}&print=true', '_blank')">
                <i class="fas fa-print"></i> Print
            </button>
        </div>
    `;
}

function computeExamInsights(students) {
    const rows = EXAM_TYPES.map((examType) => {
        const percentages = students
            .map((student) => student.examPercentages?.[examType])
            .filter((value) => typeof value === 'number' && Number.isFinite(value));

        return {
            examType,
            participants: percentages.length,
            average: averageOf(percentages)
        };
    });

    const validRows = rows.filter((row) => row.participants > 0);
    validRows.sort((left, right) => right.average - left.average);

    return {
        rows,
        strongestExam: validRows[0] || null,
        weakestExam: validRows[validRows.length - 1] || null
    };
}

function assignDisplayRanks(sortedStudents) {
    let previousPercentage = null;
    let previousRank = 0;

    return sortedStudents.map((student, index) => {
        let displayRank = index + 1;
        if (previousPercentage !== null && Math.abs(student.overallPercentage - previousPercentage) < 0.0001) {
            displayRank = previousRank;
        }

        previousPercentage = student.overallPercentage;
        previousRank = displayRank;

        return {
            ...student,
            displayRank
        };
    });
}

function sortStudentsByPerformance(students) {
    return [...students].sort((left, right) => {
        if (Math.abs(right.overallPercentage - left.overallPercentage) > 0.0001) {
            return right.overallPercentage - left.overallPercentage;
        }

        const rankLeft = Number(left.rank) || Number.MAX_SAFE_INTEGER;
        const rankRight = Number(right.rank) || Number.MAX_SAFE_INTEGER;
        if (rankLeft !== rankRight) {
            return rankLeft - rankRight;
        }

        return String(left.name || '').localeCompare(String(right.name || ''), undefined, { sensitivity: 'base' });
    });
}

function averageOf(values) {
    const numericValues = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
    if (!numericValues.length) {
        return 0;
    }

    return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
}

function chunkArray(items, chunkSize) {
    const chunks = [];
    for (let index = 0; index < items.length; index += chunkSize) {
        chunks.push(items.slice(index, index + chunkSize));
    }
    return chunks;
}

function calculateGrade(percentage) {
    if (percentage >= 91) return 'A1 - Outstanding';
    if (percentage >= 81) return 'A2 - Excellent';
    if (percentage >= 71) return 'B1 - Very Good';
    if (percentage >= 61) return 'B2 - Good';
    if (percentage >= 51) return 'C1 - Fair';
    if (percentage >= 41) return 'C2 - Average';
    if (percentage >= 33) return 'D - Below Average';
    return 'E - Needs Improvement';
}

function examLabel(examType) {
    switch (examType) {
        case 'pt1': return 'Periodic Test 1';
        case 'hy': return 'Half Yearly';
        case 'pt2': return 'Periodic Test 2';
        case 'final': return 'Final Exam';
        default: return examType;
    }
}

function getMedalIcon(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '🏅';
}

function formatRank(rank) {
    return `${rank}${getSuffix(rank)}`;
}

function formatPercentageValue(value) {
    return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(2)}%` : '-';
}

function compareClassNames(left, right) {
    const leftNumber = extractLeadingNumber(left);
    const rightNumber = extractLeadingNumber(right);

    if (leftNumber !== null && rightNumber !== null && leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
    }

    return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
}

function extractLeadingNumber(value) {
    const match = String(value).match(/\d+/);
    return match ? Number(match[0]) : null;
}

function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function setTextContent(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function setHtmlContent(id, html) {
    const element = document.getElementById(id);
    if (element) {
        element.innerHTML = html;
    }
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getSuffix(rank) {
    if (!rank) return '';
    if (rank % 100 >= 11 && rank % 100 <= 13) return 'th';
    switch (rank % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}
