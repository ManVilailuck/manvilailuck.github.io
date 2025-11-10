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

  // parse text into characters and mark encrypted regions (text inside [ ])
  // display will omit the brackets and only encrypt the inner content
  this._chars = []; // array of { char: 'a', encrypted: true|false }
  this._parseTextForBrackets();
  this._revealed = new Set(); // indices into this._chars that have been revealed
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
      this._parseTextForBrackets();
      this._revealed = new Set();
      this._renderScrambled();
    }
  }

  _getNextIndex() {
    // choose next index among only encrypted characters
    const encIndices = this._encryptedIndices;
    const m = encIndices.length;
    if (m === 0) return -1;
    switch (this._revealDirection) {
      case 'end':
        return encIndices[m - 1 - this._revealed.size] ?? encIndices[m - 1];
      case 'center': {
        const mid = Math.floor(m / 2);
        const off = Math.floor(this._revealed.size / 2);
        const pick = this._revealed.size % 2 === 0 ? mid + off : mid - off - 1;
        return encIndices[Math.max(0, Math.min(m - 1, pick))];
      }
      case 'start':
      default:
        return encIndices[this._revealed.size] ?? encIndices[0];
    }
  }

  _renderScrambled() {
    const chars = this._characters.split('');
    const out = this._chars.map((item, i) => {
      const c = item.char;
      if (!item.encrypted) return this._escape(c);
      if (c === ' ') return ' ';
      if (this._revealed.has(i)) return `<span class="rev">${this._escape(c)}</span>`;
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
        // reveal next encrypted character
        const next = this._getNextIndex();
        if (next !== -1 && !this._revealed.has(next)) {
          this._revealed.add(next);
          this._renderScrambled();
        }
      this._iteration++;
      // stop when all encrypted characters are revealed or we hit iteration cap
      if (this._iteration >= this._maxIterations || this._revealed.size >= this._encryptedIndices.length) {
        clearInterval(this._interval);
        this._interval = null;
        this._isAnimating = false;
        // fully reveal encrypted characters, keep non-encrypted as-is
        this._display.innerHTML = this._chars.map(item => {
          if (!item.encrypted) return this._escape(item.char);
          return item.char === ' ' ? ' ' : `<span class="rev">${this._escape(item.char)}</span>`;
        }).join('');
      }
    }, this._speed);
  }

  _stopAnim = () => {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    this._isAnimating = false;
    // reset to plain (unrevealed) for encrypted segments when not animated (hover) and not yet viewed
    if (!this._hasAnimated && (this._animateOn === 'hover' || this._animateOn === 'both')) {
      this._revealed = new Set();
      this._renderScrambled();
    }
  }

  _parseTextForBrackets() {
    this._chars = [];
    this._encryptedIndices = [];
    const s = this._text || '';
    let inBracket = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '[') { inBracket = true; continue; }
      if (ch === ']') { inBracket = false; continue; }
      const encrypted = inBracket;
      const idx = this._chars.length;
      this._chars.push({ char: ch, encrypted });
      if (encrypted) this._encryptedIndices.push(idx);
    }
  }
}

customElements.define('decrypted-text', DecryptedText);
