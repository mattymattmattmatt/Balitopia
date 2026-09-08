// A headless simulation host, NOT a browser or a rendering test. Game logic is
// real; DOM, canvas and sound are no-op ports. No network / packages required.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
function harness(saved = {}) {
  let now = 0, timerId = 0;
  const timers = new Map(), nodes = new Map(), storage = new Map(Object.entries(saved));
  const noop = () => {};
  const gradient = { addColorStop: noop };
  const context = new Proxy({ measureText: text => ({ width: String(text).length * 8 }),
    createLinearGradient: () => gradient, createRadialGradient: () => gradient,
    createPattern: () => ({}), getImageData: () => ({ data: new Uint8ClampedArray(4) }) }, {
    get: (o, key) => key in o ? o[key] : noop,
  });
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attributes = {};
      this.events = {}; this._html = ''; this.className = ''; this.textContent = ''; this.disabled = false;
      this.style = { setProperty: noop, getPropertyValue: () => '' };
      this.width = 96; this.height = 96;
      this.classList = {
        contains: c => this.className.split(' ').includes(c),
        add: (...cs) => { this.className = [...new Set([...this.className.split(' '), ...cs])].join(' '); },
        remove: (...cs) => { this.className = this.className.split(' ').filter(x => !cs.includes(x)).join(' '); },
        toggle: (c, state) => { const on = state === undefined ? !this.classList.contains(c) : state; on ? this.classList.add(c) : this.classList.remove(c); return on; },
      };
    }
    set innerHTML(value) { this._html = value; this.children = []; this.queries = {}; if (value === '<i></i>') this.appendChild(new Element('i')); }
    get innerHTML() { return this._html; }
    get firstChild() { return this.children[0]; }
    set id(value) { this._id = value; nodes.set(value, this); }
    get id() { return this._id; }
    get parentElement() { return this.parentNode; }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    insertBefore(child) { child.parentNode = this; this.children.unshift(child); }
    append(...children) { children.forEach(c => this.appendChild(c)); }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this); }
    getContext() { return context; }
    addEventListener(event, fn) { (this.events[event] ||= []).push(fn); }
    removeEventListener() {}
    setAttribute(key, value) { this.attributes[key] = value; }
    getAttribute(key) { return this.attributes[key]; }
    querySelector(selector) { this.queries ||= {}; return this.queries[selector] ||= new Element(); }
    querySelectorAll(selector) { return this.children.filter(c => !selector.startsWith('.') || c.classList.contains(selector.slice(1))); }
    getBoundingClientRect() { return { left: 0, top: 0, width: 844, height: 390 }; }
    play() { return Promise.resolve(); }
    pause() {}
    load() {}
    focus() {}
    click() { if (!this.disabled) this.dispatch('click'); }
    dispatch(event, extra = {}) { for (const fn of this.events[event] || []) fn({ preventDefault: noop, stopPropagation: noop, ...extra }); }
    setPointerCapture() {}
    releasePointerCapture() {}
  }
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const match of html.matchAll(/<([\w-]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    const el = new Element(match[1]); el.id = match[3];
    el.className = /class="([^"]*)"/.exec(match[2])?.[1] || '';
    nodes.set(match[3], el);
  }
  const document = { body: new Element('body'), documentElement: new Element('html'),
    getElementById: id => nodes.get(id) || null,
    createElement: tag => new Element(tag), addEventListener: noop, hidden: false };
  let boot;
  let rng = 123456;
  const testMath = Object.create(Math);
  testMath.random = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 4294967296; };
  const sound = new Proxy({ sfx: new Proxy({}, { get: () => noop }), ensure: noop }, { get: (o, key) => o[key] || noop });
  const sandbox = {
    console, document, navigator: { userAgent: 'Simulation test', vibrate: noop },
    location: { protocol: 'test:', search: '' }, performance: { now: () => now },
    innerWidth: 844, innerHeight: 390, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false, addEventListener: noop }),
    addEventListener: noop, requestAnimationFrame: () => 1, cancelAnimationFrame: noop,
    getComputedStyle: () => ({ getPropertyValue: () => '0' }),
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k,v) => storage.set(k,String(v)), removeItem: k => storage.delete(k) },
    setTimeout: (fn, delay = 0) => { timers.set(++timerId, { fn, at: now + delay }); return timerId; },
    clearTimeout: id => timers.delete(id), setInterval: () => 0, clearInterval: noop,
    URL, URLSearchParams, Blob, Uint8ClampedArray, Math: testMath, Sound: sound,
    Sprites: { init: () => ({ then: fn => { boot = fn; return { catch: noop }; } }),
      portrait: () => new Element('canvas'), get: () => ({ width: 96, height: 96 }),
      light: () => new Element('canvas') },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of ['js/data.js', 'js/expedition.js', 'js/game.js'])
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
  function advance(ms) {
    const end = now + ms;
    let guard = 10000;
    while (guard-- > 0) {
      const next = [...timers].filter(([,t]) => t.at <= end).sort((a,b) => a[1].at-b[1].at)[0];
      if (!next) break;
      timers.delete(next[0]); now = next[1].at; next[1].fn();
    }
    if (guard <= 0) throw new Error('Timer loop');
    now = end;
  }
  return { B: sandbox.__balitopia, nodes, sandbox, advance, boot: () => boot(),
    read: expr => vm.runInContext(expr, sandbox), storage };
}
module.exports = { harness, root };
