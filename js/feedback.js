document.addEventListener('DOMContentLoaded', () => {
    const feedbackForm = document.getElementById('feedbackForm');
    const submitButton = document.getElementById('submitButton');
    const stars = document.querySelectorAll('.star');
    const ratingInput = document.getElementById('rating');
    let selectedRating = 0;

    // Handle star rating
    stars.forEach(star => {
        star.addEventListener('mouseover', function() {
            const rating = parseInt(this.dataset.rating);
            stars.forEach(s => {
                const r = parseInt(s.dataset.rating);
                if (r <= rating) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });
        });

        star.addEventListener('mouseout', function() {
            if (!selectedRating) {
                stars.forEach(s => s.classList.remove('active'));
            } else {
                stars.forEach(s => {
                    const r = parseInt(s.dataset.rating);
                    if (r <= selectedRating) {
                        s.classList.add('active');
                    } else {
                        s.classList.remove('active');
                    }
                });
            }
        });

        star.addEventListener('click', function() {
            selectedRating = parseInt(this.dataset.rating);
            ratingInput.value = selectedRating;
            stars.forEach(s => {
                const r = parseInt(s.dataset.rating);
                if (r <= selectedRating) {
                    s.classList.add('active', 'selected');
                } else {
                    s.classList.remove('active', 'selected');
                }
            });
        });
    });

    const setLoading = (isLoading) => {
        const normalState = submitButton.querySelector('.normal-state');
        const loadingState = submitButton.querySelector('.loading-state');
        submitButton.disabled = isLoading;
        
        if (isLoading) {
            normalState.classList.add('d-none');
            loadingState.classList.remove('d-none');
        } else {
            normalState.classList.remove('d-none');
            loadingState.classList.add('d-none');
        }
    };

    feedbackForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!feedbackForm.checkValidity() || !ratingInput.value) {
            e.stopPropagation();
            feedbackForm.classList.add('was-validated');
            if (!ratingInput.value) {
                alert('Please select a rating');
            }
            return;
        }

        const feedbackData = {
            parentName: document.getElementById('parentName').value,
            studentName: document.getElementById('studentName').value,
            email: document.getElementById('email').value,
            class: document.getElementById('class').value,
            category: document.getElementById('category').value,
            rating: parseInt(ratingInput.value),
            feedback: document.getElementById('feedback').value,
            suggestions: document.getElementById('suggestions').value,
            submittedAt: new Date().toISOString()
        };

        try {
            setLoading(true);
            const response = await fetch(`${CONFIG.API_URL}/new-feedback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(feedbackData)
            });

            if (response.ok) {
                alert('Thank you for your feedback!');
                feedbackForm.reset();
                feedbackForm.classList.remove('was-validated');
                stars.forEach(s => s.classList.remove('active', 'selected'));
                ratingInput.value = '';
                selectedRating = 0;
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Failed to submit feedback');
            }
        } catch (error) {
            console.error('Error submitting feedback:', error);
            alert(error.message || 'An error occurred while submitting feedback. Please try again.');
        } finally {
            setLoading(false);
        }
    });
});
