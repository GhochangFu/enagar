/* eslint-env browser */
(function () {
  const searchInput = document.getElementById('help-search');
  const sections = document.querySelectorAll('.help-section[data-search]');
  const tocLinks = document.querySelectorAll('.help-toc nav a[href^="#"]');
  const banner = document.getElementById('no-results');
  const hitCount = document.getElementById('search-hit-count');

  if (!searchInput || !sections.length) return;

  function normalize(s) {
    return s.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function sectionText(el) {
    return normalize(el.getAttribute('data-search') || el.textContent || '');
  }

  function filter() {
    const q = normalize(searchInput.value);
    let visible = 0;

    sections.forEach((section) => {
      const match = !q || sectionText(section).includes(q);
      section.classList.toggle('is-hidden', !match);
      if (match) visible += 1;
    });

    tocLinks.forEach((link) => {
      const id = link.getAttribute('href')?.slice(1);
      const section = id ? document.getElementById(id) : null;
      const li = link.closest('li');
      if (!li) return;
      const show = !q || (section && !section.classList.contains('is-hidden'));
      li.classList.toggle('toc-hidden', !show);
    });

    if (banner) banner.classList.toggle('visible', q.length > 0 && visible === 0);
    if (hitCount) {
      hitCount.textContent = q ? visible + ' section' + (visible === 1 ? '' : 's') + ' match' : '';
    }
  }

  searchInput.addEventListener('input', filter);
  searchInput.addEventListener('search', filter);

  const params = new URLSearchParams(window.location.search);
  const initial = params.get('q');
  if (initial) {
    searchInput.value = initial;
    filter();
  }
})();
