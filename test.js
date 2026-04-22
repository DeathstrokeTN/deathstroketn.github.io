// test.js - Handles Caregiver Burnout Assessment, scoring, and Firebase tracking

const DB_URL = "https://caregiver-c85e3-default-rtdb.europe-west1.firebasedatabase.app";
let currentUser = JSON.parse(localStorage.getItem("communityUser") || "null");

const BURNOUT_QUESTIONS = [
    { q: "How often do you feel overwhelmed by your caregiving responsibilities?", category: "Emotional" },
    { q: "How often do you feel you don't have enough time for yourself?", category: "Personal" },
    { q: "How often do you feel stressed about balancing caregiving with other responsibilities?", category: "Life Balance" },
    { q: "How often do you feel irritable or impatient when you are around the person you care for?", category: "Emotional" },
    { q: "How often do you feel that your physical or mental health has suffered?", category: "Health" },
    { q: "How often do you feel you don't have as much privacy as you would like?", category: "Personal" },
    { q: "How often do you feel your social life or relationships have suffered?", category: "Social" },
    { q: "How often do you feel uncomfortable or embarrassed about your loved one's behavior?", category: "Social" },
    { q: "How often do you feel you don't have enough financial resources for care?", category: "Financial" },
    { q: "How often do you feel you will be unable to take care of your loved one much longer?", category: "Sustainability" }
];

$(document).ready(function() {
    
    // Auth Check
    if (currentUser) {
        $("#user-info").removeClass("hidden");
        $("#quiz-user-name").text(currentUser.name);
        $("#history-login-warning").hide();
        fetchHistory();
    } else {
        $("#auth-alert").removeClass("hidden");
        $("#history-login-warning").show();
    }

    // Load Assessment
    function loadAssessment() {
        const lang = localStorage.getItem('selectedLang') || 'en';
        const t = translations[lang];

        $("#quiz-loader").removeClass("hidden");
        $("#quiz-content").addClass("hidden");
        $("#quiz-result").addClass("hidden");
        $("#questions-wrapper").empty();

        // Translate categories
        const catMap = {
            "Emotional": t.cat_emotional,
            "Personal": t.cat_personal,
            "Life Balance": t.cat_balance,
            "Health": t.cat_health,
            "Social": t.cat_social,
            "Financial": t.cat_financial,
            "Sustainability": t.cat_sustainability
        };

        const optionsTranslated = [
            { label: t.opt_never, value: 0 },
            { label: t.opt_rarely, value: 1 },
            { label: t.opt_sometimes, value: 2 },
            { label: t.opt_often, value: 3 },
            { label: t.opt_always, value: 4 }
        ];

        let html = "";
        BURNOUT_QUESTIONS.forEach((q, index) => {
            let optionsHtml = "";
            optionsTranslated.forEach((opt) => {
                let id = `q${index}_v${opt.value}`;
                optionsHtml += `
                    <div class="relative">
                      <input class="peer hidden" type="radio" name="q${index}" id="${id}" value="${opt.value}" required>
                      <label class="block cursor-pointer bg-gray-50 border-2 border-transparent px-4 py-3 rounded-xl hover:bg-accent/10 transition-all text-center font-medium text-gray-700 peer-checked:border-primary peer-checked:bg-primary/5 peer-checked:text-primary peer-checked:font-bold" for="${id}">
                        ${opt.label}
                      </label>
                    </div>
                `;
            });

            const questionText = t[`test_q${index}`] || q.q;
            const categoryText = catMap[q.category] || q.category;

            html += `
            <div class="mb-10 pb-10 border-b border-gray-100 last:border-0" data-index="${index}">
              <div class="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                <h5 class="text-xl font-bold text-primary">${index + 1}. ${questionText}</h5>
                <span class="bg-gray-100 text-gray-500 text-[10px] px-3 py-1 rounded-full border border-gray-200 uppercase font-extrabold tracking-wider whitespace-nowrap">${categoryText}</span>
              </div>
              <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
                ${optionsHtml}
              </div>
            </div>`;
        });

        $("#questions-wrapper").html(html);
        $("#quiz-loader").addClass("hidden");
        $("#quiz-content").removeClass("hidden");
    }

    // Initial Load
    loadAssessment();

    // Handle Form Submit
    $("#dynamic-quiz-form").submit(function(e) {
        e.preventDefault();
        const lang = localStorage.getItem('selectedLang') || 'en';
        const t = translations[lang];
        
        let totalScore = 0;
        let maxScore = BURNOUT_QUESTIONS.length * 4;

        BURNOUT_QUESTIONS.forEach((_, index) => {
            let selectedVal = parseInt($(`input[name="q${index}"]:checked`).val());
            totalScore += selectedVal;
            $(`input[name="q${index}"]`).prop("disabled", true);
        });

        // Feedback Logic using translations
        let resultTitle = "";
        let resultText = "";
        let resultColor = "";

        if (totalScore <= 10) {
            resultTitle = t.res_low;
            resultText = t.res_low_msg;
            resultColor = "text-green-600";
        } else if (totalScore <= 20) {
            resultTitle = t.res_mild;
            resultText = t.res_mild_msg;
            resultColor = "text-yellow-600";
        } else if (totalScore <= 30) {
            resultTitle = t.res_high;
            resultText = t.res_high_msg;
            resultColor = "text-red-600";
        } else {
            resultTitle = t.res_severe;
            resultText = t.res_severe_msg;
            resultColor = "text-red-700 font-black uppercase";
        }

        // Display results
        $("#submit-quiz-btn").hide();
        $("#result-score").text(`${resultTitle} (${totalScore}/${maxScore})`).removeClass().addClass(`text-3xl font-extrabold mb-4 ${resultColor}`);
        $("#result-text").text(resultText);
        $("#quiz-result").removeClass("hidden");

        // Save to Firebase
        if (currentUser) {
            let resultData = {
                score: totalScore,
                total: maxScore,
                title: resultTitle,
                timestamp: Date.now()
            };

            $.ajax({
                url: `${DB_URL}/users/${currentUser.id}/test_results.json`,
                type: 'POST',
                data: JSON.stringify(resultData),
                success: function() {
                    fetchHistory();
                }
            });
        }
    });

    // Retake Assessment
    $("#retake-btn").click(function() {
        $("#submit-quiz-btn").show();
        loadAssessment();
    });

    // Fetch History
    function fetchHistory() {
        $("#history-loader").removeClass("hidden");
        $.ajax({
            url: `${DB_URL}/users/${currentUser.id}/test_results.json`,
            type: 'GET',
            success: function(data) {
                $("#history-loader").addClass("hidden");
                let list = $("#history-list");
                list.empty();

                if (!data) {
                    list.html('<div class="text-gray-400 text-sm py-4 italic">No past results found. Complete an assessment to see your history.</div>');
                    return;
                }

                let historyArr = [];
                for (let k in data) historyArr.push(data[k]);
                historyArr.sort((a,b) => b.timestamp - a.timestamp);

                historyArr.forEach(item => {
                    let d = new Date(item.timestamp);
                    let dateStr = d.toLocaleDateString();
                    let pct = Math.round((item.score / item.total) * 100);
                    let colorClass = pct >= 75 ? 'text-red-600 bg-red-50' : pct >= 50 ? 'text-yellow-600 bg-yellow-50' : 'text-green-600 bg-green-50';
                    let badgeClass = pct >= 75 ? 'bg-red-600' : pct >= 50 ? 'bg-yellow-600' : 'bg-green-600';
                    
                    list.append(`
                        <li class="flex justify-between items-center py-4 border-b border-gray-100 last:border-0">
                            <div>
                                <small class="text-gray-400 block text-[10px] uppercase font-bold tracking-tighter">${dateStr}</small>
                                <strong class="${colorClass.split(' ')[0]} text-sm">${item.title || 'Result'}: ${item.score}/${item.total}</strong>
                            </div>
                            <span class="${badgeClass} text-white text-[10px] font-bold px-2 py-1 rounded-full">${pct}%</span>
                        </li>
                    `);
                });
            }
        });
    }

});

