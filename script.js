document.addEventListener('DOMContentLoaded', () => {
  // Load Navbar first
  loadNavbar();

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

  // Interactive boxes logic (Toggle active class for CSS transition)
  $(document).on('click', '.interactive-box', function () {
    $(this).toggleClass('active');
  });

  // Load saved language on startup or default to English
  const savedLang = localStorage.getItem('selectedLang') || 'en';
  if (typeof translations !== 'undefined') {
    setLanguage(savedLang);
  }
});

// Dynamic Navbar Loader
async function loadNavbar() {
  const placeholder = document.getElementById('navbar-placeholder');
  if (!placeholder) return;

  try {
    const response = await fetch('./navbar.html');
    const content = await response.text();
    placeholder.innerHTML = content;

    // Highlight active link
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = placeholder.querySelectorAll('a');
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href === currentPath) {
        link.classList.add('bg-primary/10', 'text-primary', 'font-bold');
        link.classList.remove('text-gray-700');
      }
    });

    // Re-bind language switchers
    const langSwitchers = placeholder.querySelectorAll('.lang-switch');
    langSwitchers.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const lang = btn.getAttribute('data-lang');
        setLanguage(lang);
      });
    });

    // Apply current language to navbar
    const savedLang = localStorage.getItem('selectedLang') || 'en';
    setLanguage(savedLang);

  } catch (error) {
    console.error('Error loading navbar:', error);
  }
}

// Helper function to switch language
function setLanguage(lang) {
  localStorage.setItem('selectedLang', lang);

  if (lang === 'ar' || lang === 'tn') {
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', lang);
    document.body.classList.add('font-arabic'); // Optional: for specific Arabic fonts
  } else {
    document.documentElement.setAttribute('dir', 'ltr');
    document.documentElement.setAttribute('lang', lang);
    document.body.classList.remove('font-arabic');
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
    const randomKey = tipKeys[Math.floor(Math.random() * tipKeys.length)];
    if (translations[lang] && translations[lang][randomKey]) {
      tipElement.innerHTML = translations[lang][randomKey];
    }
  }
}

