/* ============================================================
   TSUKIE THEME — global.js
   Vanilla JS only. No jQuery.
   ============================================================ */

'use strict';

// ===== CART COUNT INIT =====
// Fetches live count from Shopify on every page load
async function initCartCount() {
  try {
    const res = await fetch('/cart.js', {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return;
    const cartData = await res.json();
    updateCartCountUI(cartData.item_count);
  } catch (e) { /* silent fail */ }
}

function updateCartCountUI(count) {
  document.querySelectorAll('[data-cart-count]').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'inline-flex' : 'none';
  });
}

// ===== MOBILE MENU =====
function initMobileMenu() {
  const toggleBtn = document.querySelector('[data-toggle-menu]');
  const menu = document.querySelector('[data-mobile-menu]');
  if (!toggleBtn || !menu) return;

  toggleBtn.addEventListener('click', function () {
    const expanded = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', !expanded);
    menu.classList.toggle('active');
  });

  // Close on outside click
  document.addEventListener('click', function (e) {
    if (!menu.contains(e.target) && !toggleBtn.contains(e.target)) {
      menu.classList.remove('active');
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

// ===== SEARCH TOGGLE =====
function initSearchToggle() {
  document.querySelectorAll('[data-toggle-search]').forEach(btn => {
    btn.addEventListener('click', function () {
      const searchBar = document.querySelector('[data-mobile-search]');
      if (!searchBar) return;
      const isActive = searchBar.classList.toggle('active');
      if (isActive) {
        const input = searchBar.querySelector('input');
        if (input) input.focus();
      }
    });
  });
}

// ===== ACCORDIONS =====
function initAccordions() {
  document.querySelectorAll('[data-accordion-head]').forEach(head => {
    head.addEventListener('click', function () {
      const body = this.nextElementSibling;
      if (!body) return;
      const expanded = this.getAttribute('aria-expanded') === 'true';
      // Close others in same parent
      const parent = this.closest('[data-accordion-group]');
      if (parent) {
        parent.querySelectorAll('[data-accordion-head][aria-expanded="true"]').forEach(other => {
          if (other !== this) {
            other.setAttribute('aria-expanded', 'false');
            const otherBody = other.nextElementSibling;
            if (otherBody) otherBody.classList.remove('open');
          }
        });
      }
      this.setAttribute('aria-expanded', !expanded);
      body.classList.toggle('open', !expanded);
    });
  });
}

// ===== STICKY HEADER SCROLL =====
function initStickyHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  let lastScroll = 0;

  window.addEventListener('scroll', function () {
    const current = window.scrollY;
    if (current > 200 && current > lastScroll) {
      header.style.transform = 'translateY(-100%)';
    } else {
      header.style.transform = 'translateY(0)';
    }
    lastScroll = current;
  }, { passive: true });

  header.style.transition = 'transform 0.3s ease';
}

// ===== ANNOUNCEMENT BAR CLOSE =====
function initAnnouncementClose() {
  const closeBtn = document.querySelector('[data-close-announcement]');
  const bar = document.querySelector('.announcement-bar');
  if (!closeBtn || !bar) return;
  closeBtn.addEventListener('click', function () {
    bar.style.display = 'none';
    sessionStorage.setItem('announcement_closed', '1');
  });
  if (sessionStorage.getItem('announcement_closed') === '1') {
    bar.style.display = 'none';
  }
}

// ===== LAZY LOADING IMAGES (IntersectionObserver fallback) =====
function initLazyImages() {
  if ('loading' in HTMLImageElement.prototype) return; // native support
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) img.src = img.dataset.src;
        img.removeAttribute('data-src');
        observer.unobserve(img);
      }
    });
  }, { rootMargin: '200px 0px' });

  document.querySelectorAll('img[data-src]').forEach(img => observer.observe(img));
}

// ===== WISHLIST =====
function initWishlist() {
  const stored = JSON.parse(localStorage.getItem('tsukie_wishlist') || '[]');

  // Mark active
  document.querySelectorAll('[data-wishlist]').forEach(btn => {
    if (stored.includes(btn.dataset.wishlist)) {
      btn.classList.add('active');
    }
    btn.addEventListener('click', function () {
      const id = this.dataset.wishlist;
      const list = JSON.parse(localStorage.getItem('tsukie_wishlist') || '[]');
      const idx = list.indexOf(id);
      if (idx > -1) {
        list.splice(idx, 1);
        this.classList.remove('active');
      } else {
        list.push(id);
        this.classList.add('active');
      }
      localStorage.setItem('tsukie_wishlist', JSON.stringify(list));
    });
  });
}

// ===== CARD SIZE PICKER =====
// Clicking a size pill on a product card:
//   1. Marks it as selected (highlights the pill)
//   2. Updates the hidden variant <input name="id"> inside the same card's form
//   3. Finds the correct variant ID from the embedded variant map on the card
function initCardSizePicker() {
  // Use event delegation — works for dynamically rendered grids too
  document.addEventListener('click', function (e) {
    const pill = e.target.closest('.card-size');
    if (!pill || pill.classList.contains('oos')) return;

    // Stop click from following the <a> card link
    e.preventDefault();
    e.stopPropagation();

    const card = pill.closest('.product-card');
    if (!card) return;

    // Visual: deselect siblings, select this one
    card.querySelectorAll('.card-size').forEach(p => p.classList.remove('selected'));
    pill.classList.add('selected');

    // Find the variant id for this size from the embedded JSON map
    const mapEl = card.querySelector('[data-variant-map]');
    if (!mapEl) return;

    let variantMap;
    try {
      variantMap = JSON.parse(mapEl.textContent);
    } catch (err) {
      return;
    }

    const chosenSize = pill.dataset.size;
    const variantId = variantMap[chosenSize];
    if (!variantId) return;

    // Update the hidden input in the quick-add form on this card
    const input = card.querySelector('[data-card-variant-id]');
    if (input) input.value = variantId;
  });
}

// ===== CARD QUICK ADD FORM =====
// Handles .card-quick-form submit — AJAX add to cart with feedback on .card-add-btn
function initCardQuickAdd() {
  document.addEventListener('submit', async function (e) {
    const form = e.target.closest('.card-quick-form');
    if (!form) return;
    e.preventDefault();

    const btn = form.querySelector('.card-add-btn');
    const variantId = form.querySelector('[name="id"]')?.value;
    if (!btn || !variantId) return;

    const originalText = btn.textContent.trim();
    btn.textContent = '...';
    btn.disabled = true;

    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ id: parseInt(variantId, 10), quantity: 1 }] })
      });
      const data = await res.json();

      if (data.items) {
        btn.textContent = '✓ Added';
        await initCartCount();
        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 1500);
      } else {
        btn.textContent = data.description || 'Error';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 2000);
      }
    } catch (err) {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  });
}

// ===== FILTER SIDEBAR TOGGLE =====
function initFilterToggle() {
  document.querySelectorAll('[data-toggle-filters]').forEach(btn => {
    btn.addEventListener('click', function () {
      const sidebar = document.getElementById('collection-filters');
      if (!sidebar) return;
      const expanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', !expanded);
      sidebar.classList.toggle('open');
    });
  });
}

// ===== SCROLL TO TOP =====
function initScrollTop() {
  const btn = document.querySelector('[data-scroll-top]');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ===== MARQUEE DUPLICATE (for seamless loop) =====
function initMarquee() {
  document.querySelectorAll('.marquee-inner').forEach(el => {
    if (!el.dataset.duplicated) {
      el.innerHTML += el.innerHTML;
      el.dataset.duplicated = 'true';
    }
  });
}

// ===== INIT ALL =====
document.addEventListener('DOMContentLoaded', function () {
  initCartCount();
  initMobileMenu();
  initSearchToggle();
  initAccordions();
  initAnnouncementClose();
  initLazyImages();
  initWishlist();
  initCardSizePicker();
  initCardQuickAdd();
  initFilterToggle();
  initScrollTop();
  initMarquee();
});
