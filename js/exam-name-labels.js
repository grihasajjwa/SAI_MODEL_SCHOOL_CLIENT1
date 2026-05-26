(function () {
    const DEFAULT_LABELS = {
        pt1: 'Periodic Test 1',
        hy: 'Half Yearly',
        pt2: 'Periodic Test 2',
        final: 'Final Exam'
    };

    window.ExamNameLabels = {
        labels: { ...DEFAULT_LABELS },
        get(key) {
            return this.labels[key] || DEFAULT_LABELS[key] || key;
        }
    };

    function getToken() {
        if (window.Auth?.getToken) return window.Auth.getToken();
        return localStorage.getItem(window.CONFIG?.STORAGE_KEYS?.TOKEN || 'skyview_token');
    }

    function getSession() {
        const params = new URLSearchParams(window.location.search);
        return params.get('academicYear')
            || params.get('session')
            || document.getElementById('academicYear')?.textContent?.trim()
            || document.getElementById('academicYearDisplay')?.textContent?.trim()
            || document.getElementById('sessionSelect')?.value
            || window.CONFIG?.CURRENT_SESSION
            || '';
    }

    function replaceTextLabels() {
        const replacements = Object.entries(DEFAULT_LABELS).map(([key, defaultLabel]) => ({
            defaultLabel,
            label: window.ExamNameLabels.get(key)
        }));

        document.querySelectorAll('th, h4, h6, label, p, span').forEach((element) => {
            const current = element.textContent.trim();
            const match = replacements.find((item) => item.defaultLabel === current);
            if (match && match.label) {
                element.textContent = match.label;
            }
        });
    }

    async function loadExamNameLabels() {
        try {
            const session = getSession();
            const token = getToken();
            if (!session || !token || !window.CONFIG?.API_URL) {
                replaceTextLabels();
                return;
            }

            const response = await fetch(`${CONFIG.API_URL}/exam-names/${encodeURIComponent(session)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const payload = response.ok ? await response.json() : {};
            (payload.config?.exams || []).forEach((exam) => {
                if (exam.key && exam.name) {
                    window.ExamNameLabels.labels[exam.key] = exam.name;
                }
            });
        } catch (error) {
            console.warn('Unable to load dynamic exam names:', error);
        } finally {
            replaceTextLabels();
        }
    }

    document.addEventListener('DOMContentLoaded', loadExamNameLabels);
})();
