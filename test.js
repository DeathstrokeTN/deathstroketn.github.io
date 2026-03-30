// test.js - Handles OpenTDB Quiz generation, scoring, and Firebase tracking

const DB_URL = "https://caregiver-c85e3-default-rtdb.europe-west1.firebasedatabase.app";
let currentUser = JSON.parse(localStorage.getItem("communityUser") || "null");
let currentQuestions = [];

$(document).ready(function() {
    
    // Auth Check
    if (currentUser) {
        $("#user-info").removeClass("d-none");
        $("#quiz-user-name").text(currentUser.name);
        $("#history-login-warning").hide();
        fetchHistory();
    } else {
        $("#auth-alert").removeClass("d-none");
        $("#history-login-warning").show();
    }

    // Decode HTML Entities from OpenTDB
    function decodeHTML(html) {
        var txt = document.createElement("textarea");
        txt.innerHTML = html;
        return txt.value;
    }

    // Shuffle Array for Answers
    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Fetch Quiz
    function loadQuiz() {
        $("#quiz-loader").removeClass("d-none");
        $("#quiz-content").addClass("d-none");
        $("#quiz-result").addClass("d-none");
        $("#questions-wrapper").empty();

        // OpenTDB Category 17 is Science & Nature (closest to medical standard). Type multiple choice.
        $.get("https://opentdb.com/api.php?amount=5&category=17&type=multiple", function(data) {
            currentQuestions = data.results;
            
            let html = "";
            currentQuestions.forEach((q, index) => {
                let decodedQuestion = decodeHTML(q.question);
                
                // Group correct and incorrect answers and shuffle
                let answers = [...q.incorrect_answers, q.correct_answer].map(decodeHTML);
                answers = shuffle(answers);

                let answersHtml = "";
                answers.forEach((ans, ansIndex) => {
                    let id = `q${index}_a${ansIndex}`;
                    answersHtml += `
                        <div class="form-check mb-2">
                          <input class="form-check-input d-none q-input" type="radio" name="q${index}" id="${id}" value="${ans}" required>
                          <label class="form-check-label shadow-sm" for="${id}">${ans}</label>
                        </div>
                    `;
                });

                html += `
                <div class="question" data-index="${index}">
                  <h5 class="fw-bold mb-3">${index + 1}. ${decodedQuestion}</h5>
                  <span class="badge bg-secondary mb-3">${q.difficulty.toUpperCase()}</span>
                  ${answersHtml}
                </div>`;
            });

            $("#questions-wrapper").html(html);
            $("#quiz-loader").addClass("d-none");
            $("#quiz-content").removeClass("d-none");
        }).fail(function() {
            $("#quiz-loader").html("<p class='text-danger'>Failed to load questions. Please check your internet connection.</p>");
        });
    }

    // Initial Load
    loadQuiz();

    // Handle Form Submit
    $("#dynamic-quiz-form").submit(function(e) {
        e.preventDefault();
        
        let score = 0;
        let total = currentQuestions.length;

        // Grade Quiz
        currentQuestions.forEach((q, index) => {
            let selectedVal = $(`input[name="q${index}"]:checked`).val();
            let correctAns = decodeHTML(q.correct_answer);
            
            // Highlight answers
            $(`input[name="q${index}"]`).each(function() {
                let $label = $(this).siblings("label");
                if ($(this).val() === correctAns) {
                    $label.addClass("correct-ans");
                } else if ($(this).val() === selectedVal && selectedVal !== correctAns) {
                    $label.addClass("wrong-ans");
                }
                $(this).prop("disabled", true); // Disable inputs after submission
            });

            if (selectedVal === correctAns) {
                score++;
            }
        });

        // Hide button, show result
        $("#submit-quiz-btn").hide();
        $("#result-score").text(`You scored ${score} out of ${total}!`);
        
        if (score === total) {
            $("#result-text").text("Excellent! You have a great grasp of science and health.");
            $("#result-score").removeClass().addClass("fw-bold display-4 text-success mb-3");
        } else if (score >= total / 2) {
            $("#result-text").text("Good job! You did pretty well.");
            $("#result-score").removeClass().addClass("fw-bold display-4 text-warning mb-3");
        } else {
            $("#result-text").text("Keep learning! You can always try again to improve your score.");
            $("#result-score").removeClass().addClass("fw-bold display-4 text-danger mb-3");
        }

        $("#quiz-result").removeClass("d-none");

        // Save to Firebase
        if (currentUser) {
            let resultData = {
                score: score,
                total: total,
                timestamp: Date.now()
            };

            $.ajax({
                url: `${DB_URL}/users/${currentUser.id}/test_results.json`,
                type: 'POST',
                data: JSON.stringify(resultData),
                success: function() {
                    fetchHistory(); // Update history list
                }
            });
        }
    });

    // Retake Quiz
    $("#retake-btn").click(function() {
        $("#submit-quiz-btn").show();
        loadQuiz();
    });

    // Fetch History
    function fetchHistory() {
        $("#history-loader").removeClass("d-none");
        $.ajax({
            url: `${DB_URL}/users/${currentUser.id}/test_results.json`,
            type: 'GET',
            success: function(data) {
                $("#history-loader").addClass("d-none");
                let list = $("#history-list");
                list.empty();

                if (!data) {
                    list.html('<div class="text-muted small">No past results found. Select "Submit Answers" to record your first score.</div>');
                    return;
                }

                let historyArr = [];
                for (let k in data) historyArr.push(data[k]);
                historyArr.sort((a,b) => b.timestamp - a.timestamp); // newest first

                historyArr.forEach(item => {
                    let d = new Date(item.timestamp);
                    let dateStr = d.toLocaleDateString() + " " + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    let pct = Math.round((item.score / item.total) * 100);
                    let color = pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'danger';
                    
                    list.append(`
                        <li class="list-group-item px-0 py-3 d-flex justify-content-between align-items-center">
                            <div>
                                <small class="text-muted d-block">${dateStr}</small>
                                <strong class="text-${color}">Score: ${item.score}/${item.total}</strong>
                            </div>
                            <span class="badge bg-${color} rounded-pill">${pct}%</span>
                        </li>
                    `);
                });
            }
        });
    }

});
