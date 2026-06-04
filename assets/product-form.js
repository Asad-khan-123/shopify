/* ============================================================
   TSUKIE THEME — product-form.js
   Variant selection + AJAX add to cart
   ============================================================ */

'use strict';

class ProductForm {
  constructor(formEl) {
    this.form = formEl;
    this.variantInput = formEl.querySelector('[data-variant-id]');
    this.addBtn = formEl.querySelector('[data-add-to-cart]');
    this.productData = null;

    const scriptEl = formEl.closest('[id^="product-"]')?.querySelector('[data-product-json]');
    if (scriptEl) {
      try { this.productData = JSON.parse(scriptEl.textContent); } catch (e) { /* silent */ }
    }

    this.init();
  }

  init() {
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));

    // Color option buttons
    this.form.querySelectorAll('.colour-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const optIdx = btn.dataset.option;
        this.form.querySelectorAll(`.colour-opt[data-option="${optIdx}"]`).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const display = this.form.querySelector(`[data-selected-option="${optIdx}"]`);
        if (display) display.textContent = btn.dataset.value;
        this.syncVariant();
      });
    });

    // Size option buttons
    this.form.querySelectorAll('.size-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('oos')) return;
        const optIdx = btn.dataset.option;
        this.form.querySelectorAll(`.size-opt[data-option="${optIdx}"]`).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const display = this.form.querySelector(`[data-selected-option="${optIdx}"]`);
        if (display) display.textContent = btn.dataset.value;
        this.syncVariant();
      });
    });
  }

  getSelectedOptions() {
    const opts = {};
    // Collect active colour opts
    this.form.querySelectorAll('.colour-opt.active').forEach(btn => {
      opts[parseInt(btn.dataset.option)] = btn.dataset.value;
    });
    // Collect active size opts
    this.form.querySelectorAll('.size-opt.active').forEach(btn => {
      opts[parseInt(btn.dataset.option)] = btn.dataset.value;
    });
    return opts;
  }

  syncVariant() {
    if (!this.productData) return;
    const opts = this.getSelectedOptions();
    const keys = Object.keys(opts);
    if (keys.length === 0) return;

    const match = this.productData.variants.find(v => {
      return keys.every(i => {
        const key = `option${parseInt(i) + 1}`;
        return v[key] === opts[i];
      });
    });

    if (match) {
      if (this.variantInput) this.variantInput.value = match.id;
      this.updatePrice(match);
      this.updateAvailability(match.available);
      // Update URL
      const url = new URL(window.location.href);
      url.searchParams.set('variant', match.id);
      window.history.replaceState({}, '', url.toString());
    }
  }

  updatePrice(variant) {
    const priceContainer = document.querySelector('[data-price-container]');
    if (!priceContainer) return;

    const fmt = (cents) => {
      const amount = (cents / 100).toFixed(2);
      return window.Shopify?.currency?.active
        ? `${window.Shopify.currency.active} ${amount}`
        : `₹${amount}`;
    };

    let html = '<div class="product-price">';
    if (variant.compare_at_price > variant.price) {
      html += `<span class="price-sale">${fmt(variant.price)}</span>`;
      html += `<s class="price-original">${fmt(variant.compare_at_price)}</s>`;
      const pct = Math.round((variant.compare_at_price - variant.price) * 100 / variant.compare_at_price);
      html += `<span class="price-save">Save ${pct}%</span>`;
    } else {
      html += `<span>${fmt(variant.price)}</span>`;
    }
    html += '</div>';
    priceContainer.innerHTML = html;
  }

  updateAvailability(available) {
    if (!this.addBtn) return;
    this.addBtn.disabled = !available;
    // Labels set by Shopify translations in Liquid — we don't hardcode here
    if (!available) {
      this.addBtn.dataset.originalText = this.addBtn.dataset.originalText || this.addBtn.textContent;
      this.addBtn.textContent = this.addBtn.dataset.soldOutText || 'Sold Out';
    } else {
      this.addBtn.textContent = this.addBtn.dataset.originalText || this.addBtn.dataset.addText || 'Add to Cart';
    }
  }

  async handleSubmit(e) {
    e.preventDefault();
    if (!this.addBtn || this.addBtn.disabled) return;

    const variantId = this.variantInput?.value;
    if (!variantId) return;

    const qty = parseInt(this.form.querySelector('[name="quantity"]')?.value || 1);
    const originalText = this.addBtn.textContent;
    this.addBtn.disabled = true;
    this.addBtn.textContent = '...';

    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ id: parseInt(variantId), quantity: qty }] })
      });
      const data = await res.json();

      if (data.items) {
        this.addBtn.textContent = '✓ Added';
        // Update cart count globally
        if (typeof initCartCount === 'function') initCartCount();
        else {
          fetch('/cart.js').then(r => r.json()).then(cart => {
            document.querySelectorAll('[data-cart-count]').forEach(el => {
              el.textContent = cart.item_count;
              el.style.display = cart.item_count > 0 ? 'inline-flex' : 'none';
            });
          });
        }
        setTimeout(() => {
          this.addBtn.textContent = originalText;
          this.addBtn.disabled = false;
        }, 2000);
      } else {
        this.addBtn.textContent = data.description || 'Error';
        setTimeout(() => {
          this.addBtn.textContent = originalText;
          this.addBtn.disabled = false;
        }, 3000);
      }
    } catch (err) {
      this.addBtn.textContent = originalText;
      this.addBtn.disabled = false;
    }
  }
}

// Init all product forms on page
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-type="add-to-cart-form"]').forEach(form => {
    new ProductForm(form);
  });
});
