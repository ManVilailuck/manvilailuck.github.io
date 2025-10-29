class DecryptedText extends HTMLElement {
  constructor() {
    super();
    this._text = this.getAttribute('text') || this.textContent || '';
    this._speed = Number(this.getAttribute('speed')) || 50;
    this._maxIterations = Number(this.getAttribute('max-iterations')) || 12;
    this._characters = this.getAttribute('characters') || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{};:,.<>?';
    this._animateOn = this.getAttribute('animate-on') || 'hover'; // hover | view | both
    this._revealDirection = this.getAttribute('reveal-direction') || 'start'; // start | end | center

    this._root = this.attachShadow({ mode: 'open' });

    this._wrapper = document.createElement('span');
    this._wrapper.setAttribute('part', 'wrapper');
    this._wrapper.className = 'decrypted-wrapper';

    this._sr = document.createElement('span');
    this._sr.className = 'sr-only';
    this._sr.textContent = this._text;

    this._display = document.createElement('span');
    this._display.setAttribute('aria-hidden', 'true');
    this._display.className = 'decrypted-display';

    this._wrapper.appendChild(this._sr);
    this._wrapper.appendChild(this._display);
    this._root.appendChild(this._wrapper);

    const style = document.createElement('style');
    style.textContent = `
      :host{display:inline-block;white-space:pre-wrap}
      .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
      .decrypted-display{letter-spacing:0.02em}
      .decrypted-display .enc{color:var(--decrypted-encrypted-color,#9aa4b2);transition:color 220ms ease}
      .decrypted-display .rev{color:var(--decrypted-revealed-color,#fff);font-weight:600}
    `;
    this._root.appendChild(style);

    this._current = this._text.split('');
    this._revealed = new Set();
    this._isAnimating = false;
    this._interval = null;
    this._iteration = 0;
  }

  connectedCallback() {
    this._renderScrambled();

    if (this._animateOn === 'hover' || this._animateOn === 'both') {
      this.addEventListener('mouseenter', this._startAnim);
      this.addEventListener('mouseleave', this._stopAnim);
    }

    if (this._animateOn === 'view' || this._animateOn === 'both') {
      this._observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !this._hasAnimated) {
            this._startAnim();
            this._hasAnimated = true;
          }
        });
      }, { threshold: 0.15 });
      this._observer.observe(this);
    }
  }

  disconnectedCallback() {
    this._stopAnim();
    if (this._observer) this._observer.disconnect();
  }

  static get observedAttributes() { return ['text']; }
  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'text') {
      this._text = newVal || '';
      this._current = this._text.split('');
      this._renderScrambled();
    }
  }

  _getNextIndex() {
    const n = this._text.length;
    switch (this._revealDirection) {
      case 'end': return n - 1 - this._revealed.size;
      case 'center': {
        const mid = Math.floor(n / 2);
        const off = Math.floor(this._revealed.size / 2);
        return this._revealed.size % 2 === 0 ? mid + off : mid - off - 1;
      }
      case 'start':
      default:
        return this._revealed.size;
    }
  }

  _renderScrambled() {
    const chars = this._characters.split('');
    const out = this._current.map((c, i) => {
      if (c === ' ') return ' ';
      if (this._revealed.has(i)) return `<span class="rev">${this._escape(this._text[i])}</span>`;
      const r = chars[Math.floor(Math.random() * chars.length)];
      return `<span class="enc">${this._escape(r)}</span>`;
    }).join('');
    this._display.innerHTML = out;
  }

  _escape(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  _startAnim = () => {
    if (this._isAnimating) return;
    this._isAnimating = true;
    this._iteration = 0;
    if (this._interval) clearInterval(this._interval);
    this._interval = setInterval(() => {
      if (this._revealed.size < this._text.length) {
        const i = this._getNextIndex();
        this._revealed.add(i);
        this._renderScrambled();
      }
      this._iteration++;
      if (this._iteration >= this._maxIterations || this._revealed.size >= this._text.length) {
        clearInterval(this._interval);
        this._interval = null;
        this._isAnimating = false;
        this._display.innerHTML = this._text.split('').map(c => c === ' ' ? ' ' : `<span class="rev">${this._escape(c)}</span>`).join('');
      }
    }, this._speed);
  }

  _stopAnim = () => {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    this._isAnimating = false;
    // reset to plain text when not animating (keeps revealed text visible)
    if (!this._hasAnimated && (this._animateOn === 'hover' || this._animateOn === 'both')) {
      this._revealed = new Set();
      this._renderScrambled();
    }
  }
}

customElements.define('decrypted-text', DecryptedText);
