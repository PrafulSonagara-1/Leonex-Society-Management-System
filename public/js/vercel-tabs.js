/**
 * Navigation Module
 * Futrahood-style Underline Hover & Active Navigation
 *
 * Features:
 * - Clean text hover with smooth CSS underline expansion from left (no hover box/pill)
 * - Active page indicator with persistent underline
 * - Smooth anchor scrolling for in-page sections (#about, #features, #contact)
 * - Scrollspy to update active underline as user scrolls through sections
 */

(function () {
  'use strict';

  function initVercelTabs() {
    const navContainers = document.querySelectorAll('.cosmic-nav-links, .nav-center-links');
    if (!navContainers.length) return;

    navContainers.forEach((nav) => {
      // Avoid duplicate initialization
      if (nav.dataset.vercelTabsInit) return;
      nav.dataset.vercelTabsInit = 'true';

      // Clean up any legacy dynamic elements if present
      const oldHoverPill = nav.querySelector('.vercel-nav-hover-pill');
      if (oldHoverPill) oldHoverPill.remove();
      const oldActiveLine = nav.querySelector('.vercel-nav-active-line');
      if (oldActiveLine) oldActiveLine.remove();

      nav.classList.add('vercel-tabs-ready');

      // Get all interactive tab links in this navigation
      const links = Array.from(nav.querySelectorAll('.cosmic-nav-link, .nav-pill'));
      if (!links.length) return;

      // Identify currently active link based on class or current URL path
      let currentActiveLink = nav.querySelector('.cosmic-nav-link.active, .nav-pill.active');
      if (!currentActiveLink) {
        const path = window.location.pathname;
        if (path.includes('docs.html')) {
          currentActiveLink = links.find((l) => l.getAttribute('href') === 'docs.html');
        } else if (path.includes('changelog.html')) {
          currentActiveLink = links.find((l) => l.getAttribute('href') === 'changelog.html');
        }
      }
      if (!currentActiveLink) {
        currentActiveLink = links[0];
      }

      // Set active link
      function setActiveLink(link) {
        if (!link) return;
        currentActiveLink = link;

        links.forEach((l) => l.classList.remove('active'));
        link.classList.add('active');
      }

      // Ensure initial active link is marked
      if (currentActiveLink) {
        setActiveLink(currentActiveLink);
      }

      // Scrollspy lock mechanism: prevents glitching during smooth scroll
      let isScrollspyLocked = false;
      let scrollLockTimer = null;

      function lockScrollspy(duration = 900) {
        isScrollspyLocked = true;
        if (scrollLockTimer) clearTimeout(scrollLockTimer);
        scrollLockTimer = setTimeout(() => {
          isScrollspyLocked = false;
        }, duration);
      }

      // If user manually scrolls via mousewheel or touch, unlock scrollspy immediately
      window.addEventListener('wheel', () => { isScrollspyLocked = false; }, { passive: true });
      window.addEventListener('touchmove', () => { isScrollspyLocked = false; }, { passive: true });
      if ('onscrollend' in window) {
        window.addEventListener('scrollend', () => { isScrollspyLocked = false; });
      }

      // Attach click listeners to each tab link
      links.forEach((link) => {
        link.addEventListener('click', (e) => {
          const href = link.getAttribute('href');

          // Set active link immediately on click
          setActiveLink(link);

          // If clicking an in-page section link (e.g. #features, #about, #contact)
          if (href && href.startsWith('#')) {
            const targetSection = document.querySelector(href);
            if (targetSection) {
              e.preventDefault();
              lockScrollspy(1200);

              const headerOffset = 76;
              const elemPosition = targetSection.getBoundingClientRect().top + window.scrollY;
              const offsetPosition = elemPosition - headerOffset;

              window.scrollTo({
                top: Math.max(0, offsetPosition),
                behavior: 'smooth'
              });

              if (history.pushState) {
                history.pushState(null, null, href);
              }
            }
          } else if (href === 'index.html' && (window.location.pathname.endsWith('index.html') || window.location.pathname === '/')) {
            // Clicking Home while on homepage -> smooth scroll to top
            e.preventDefault();
            lockScrollspy(1000);
            window.scrollTo({
              top: 0,
              behavior: 'smooth'
            });
            if (history.pushState) {
              history.pushState(null, null, 'index.html');
            }
          }
        });
      });

      // SCROLLSPY (Automatic Active Underline when scrolling through sections)
      // Only active on pages with section anchors like index.html
      const sectionLinks = links.filter((l) => {
        const href = l.getAttribute('href');
        return href && (href.startsWith('#') || href === 'index.html');
      });

      if (sectionLinks.length > 1) {
        const sections = [
          { id: 'home', link: sectionLinks.find((l) => l.getAttribute('href') === 'index.html' || l.getAttribute('href') === '#home') },
          { id: 'about', link: sectionLinks.find((l) => l.getAttribute('href') === '#about' || l.getAttribute('href') === '#benefits') },
          { id: 'features', link: sectionLinks.find((l) => l.getAttribute('href') === '#features' || l.getAttribute('href') === '#feature') },
          { id: 'contact', link: sectionLinks.find((l) => l.getAttribute('href') === '#contact') }
        ].filter((s) => s.link && document.getElementById(s.id));

        let isTicking = false;

        function updateScrollspy() {
          if (isScrollspyLocked) return;

          const scrollY = window.scrollY;
          const headerHeight = 90;

          // If at the top of the page, activate Home
          if (scrollY < 240) {
            const homeSec = sections.find((s) => s.id === 'home');
            if (homeSec && homeSec.link !== currentActiveLink) {
              setActiveLink(homeSec.link);
            }
            return;
          }

          // Check sections in reverse (from bottom up)
          let currentSection = null;
          for (let i = sections.length - 1; i >= 0; i--) {
            const sec = sections[i];
            const el = document.getElementById(sec.id);
            if (el) {
              const top = el.offsetTop - headerHeight;
              if (scrollY >= top - 60) {
                currentSection = sec;
                break;
              }
            }
          }

          if (currentSection && currentSection.link !== currentActiveLink) {
            setActiveLink(currentSection.link);
          }
        }

        window.addEventListener('scroll', () => {
          if (!isTicking) {
            window.requestAnimationFrame(() => {
              updateScrollspy();
              isTicking = false;
            });
            isTicking = true;
          }
        }, { passive: true });

        // Run once on load
        setTimeout(updateScrollspy, 120);
      }
    });
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVercelTabs);
  } else {
    initVercelTabs();
  }

  // Expose global initializer
  window.initVercelTabs = initVercelTabs;
})();
