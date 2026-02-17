/* ============================================
   EdTheStatMan.com - Main JavaScript
   Animations, Navigation, Scroll Effects
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initScrollAnimations();
  initParticles();
  initCounters();
  initBackToTop();
  initSystemBars();
  initTickerDuplicate();
  initSportTabs();
  initChartBars();
});

/* ---------- Navigation ---------- */
function initNavigation() {
  const nav = document.querySelector('.nav');
  const hamburger = document.querySelector('.nav__hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');

  // Scroll effect
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
  }, { passive: true });

  // Hamburger toggle
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      mobileMenu.classList.toggle('active');
      document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
    });

    // Close on link click
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  // Active link highlight
  highlightActiveLink();
}

function highlightActiveLink() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav__link, .mobile-menu__link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

/* ---------- Scroll Animations (Intersection Observer) ---------- */
function initScrollAnimations() {
  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -80px 0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        // Only unobserve non-counter elements
        if (!entry.target.classList.contains('counter')) {
          observer.unobserve(entry.target);
        }
      }
    });
  }, observerOptions);

  // Observe all reveal elements
  document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale, .stagger-children').forEach(el => {
    observer.observe(el);
  });
}

/* ---------- Particle Animation ---------- */
function initParticles() {
  const container = document.querySelector('.hero__particles');
  if (!container) return;

  const particleCount = 30;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'hero__particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 8 + 's';
    particle.style.animationDuration = (6 + Math.random() * 6) + 's';
    particle.style.width = (2 + Math.random() * 4) + 'px';
    particle.style.height = particle.style.width;
    particle.style.opacity = 0.1 + Math.random() * 0.3;

    // Sportsbook particle colors
    const colors = ['#34d399', '#6ee7b7', '#818cf8', '#06b6d4'];
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];

    container.appendChild(particle);
  }
}

/* ---------- Animated Counters ---------- */
function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;

  const observerOptions = {
    threshold: 0.5
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.dataset.counted) {
        animateCounter(entry.target);
        entry.target.dataset.counted = 'true';
      }
    });
  }, observerOptions);

  counters.forEach(counter => observer.observe(counter));
}

function animateCounter(element) {
  const target = parseFloat(element.dataset.count);
  const duration = 2000;
  const start = performance.now();
  const prefix = element.dataset.prefix || '';
  const suffix = element.dataset.suffix || '';
  const decimals = element.dataset.decimals ? parseInt(element.dataset.decimals) : 0;

  function update(currentTime) {
    const elapsed = currentTime - start;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function (ease out expo)
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    const current = target * eased;

    element.textContent = prefix + current.toFixed(decimals) + suffix;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

/* ---------- Back to Top Button ---------- */
function initBackToTop() {
  const btn = document.querySelector('.back-to-top');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 500) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ---------- System Progress Bars ---------- */
function initSystemBars() {
  const bars = document.querySelectorAll('.system-card__bar-fill, .sys-card__bar-fill');
  if (!bars.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = entry.target.dataset.width;
        entry.target.style.width = target + '%';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  bars.forEach(bar => observer.observe(bar));
}

/* ---------- Ticker Duplication ---------- */
function initTickerDuplicate() {
  const track = document.querySelector('.ticker__track');
  if (!track) return;

  // Clone items for seamless scrolling
  const items = track.innerHTML;
  track.innerHTML = items + items;
}

/* ---------- Sport Tabs ---------- */
function initSportTabs() {
  const tabs = document.querySelectorAll('.sport-tab');
  if (!tabs.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all tabs in same group
      const parent = tab.closest('.sport-tabs');
      if (parent) {
        parent.querySelectorAll('.sport-tab').forEach(t => t.classList.remove('active'));
      }
      tab.classList.add('active');

      // Show/hide content
      const target = tab.dataset.tab;
      if (target) {
        const tabContent = document.querySelectorAll('.tab-content');
        tabContent.forEach(content => {
          content.style.display = content.dataset.content === target ? 'block' : 'none';
        });
      }
    });
  });
}

/* ---------- Smooth Anchor Scrolling ---------- */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const targetId = this.getAttribute('href');
    if (targetId === '#') return;

    const target = document.querySelector(targetId);
    if (target) {
      e.preventDefault();
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

/* ---------- Chart Bar Animation ---------- */
function initChartBars() {
  const chartBars = document.querySelectorAll('.chart-bar');
  if (!chartBars.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const bars = entry.target.querySelectorAll('.chart-bar');
        bars.forEach((bar, index) => {
          setTimeout(() => {
            bar.style.height = bar.dataset.height + '%';
          }, index * 50);
        });
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  const chartContainer = document.querySelector('.chart-bars');
  if (chartContainer) {
    observer.observe(chartContainer);
  }
}

/* ---------- Form Submission ---------- */
document.addEventListener('submit', (e) => {
  if (e.target.classList.contains('contact-form')) {
    e.preventDefault();

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Sending...';
    btn.disabled = true;

    // Simulate form submission
    setTimeout(() => {
      btn.textContent = 'Message Sent!';
      btn.style.background = 'var(--gradient-green)';
      e.target.reset();

      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
        btn.disabled = false;
      }, 3000);
    }, 1500);
  }
});

/* ---------- Newsletter Form ---------- */
document.addEventListener('submit', (e) => {
  if (e.target.classList.contains('newsletter-form')) {
    e.preventDefault();
    const input = e.target.querySelector('input');
    const btn = e.target.querySelector('button');

    if (input.value) {
      btn.textContent = 'Subscribed!';
      input.value = '';
      setTimeout(() => {
        btn.textContent = 'Subscribe';
      }, 3000);
    }
  }
});

/* ---------- Typing Animation for StatBot ---------- */
function initStatBotTyping() {
  const messages = document.querySelector('.statbot-chat__messages');
  if (!messages) return;

  const botMessages = [
    "Based on my analysis, the Lakers are 7-2 ATS as home underdogs this season.",
    "The over has hit in 8 of the last 10 Chiefs games.",
    "Duke is 12-3 ATS as a favorite of 10+ points."
  ];

  let messageIndex = 0;

  setInterval(() => {
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-message chat-message--user';
    userMsg.textContent = 'Show me another trend';
    messages.appendChild(userMsg);

    setTimeout(() => {
      const botMsg = document.createElement('div');
      botMsg.className = 'chat-message chat-message--bot';
      botMsg.textContent = botMessages[messageIndex % botMessages.length];
      messages.appendChild(botMsg);
      messageIndex++;

      messages.scrollTop = messages.scrollHeight;
    }, 1500);
  }, 8000);
}
