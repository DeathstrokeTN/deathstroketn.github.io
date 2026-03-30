document.addEventListener('DOMContentLoaded', () => {
  // Tips of the day logic
  const tips = [
    "Take deep breaths when you feel overwhelmed. Taking care of yourself is taking care of them.",
    "It's okay to ask for help. Reach out to family or professional support networks.",
    "Celebrate small victories. Recovery and caregiving are a marathon, not a sprint.",
    "Remember that the disease is causing the behavior, not the person.",
    "Set aside at least 15 minutes a day just for yourself.",
    "Keep a journal to track progress and your own feelings.",
    "Stay hydrated and try to maintain a regular sleep schedule."
  ];

  const tipElement = document.getElementById('daily-tip');
  if (tipElement) {
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    tipElement.textContent = randomTip;
  }

  // Interactive buttons logic
  const interactiveBoxes = document.querySelectorAll('.interactive-box');
  interactiveBoxes.forEach(box => {
    box.addEventListener('click', () => {
      const advice = box.querySelector('.hidden-advice');
      if (advice) {
        if (advice.style.display === 'block') {
          advice.style.display = 'none';
        } else {
          advice.style.display = 'block';
        }
      }
    });
  });

  // Language switch logic
  const langSwitchers = document.querySelectorAll('.lang-switch');
  langSwitchers.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const lang = btn.getAttribute('data-lang');
      setLanguage(lang);
    });
  });

  // Load saved language on startup or default to English
  const savedLang = localStorage.getItem('selectedLang') || 'en';
  if (typeof translations !== 'undefined') {
    setLanguage(savedLang);
  }

  // Self assessment logic
  const quizForm = document.getElementById('self-test-form');
  if (quizForm) {
    quizForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(quizForm);
      let score = 0;
      let answered = 0;
      
      for (let value of formData.values()) {
        score += parseInt(value);
        answered++;
      }

      const lang = localStorage.getItem('selectedLang') || 'en';

      if (answered < 5) {
        alert(translations[lang] && translations[lang]['test_alert'] ? translations[lang]['test_alert'] : "Please answer all questions to get your result.");
        return;
      }

      const resultBox = document.getElementById('quiz-result');
      const resultTitle = document.getElementById('result-title');
      const resultText = document.getElementById('result-text');

      resultBox.style.display = 'block';
      resultBox.classList.remove('alert-success', 'alert-warning', 'alert-danger');

      if (score <= 8) {
        resultBox.classList.add('alert-success');
        resultTitle.innerHTML = translations[lang] && translations[lang]['res_low_title'] ? translations[lang]['res_low_title'] : "Low Stress Levels";
        resultText.innerHTML = translations[lang] && translations[lang]['res_low_desc'] ? translations[lang]['res_low_desc'] : "You are managing your caregiving duties well. Continue your good habits and self-care routine!";
      } else if (score <= 12) {
        resultBox.classList.add('alert-warning');
        resultTitle.innerHTML = translations[lang] && translations[lang]['res_med_title'] ? translations[lang]['res_med_title'] : "Moderate Stress - Approaching Burnout";
        resultText.innerHTML = translations[lang] && translations[lang]['res_med_desc'] ? translations[lang]['res_med_desc'] : "You are showing signs of caregiver stress. Please consider asking for help and taking more breaks. It's crucial for your well-being.";
      } else {
        resultBox.classList.add('alert-danger');
        resultTitle.innerHTML = translations[lang] && translations[lang]['res_high_title'] ? translations[lang]['res_high_title'] : "High Risk of Burnout";
        resultText.innerHTML = translations[lang] && translations[lang]['res_high_desc'] ? translations[lang]['res_high_desc'] : "You are experiencing high levels of stress and possible burnout. Please contact a professional or a support group immediately. You need support to continue caring for your loved one.";
      }

      // Scroll to result
      resultBox.scrollIntoView({ behavior: 'smooth' });
    });
  }
});

// Helper function to switch language
function setLanguage(lang) {
  localStorage.setItem('selectedLang', lang);

  if (lang === 'ar') {
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'ar');
    // Bootstrap RTL adjustment (swap margins/paddings handles via Bootstrap 5 logical properties, but some overrides may be needed)
  } else {
    document.documentElement.setAttribute('dir', 'ltr');
    document.documentElement.setAttribute('lang', lang);
  }

  // Replace text using innerHTML to support <br> and <strong>
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang] && translations[lang][key]) {
      el.innerHTML = translations[lang][key];
    }
  });

  // Update dynamic tips based on language
  updateTipLanguage(lang);
}

function updateTipLanguage(lang) {
  const tipElement = document.getElementById('daily-tip');
  if (tipElement && typeof translations !== 'undefined') {
    const tipKeys = ['tip_1', 'tip_2', 'tip_3', 'tip_4', 'tip_5', 'tip_6', 'tip_7'];
    // We want a random tip based on daily tip keys
    const randomKey = tipKeys[Math.floor(Math.random() * tipKeys.length)];
    if (translations[lang] && translations[lang][randomKey]) {
      tipElement.innerHTML = translations[lang][randomKey];
    }
  }
}

