const Tt = "https://github.com/lmorchard/byom-sync";
function $e(s) {
  const t = s, e = (t == null ? void 0 : t.playlist) ?? t ?? {}, i = e.track ?? e.tracks ?? [];
  return {
    title: e.title ?? "",
    creator: e.creator,
    dateCreated: e.date ?? e.date_created,
    dateUpdated: Ce(e.extension),
    annotation: e.annotation,
    image: e.image,
    tracks: i.map(Ee)
  };
}
function Ce(s) {
  var e;
  const t = (e = s == null ? void 0 : s[Tt]) == null ? void 0 : e[0];
  return typeof (t == null ? void 0 : t.date_updated) == "string" ? t.date_updated : void 0;
}
function Ee(s) {
  var t;
  return {
    title: s.title ?? "",
    artist: s.creator ?? "",
    album: s.album,
    isrc: xe(s.identifier),
    byomId: Te(s.identifier),
    image: s.image,
    durationMs: typeof s.duration == "number" ? s.duration * 1e3 : void 0,
    spotifyUrl: (t = s.location) == null ? void 0 : t[0],
    syncState: Pe(s.extension),
    resolvedIds: Ae(s.extension)
  };
}
function Ae(s) {
  var r;
  const t = (r = s == null ? void 0 : s[Tt]) == null ? void 0 : r[0], e = t == null ? void 0 : t.resolved;
  if (!e || typeof e != "object") return;
  const i = typeof e.youtube == "string" ? e.youtube : void 0;
  return i ? { youtube: i } : void 0;
}
function xe(s) {
  for (const t of s ?? []) {
    const e = /^urn:isrc:(.+)$/i.exec(t);
    if (e) return e[1];
  }
}
function Te(s) {
  for (const t of s ?? []) {
    const e = /^urn:byom:(.+)$/i.exec(t);
    if (e) return e[1];
  }
}
function Pe(s) {
  var e;
  const t = (e = s == null ? void 0 : s[Tt]) == null ? void 0 : e[0];
  if (!(!t || typeof t != "object") && "spotify_present" in t)
    return {
      spotifyPresent: !!t.spotify_present,
      dateOrphaned: t.date_orphaned || void 0
    };
}
/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const ht = globalThis, Pt = ht.ShadowRoot && (ht.ShadyCSS === void 0 || ht.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, It = Symbol(), zt = /* @__PURE__ */ new WeakMap();
let he = class {
  constructor(t, e, i) {
    if (this._$cssResult$ = !0, i !== It) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = e;
  }
  get styleSheet() {
    let t = this.o;
    const e = this.t;
    if (Pt && t === void 0) {
      const i = e !== void 0 && e.length === 1;
      i && (t = zt.get(e)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), i && zt.set(e, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const Ie = (s) => new he(typeof s == "string" ? s : s + "", void 0, It), Me = (s, ...t) => {
  const e = s.length === 1 ? s[0] : t.reduce((i, r, n) => i + ((a) => {
    if (a._$cssResult$ === !0) return a.cssText;
    if (typeof a == "number") return a;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + a + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(r) + s[n + 1], s[0]);
  return new he(e, s, It);
}, Re = (s, t) => {
  if (Pt) s.adoptedStyleSheets = t.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
  else for (const e of t) {
    const i = document.createElement("style"), r = ht.litNonce;
    r !== void 0 && i.setAttribute("nonce", r), i.textContent = e.cssText, s.appendChild(i);
  }
}, Ut = Pt ? (s) => s : (s) => s instanceof CSSStyleSheet ? ((t) => {
  let e = "";
  for (const i of t.cssRules) e += i.cssText;
  return Ie(e);
})(s) : s;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: Le, defineProperty: Oe, getOwnPropertyDescriptor: ze, getOwnPropertyNames: Ue, getOwnPropertySymbols: De, getPrototypeOf: Ne } = Object, I = globalThis, Dt = I.trustedTypes, je = Dt ? Dt.emptyScript : "", wt = I.reactiveElementPolyfillSupport, J = (s, t) => s, dt = { toAttribute(s, t) {
  switch (t) {
    case Boolean:
      s = s ? je : null;
      break;
    case Object:
    case Array:
      s = s == null ? s : JSON.stringify(s);
  }
  return s;
}, fromAttribute(s, t) {
  let e = s;
  switch (t) {
    case Boolean:
      e = s !== null;
      break;
    case Number:
      e = s === null ? null : Number(s);
      break;
    case Object:
    case Array:
      try {
        e = JSON.parse(s);
      } catch {
        e = null;
      }
  }
  return e;
} }, Mt = (s, t) => !Le(s, t), Nt = { attribute: !0, type: String, converter: dt, reflect: !1, useDefault: !1, hasChanged: Mt };
Symbol.metadata ?? (Symbol.metadata = Symbol("metadata")), I.litPropertyMetadata ?? (I.litPropertyMetadata = /* @__PURE__ */ new WeakMap());
let D = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ?? (this.l = [])).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, e = Nt) {
    if (e.state && (e.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((e = Object.create(e)).wrapped = !0), this.elementProperties.set(t, e), !e.noAccessor) {
      const i = Symbol(), r = this.getPropertyDescriptor(t, i, e);
      r !== void 0 && Oe(this.prototype, t, r);
    }
  }
  static getPropertyDescriptor(t, e, i) {
    const { get: r, set: n } = ze(this.prototype, t) ?? { get() {
      return this[e];
    }, set(a) {
      this[e] = a;
    } };
    return { get: r, set(a) {
      const l = r == null ? void 0 : r.call(this);
      n == null || n.call(this, a), this.requestUpdate(t, l, i);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? Nt;
  }
  static _$Ei() {
    if (this.hasOwnProperty(J("elementProperties"))) return;
    const t = Ne(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(J("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(J("properties"))) {
      const e = this.properties, i = [...Ue(e), ...De(e)];
      for (const r of i) this.createProperty(r, e[r]);
    }
    const t = this[Symbol.metadata];
    if (t !== null) {
      const e = litPropertyMetadata.get(t);
      if (e !== void 0) for (const [i, r] of e) this.elementProperties.set(i, r);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [e, i] of this.elementProperties) {
      const r = this._$Eu(e, i);
      r !== void 0 && this._$Eh.set(r, e);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(t) {
    const e = [];
    if (Array.isArray(t)) {
      const i = new Set(t.flat(1 / 0).reverse());
      for (const r of i) e.unshift(Ut(r));
    } else t !== void 0 && e.push(Ut(t));
    return e;
  }
  static _$Eu(t, e) {
    const i = e.attribute;
    return i === !1 ? void 0 : typeof i == "string" ? i : typeof t == "string" ? t.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    var t;
    this._$ES = new Promise((e) => this.enableUpdating = e), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), (t = this.constructor.l) == null || t.forEach((e) => e(this));
  }
  addController(t) {
    var e;
    (this._$EO ?? (this._$EO = /* @__PURE__ */ new Set())).add(t), this.renderRoot !== void 0 && this.isConnected && ((e = t.hostConnected) == null || e.call(t));
  }
  removeController(t) {
    var e;
    (e = this._$EO) == null || e.delete(t);
  }
  _$E_() {
    const t = /* @__PURE__ */ new Map(), e = this.constructor.elementProperties;
    for (const i of e.keys()) this.hasOwnProperty(i) && (t.set(i, this[i]), delete this[i]);
    t.size > 0 && (this._$Ep = t);
  }
  createRenderRoot() {
    const t = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return Re(t, this.constructor.elementStyles), t;
  }
  connectedCallback() {
    var t;
    this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this.enableUpdating(!0), (t = this._$EO) == null || t.forEach((e) => {
      var i;
      return (i = e.hostConnected) == null ? void 0 : i.call(e);
    });
  }
  enableUpdating(t) {
  }
  disconnectedCallback() {
    var t;
    (t = this._$EO) == null || t.forEach((e) => {
      var i;
      return (i = e.hostDisconnected) == null ? void 0 : i.call(e);
    });
  }
  attributeChangedCallback(t, e, i) {
    this._$AK(t, i);
  }
  _$ET(t, e) {
    var n;
    const i = this.constructor.elementProperties.get(t), r = this.constructor._$Eu(t, i);
    if (r !== void 0 && i.reflect === !0) {
      const a = (((n = i.converter) == null ? void 0 : n.toAttribute) !== void 0 ? i.converter : dt).toAttribute(e, i.type);
      this._$Em = t, a == null ? this.removeAttribute(r) : this.setAttribute(r, a), this._$Em = null;
    }
  }
  _$AK(t, e) {
    var n, a;
    const i = this.constructor, r = i._$Eh.get(t);
    if (r !== void 0 && this._$Em !== r) {
      const l = i.getPropertyOptions(r), o = typeof l.converter == "function" ? { fromAttribute: l.converter } : ((n = l.converter) == null ? void 0 : n.fromAttribute) !== void 0 ? l.converter : dt;
      this._$Em = r;
      const h = o.fromAttribute(e, l.type);
      this[r] = h ?? ((a = this._$Ej) == null ? void 0 : a.get(r)) ?? h, this._$Em = null;
    }
  }
  requestUpdate(t, e, i, r = !1, n) {
    var a;
    if (t !== void 0) {
      const l = this.constructor;
      if (r === !1 && (n = this[t]), i ?? (i = l.getPropertyOptions(t)), !((i.hasChanged ?? Mt)(n, e) || i.useDefault && i.reflect && n === ((a = this._$Ej) == null ? void 0 : a.get(t)) && !this.hasAttribute(l._$Eu(t, i)))) return;
      this.C(t, e, i);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, e, { useDefault: i, reflect: r, wrapped: n }, a) {
    i && !(this._$Ej ?? (this._$Ej = /* @__PURE__ */ new Map())).has(t) && (this._$Ej.set(t, a ?? e ?? this[t]), n !== !0 || a !== void 0) || (this._$AL.has(t) || (this.hasUpdated || i || (e = void 0), this._$AL.set(t, e)), r === !0 && this._$Em !== t && (this._$Eq ?? (this._$Eq = /* @__PURE__ */ new Set())).add(t));
  }
  async _$EP() {
    this.isUpdatePending = !0;
    try {
      await this._$ES;
    } catch (e) {
      Promise.reject(e);
    }
    const t = this.scheduleUpdate();
    return t != null && await t, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    var i;
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this._$Ep) {
        for (const [n, a] of this._$Ep) this[n] = a;
        this._$Ep = void 0;
      }
      const r = this.constructor.elementProperties;
      if (r.size > 0) for (const [n, a] of r) {
        const { wrapped: l } = a, o = this[n];
        l !== !0 || this._$AL.has(n) || o === void 0 || this.C(n, void 0, a, o);
      }
    }
    let t = !1;
    const e = this._$AL;
    try {
      t = this.shouldUpdate(e), t ? (this.willUpdate(e), (i = this._$EO) == null || i.forEach((r) => {
        var n;
        return (n = r.hostUpdate) == null ? void 0 : n.call(r);
      }), this.update(e)) : this._$EM();
    } catch (r) {
      throw t = !1, this._$EM(), r;
    }
    t && this._$AE(e);
  }
  willUpdate(t) {
  }
  _$AE(t) {
    var e;
    (e = this._$EO) == null || e.forEach((i) => {
      var r;
      return (r = i.hostUpdated) == null ? void 0 : r.call(i);
    }), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(t)), this.updated(t);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(t) {
    return !0;
  }
  update(t) {
    this._$Eq && (this._$Eq = this._$Eq.forEach((e) => this._$ET(e, this[e]))), this._$EM();
  }
  updated(t) {
  }
  firstUpdated(t) {
  }
};
D.elementStyles = [], D.shadowRootOptions = { mode: "open" }, D[J("elementProperties")] = /* @__PURE__ */ new Map(), D[J("finalized")] = /* @__PURE__ */ new Map(), wt == null || wt({ ReactiveElement: D }), (I.reactiveElementVersions ?? (I.reactiveElementVersions = [])).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Q = globalThis, jt = (s) => s, ut = Q.trustedTypes, Vt = ut ? ut.createPolicy("lit-html", { createHTML: (s) => s }) : void 0, ce = "$lit$", T = `lit$${Math.random().toFixed(9).slice(2)}$`, de = "?" + T, Ve = `<${de}>`, z = document, G = () => z.createComment(""), Z = (s) => s === null || typeof s != "object" && typeof s != "function", Rt = Array.isArray, He = (s) => Rt(s) || typeof (s == null ? void 0 : s[Symbol.iterator]) == "function", kt = `[ 	
\f\r]`, B = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, Ht = /-->/g, Ft = />/g, M = RegExp(`>|${kt}(?:([^\\s"'>=/]+)(${kt}*=${kt}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), Bt = /'/g, Kt = /"/g, ue = /^(?:script|style|textarea|title)$/i, Fe = (s) => (t, ...e) => ({ _$litType$: s, strings: t, values: e }), g = Fe(1), A = Symbol.for("lit-noChange"), y = Symbol.for("lit-nothing"), qt = /* @__PURE__ */ new WeakMap(), L = z.createTreeWalker(z, 129);
function pe(s, t) {
  if (!Rt(s) || !s.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return Vt !== void 0 ? Vt.createHTML(t) : t;
}
const Be = (s, t) => {
  const e = s.length - 1, i = [];
  let r, n = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", a = B;
  for (let l = 0; l < e; l++) {
    const o = s[l];
    let h, p, c = -1, m = 0;
    for (; m < o.length && (a.lastIndex = m, p = a.exec(o), p !== null); ) m = a.lastIndex, a === B ? p[1] === "!--" ? a = Ht : p[1] !== void 0 ? a = Ft : p[2] !== void 0 ? (ue.test(p[2]) && (r = RegExp("</" + p[2], "g")), a = M) : p[3] !== void 0 && (a = M) : a === M ? p[0] === ">" ? (a = r ?? B, c = -1) : p[1] === void 0 ? c = -2 : (c = a.lastIndex - p[2].length, h = p[1], a = p[3] === void 0 ? M : p[3] === '"' ? Kt : Bt) : a === Kt || a === Bt ? a = M : a === Ht || a === Ft ? a = B : (a = M, r = void 0);
    const u = a === M && s[l + 1].startsWith("/>") ? " " : "";
    n += a === B ? o + Ve : c >= 0 ? (i.push(h), o.slice(0, c) + ce + o.slice(c) + T + u) : o + T + (c === -2 ? l : u);
  }
  return [pe(s, n + (s[e] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), i];
};
class tt {
  constructor({ strings: t, _$litType$: e }, i) {
    let r;
    this.parts = [];
    let n = 0, a = 0;
    const l = t.length - 1, o = this.parts, [h, p] = Be(t, e);
    if (this.el = tt.createElement(h, i), L.currentNode = this.el.content, e === 2 || e === 3) {
      const c = this.el.content.firstChild;
      c.replaceWith(...c.childNodes);
    }
    for (; (r = L.nextNode()) !== null && o.length < l; ) {
      if (r.nodeType === 1) {
        if (r.hasAttributes()) for (const c of r.getAttributeNames()) if (c.endsWith(ce)) {
          const m = p[a++], u = r.getAttribute(c).split(T), b = /([.?@])?(.*)/.exec(m);
          o.push({ type: 1, index: n, name: b[2], strings: u, ctor: b[1] === "." ? qe : b[1] === "?" ? Ye : b[1] === "@" ? We : ft }), r.removeAttribute(c);
        } else c.startsWith(T) && (o.push({ type: 6, index: n }), r.removeAttribute(c));
        if (ue.test(r.tagName)) {
          const c = r.textContent.split(T), m = c.length - 1;
          if (m > 0) {
            r.textContent = ut ? ut.emptyScript : "";
            for (let u = 0; u < m; u++) r.append(c[u], G()), L.nextNode(), o.push({ type: 2, index: ++n });
            r.append(c[m], G());
          }
        }
      } else if (r.nodeType === 8) if (r.data === de) o.push({ type: 2, index: n });
      else {
        let c = -1;
        for (; (c = r.data.indexOf(T, c + 1)) !== -1; ) o.push({ type: 7, index: n }), c += T.length - 1;
      }
      n++;
    }
  }
  static createElement(t, e) {
    const i = z.createElement("template");
    return i.innerHTML = t, i;
  }
}
function j(s, t, e = s, i) {
  var a, l;
  if (t === A) return t;
  let r = i !== void 0 ? (a = e._$Co) == null ? void 0 : a[i] : e._$Cl;
  const n = Z(t) ? void 0 : t._$litDirective$;
  return (r == null ? void 0 : r.constructor) !== n && ((l = r == null ? void 0 : r._$AO) == null || l.call(r, !1), n === void 0 ? r = void 0 : (r = new n(s), r._$AT(s, e, i)), i !== void 0 ? (e._$Co ?? (e._$Co = []))[i] = r : e._$Cl = r), r !== void 0 && (t = j(s, r._$AS(s, t.values), r, i)), t;
}
class Ke {
  constructor(t, e) {
    this._$AV = [], this._$AN = void 0, this._$AD = t, this._$AM = e;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t) {
    const { el: { content: e }, parts: i } = this._$AD, r = ((t == null ? void 0 : t.creationScope) ?? z).importNode(e, !0);
    L.currentNode = r;
    let n = L.nextNode(), a = 0, l = 0, o = i[0];
    for (; o !== void 0; ) {
      if (a === o.index) {
        let h;
        o.type === 2 ? h = new V(n, n.nextSibling, this, t) : o.type === 1 ? h = new o.ctor(n, o.name, o.strings, this, t) : o.type === 6 && (h = new Je(n, this, t)), this._$AV.push(h), o = i[++l];
      }
      a !== (o == null ? void 0 : o.index) && (n = L.nextNode(), a++);
    }
    return L.currentNode = z, r;
  }
  p(t) {
    let e = 0;
    for (const i of this._$AV) i !== void 0 && (i.strings !== void 0 ? (i._$AI(t, i, e), e += i.strings.length - 2) : i._$AI(t[e])), e++;
  }
}
class V {
  get _$AU() {
    var t;
    return ((t = this._$AM) == null ? void 0 : t._$AU) ?? this._$Cv;
  }
  constructor(t, e, i, r) {
    this.type = 2, this._$AH = y, this._$AN = void 0, this._$AA = t, this._$AB = e, this._$AM = i, this.options = r, this._$Cv = (r == null ? void 0 : r.isConnected) ?? !0;
  }
  get parentNode() {
    let t = this._$AA.parentNode;
    const e = this._$AM;
    return e !== void 0 && (t == null ? void 0 : t.nodeType) === 11 && (t = e.parentNode), t;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t, e = this) {
    t = j(this, t, e), Z(t) ? t === y || t == null || t === "" ? (this._$AH !== y && this._$AR(), this._$AH = y) : t !== this._$AH && t !== A && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : He(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== y && Z(this._$AH) ? this._$AA.nextSibling.data = t : this.T(z.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    var n;
    const { values: e, _$litType$: i } = t, r = typeof i == "number" ? this._$AC(t) : (i.el === void 0 && (i.el = tt.createElement(pe(i.h, i.h[0]), this.options)), i);
    if (((n = this._$AH) == null ? void 0 : n._$AD) === r) this._$AH.p(e);
    else {
      const a = new Ke(r, this), l = a.u(this.options);
      a.p(e), this.T(l), this._$AH = a;
    }
  }
  _$AC(t) {
    let e = qt.get(t.strings);
    return e === void 0 && qt.set(t.strings, e = new tt(t)), e;
  }
  k(t) {
    Rt(this._$AH) || (this._$AH = [], this._$AR());
    const e = this._$AH;
    let i, r = 0;
    for (const n of t) r === e.length ? e.push(i = new V(this.O(G()), this.O(G()), this, this.options)) : i = e[r], i._$AI(n), r++;
    r < e.length && (this._$AR(i && i._$AB.nextSibling, r), e.length = r);
  }
  _$AR(t = this._$AA.nextSibling, e) {
    var i;
    for ((i = this._$AP) == null ? void 0 : i.call(this, !1, !0, e); t !== this._$AB; ) {
      const r = jt(t).nextSibling;
      jt(t).remove(), t = r;
    }
  }
  setConnected(t) {
    var e;
    this._$AM === void 0 && (this._$Cv = t, (e = this._$AP) == null || e.call(this, t));
  }
}
class ft {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, e, i, r, n) {
    this.type = 1, this._$AH = y, this._$AN = void 0, this.element = t, this.name = e, this._$AM = r, this.options = n, i.length > 2 || i[0] !== "" || i[1] !== "" ? (this._$AH = Array(i.length - 1).fill(new String()), this.strings = i) : this._$AH = y;
  }
  _$AI(t, e = this, i, r) {
    const n = this.strings;
    let a = !1;
    if (n === void 0) t = j(this, t, e, 0), a = !Z(t) || t !== this._$AH && t !== A, a && (this._$AH = t);
    else {
      const l = t;
      let o, h;
      for (t = n[0], o = 0; o < n.length - 1; o++) h = j(this, l[i + o], e, o), h === A && (h = this._$AH[o]), a || (a = !Z(h) || h !== this._$AH[o]), h === y ? t = y : t !== y && (t += (h ?? "") + n[o + 1]), this._$AH[o] = h;
    }
    a && !r && this.j(t);
  }
  j(t) {
    t === y ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class qe extends ft {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === y ? void 0 : t;
  }
}
class Ye extends ft {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== y);
  }
}
class We extends ft {
  constructor(t, e, i, r, n) {
    super(t, e, i, r, n), this.type = 5;
  }
  _$AI(t, e = this) {
    if ((t = j(this, t, e, 0) ?? y) === A) return;
    const i = this._$AH, r = t === y && i !== y || t.capture !== i.capture || t.once !== i.once || t.passive !== i.passive, n = t !== y && (i === y || r);
    r && this.element.removeEventListener(this.name, this, i), n && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    var e;
    typeof this._$AH == "function" ? this._$AH.call(((e = this.options) == null ? void 0 : e.host) ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class Je {
  constructor(t, e, i) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = e, this.options = i;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    j(this, t);
  }
}
const Qe = { I: V }, St = Q.litHtmlPolyfillSupport;
St == null || St(tt, V), (Q.litHtmlVersions ?? (Q.litHtmlVersions = [])).push("3.3.3");
const Xe = (s, t, e) => {
  const i = (e == null ? void 0 : e.renderBefore) ?? t;
  let r = i._$litPart$;
  if (r === void 0) {
    const n = (e == null ? void 0 : e.renderBefore) ?? null;
    i._$litPart$ = r = new V(t.insertBefore(G(), n), n, void 0, e ?? {});
  }
  return r._$AI(s), r;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const O = globalThis;
let N = class extends D {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    var e;
    const t = super.createRenderRoot();
    return (e = this.renderOptions).renderBefore ?? (e.renderBefore = t.firstChild), t;
  }
  update(t) {
    const e = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = Xe(e, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    var t;
    super.connectedCallback(), (t = this._$Do) == null || t.setConnected(!0);
  }
  disconnectedCallback() {
    var t;
    super.disconnectedCallback(), (t = this._$Do) == null || t.setConnected(!1);
  }
  render() {
    return A;
  }
};
var le;
N._$litElement$ = !0, N.finalized = !0, (le = O.litElementHydrateSupport) == null || le.call(O, { LitElement: N });
const $t = O.litElementPolyfillSupport;
$t == null || $t({ LitElement: N });
(O.litElementVersions ?? (O.litElementVersions = [])).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Ge = (s) => (t, e) => {
  e !== void 0 ? e.addInitializer(() => {
    customElements.define(s, t);
  }) : customElements.define(s, t);
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Ze = { attribute: !0, type: String, converter: dt, reflect: !1, hasChanged: Mt }, ti = (s = Ze, t, e) => {
  const { kind: i, metadata: r } = e;
  let n = globalThis.litPropertyMetadata.get(r);
  if (n === void 0 && globalThis.litPropertyMetadata.set(r, n = /* @__PURE__ */ new Map()), i === "setter" && ((s = Object.create(s)).wrapped = !0), n.set(e.name, s), i === "accessor") {
    const { name: a } = e;
    return { set(l) {
      const o = t.get.call(this);
      t.set.call(this, l), this.requestUpdate(a, o, s, !0, l);
    }, init(l) {
      return l !== void 0 && this.C(a, void 0, s, l), l;
    } };
  }
  if (i === "setter") {
    const { name: a } = e;
    return function(l) {
      const o = this[a];
      t.call(this, l), this.requestUpdate(a, o, s, !0, l);
    };
  }
  throw Error("Unsupported decorator location: " + i);
};
function v(s) {
  return (t, e) => typeof e == "object" ? ti(s, t, e) : ((i, r, n) => {
    const a = r.hasOwnProperty(n);
    return r.constructor.createProperty(n, i), a ? Object.getOwnPropertyDescriptor(r, n) : void 0;
  })(s, t, e);
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function _(s) {
  return v({ ...s, state: !0, attribute: !1 });
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const mt = { CHILD: 2 }, Lt = (s) => (...t) => ({ _$litDirective$: s, values: t });
let Ot = class {
  constructor(t) {
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AT(t, e, i) {
    this._$Ct = t, this._$AM = e, this._$Ci = i;
  }
  _$AS(t, e) {
    return this.update(t, e);
  }
  update(t, e) {
    return this.render(...e);
  }
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
class At extends Ot {
  constructor(t) {
    if (super(t), this.it = y, t.type !== mt.CHILD) throw Error(this.constructor.directiveName + "() can only be used in child bindings");
  }
  render(t) {
    if (t === y || t == null) return this._t = void 0, this.it = t;
    if (t === A) return t;
    if (typeof t != "string") throw Error(this.constructor.directiveName + "() called with a non-string value");
    if (t === this.it) return this._t;
    this.it = t;
    const e = [t];
    return e.raw = e, this._t = { _$litType$: this.constructor.resultType, strings: e, values: [] };
  }
}
At.directiveName = "unsafeHTML", At.resultType = 1;
const ei = Lt(At);
function et(s, t, e, i) {
  var r = arguments.length, n = r < 3 ? t : i === null ? i = Object.getOwnPropertyDescriptor(t, e) : i, a;
  if (typeof Reflect == "object" && typeof Reflect.decorate == "function") n = Reflect.decorate(s, t, e, i);
  else for (var l = s.length - 1; l >= 0; l--) (a = s[l]) && (n = (r < 3 ? a(n) : r > 3 ? a(t, e, n) : a(t, e)) || n);
  return r > 3 && n && Object.defineProperty(t, e, n), n;
}
/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { I: ii } = Qe, Yt = (s) => s, si = (s) => s.strings === void 0, Wt = () => document.createComment(""), K = (s, t, e) => {
  var n;
  const i = s._$AA.parentNode, r = t === void 0 ? s._$AB : t._$AA;
  if (e === void 0) {
    const a = i.insertBefore(Wt(), r), l = i.insertBefore(Wt(), r);
    e = new ii(a, l, s, s.options);
  } else {
    const a = e._$AB.nextSibling, l = e._$AM, o = l !== s;
    if (o) {
      let h;
      (n = e._$AQ) == null || n.call(e, s), e._$AM = s, e._$AP !== void 0 && (h = s._$AU) !== l._$AU && e._$AP(h);
    }
    if (a !== r || o) {
      let h = e._$AA;
      for (; h !== a; ) {
        const p = Yt(h).nextSibling;
        Yt(i).insertBefore(h, r), h = p;
      }
    }
  }
  return e;
}, R = (s, t, e = s) => (s._$AI(t, e), s), ri = {}, ni = (s, t = ri) => s._$AH = t, ai = (s) => s._$AH, Ct = (s) => {
  s._$AR(), s._$AA.remove();
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const X = (s, t) => {
  var i;
  const e = s._$AN;
  if (e === void 0) return !1;
  for (const r of e) (i = r._$AO) == null || i.call(r, t, !1), X(r, t);
  return !0;
}, pt = (s) => {
  let t, e;
  do {
    if ((t = s._$AM) === void 0) break;
    e = t._$AN, e.delete(s), s = t;
  } while ((e == null ? void 0 : e.size) === 0);
}, fe = (s) => {
  for (let t; t = s._$AM; s = t) {
    let e = t._$AN;
    if (e === void 0) t._$AN = e = /* @__PURE__ */ new Set();
    else if (e.has(s)) break;
    e.add(s), hi(t);
  }
};
function oi(s) {
  this._$AN !== void 0 ? (pt(this), this._$AM = s, fe(this)) : this._$AM = s;
}
function li(s, t = !1, e = 0) {
  const i = this._$AH, r = this._$AN;
  if (r !== void 0 && r.size !== 0) if (t) if (Array.isArray(i)) for (let n = e; n < i.length; n++) X(i[n], !1), pt(i[n]);
  else i != null && (X(i, !1), pt(i));
  else X(this, s);
}
const hi = (s) => {
  s.type == mt.CHILD && (s._$AP ?? (s._$AP = li), s._$AQ ?? (s._$AQ = oi));
};
class ci extends Ot {
  constructor() {
    super(...arguments), this._$AN = void 0;
  }
  _$AT(t, e, i) {
    super._$AT(t, e, i), fe(this), this.isConnected = t._$AU;
  }
  _$AO(t, e = !0) {
    var i, r;
    t !== this.isConnected && (this.isConnected = t, t ? (i = this.reconnected) == null || i.call(this) : (r = this.disconnected) == null || r.call(this)), e && (X(this, t), pt(this));
  }
  setValue(t) {
    if (si(this._$Ct)) this._$Ct._$AI(t, this);
    else {
      const e = [...this._$Ct._$AH];
      e[this._$Ci] = t, this._$Ct._$AI(e, this, 0);
    }
  }
  disconnected() {
  }
  reconnected() {
  }
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Jt = (s, t, e) => {
  const i = /* @__PURE__ */ new Map();
  for (let r = t; r <= e; r++) i.set(s[r], r);
  return i;
}, di = Lt(class extends Ot {
  constructor(s) {
    if (super(s), s.type !== mt.CHILD) throw Error("repeat() can only be used in text expressions");
  }
  dt(s, t, e) {
    let i;
    e === void 0 ? e = t : t !== void 0 && (i = t);
    const r = [], n = [];
    let a = 0;
    for (const l of s) r[a] = i ? i(l, a) : a, n[a] = e(l, a), a++;
    return { values: n, keys: r };
  }
  render(s, t, e) {
    return this.dt(s, t, e).values;
  }
  update(s, [t, e, i]) {
    const r = ai(s), { values: n, keys: a } = this.dt(t, e, i);
    if (!Array.isArray(r)) return this.ut = a, n;
    const l = this.ut ?? (this.ut = []), o = [];
    let h, p, c = 0, m = r.length - 1, u = 0, b = n.length - 1;
    for (; c <= m && u <= b; ) if (r[c] === null) c++;
    else if (r[m] === null) m--;
    else if (l[c] === a[u]) o[u] = R(r[c], n[u]), c++, u++;
    else if (l[m] === a[b]) o[b] = R(r[m], n[b]), m--, b--;
    else if (l[c] === a[b]) o[b] = R(r[c], n[b]), K(s, o[b + 1], r[c]), c++, b--;
    else if (l[m] === a[u]) o[u] = R(r[m], n[u]), K(s, r[c], r[m]), m--, u++;
    else if (h === void 0 && (h = Jt(a, u, b), p = Jt(l, c, m)), h.has(l[c])) if (h.has(l[m])) {
      const E = p.get(a[u]), F = E !== void 0 ? r[E] : null;
      if (F === null) {
        const it = K(s, r[c]);
        R(it, n[u]), o[u] = it;
      } else o[u] = R(F, n[u]), K(s, r[c], F), r[E] = null;
      u++;
    } else Ct(r[m]), m--;
    else Ct(r[c]), c++;
    for (; u <= b; ) {
      const E = K(s, o[b + 1]);
      R(E, n[u]), o[u++] = E;
    }
    for (; c <= m; ) {
      const E = r[c++];
      E !== null && Ct(E);
    }
    return this.ut = a, ni(s, o), A;
  }
});
/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
class yt extends Event {
  constructor(t) {
    super(yt.eventName, { bubbles: !1 }), this.first = t.first, this.last = t.last;
  }
}
yt.eventName = "rangeChanged";
class gt extends Event {
  constructor(t) {
    super(gt.eventName, { bubbles: !1 }), this.first = t.first, this.last = t.last;
  }
}
gt.eventName = "visibilityChanged";
class bt extends Event {
  constructor() {
    super(bt.eventName, { bubbles: !1 });
  }
}
bt.eventName = "unpinned";
/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
class ui {
  constructor(t) {
    this._element = null;
    const e = t ?? window;
    this._node = e, t && (this._element = t);
  }
  get element() {
    return this._element || document.scrollingElement || document.documentElement;
  }
  get scrollTop() {
    return this.element.scrollTop || window.scrollY;
  }
  get scrollLeft() {
    return this.element.scrollLeft || window.scrollX;
  }
  get scrollHeight() {
    return this.element.scrollHeight;
  }
  get scrollWidth() {
    return this.element.scrollWidth;
  }
  get viewportHeight() {
    return this._element ? this._element.getBoundingClientRect().height : window.innerHeight;
  }
  get viewportWidth() {
    return this._element ? this._element.getBoundingClientRect().width : window.innerWidth;
  }
  get maxScrollTop() {
    return this.scrollHeight - this.viewportHeight;
  }
  get maxScrollLeft() {
    return this.scrollWidth - this.viewportWidth;
  }
}
class pi extends ui {
  constructor(t, e) {
    super(e), this._clients = /* @__PURE__ */ new Set(), this._retarget = null, this._end = null, this.__destination = null, this.correctingScrollError = !1, this._checkForArrival = this._checkForArrival.bind(this), this._updateManagedScrollTo = this._updateManagedScrollTo.bind(this), this.scrollTo = this.scrollTo.bind(this), this.scrollBy = this.scrollBy.bind(this);
    const i = this._node;
    this._originalScrollTo = i.scrollTo, this._originalScrollBy = i.scrollBy, this._originalScroll = i.scroll, this._attach(t);
  }
  get _destination() {
    return this.__destination;
  }
  get scrolling() {
    return this._destination !== null;
  }
  scrollTo(t, e) {
    const i = typeof t == "number" && typeof e == "number" ? { left: t, top: e } : t;
    this._scrollTo(i);
  }
  scrollBy(t, e) {
    const i = typeof t == "number" && typeof e == "number" ? { left: t, top: e } : t;
    i.top !== void 0 && (i.top += this.scrollTop), i.left !== void 0 && (i.left += this.scrollLeft), this._scrollTo(i);
  }
  _nativeScrollTo(t) {
    this._originalScrollTo.bind(this._element || window)(t);
  }
  _scrollTo(t, e = null, i = null) {
    this._end !== null && this._end(), t.behavior === "smooth" ? (this._setDestination(t), this._retarget = e, this._end = i) : this._resetScrollState(), this._nativeScrollTo(t);
  }
  _setDestination(t) {
    let { top: e, left: i } = t;
    return e = e === void 0 ? void 0 : Math.max(0, Math.min(e, this.maxScrollTop)), i = i === void 0 ? void 0 : Math.max(0, Math.min(i, this.maxScrollLeft)), this._destination !== null && i === this._destination.left && e === this._destination.top ? !1 : (this.__destination = { top: e, left: i, behavior: "smooth" }, !0);
  }
  _resetScrollState() {
    this.__destination = null, this._retarget = null, this._end = null;
  }
  _updateManagedScrollTo(t) {
    this._destination && this._setDestination(t) && this._nativeScrollTo(this._destination);
  }
  managedScrollTo(t, e, i) {
    return this._scrollTo(t, e, i), this._updateManagedScrollTo;
  }
  correctScrollError(t) {
    this.correctingScrollError = !0, requestAnimationFrame(() => requestAnimationFrame(() => this.correctingScrollError = !1)), this._nativeScrollTo(t), this._retarget && this._setDestination(this._retarget()), this._destination && this._nativeScrollTo(this._destination);
  }
  _checkForArrival() {
    if (this._destination !== null) {
      const { scrollTop: t, scrollLeft: e } = this;
      let { top: i, left: r } = this._destination;
      i = Math.min(i || 0, this.maxScrollTop), r = Math.min(r || 0, this.maxScrollLeft);
      const n = Math.abs(i - t), a = Math.abs(r - e);
      n < 1 && a < 1 && (this._end && this._end(), this._resetScrollState());
    }
  }
  detach(t) {
    return this._clients.delete(t), this._clients.size === 0 && (this._node.scrollTo = this._originalScrollTo, this._node.scrollBy = this._originalScrollBy, this._node.scroll = this._originalScroll, this._node.removeEventListener("scroll", this._checkForArrival)), null;
  }
  _attach(t) {
    this._clients.add(t), this._clients.size === 1 && (this._node.scrollTo = this.scrollTo, this._node.scrollBy = this.scrollBy, this._node.scroll = this.scrollTo, this._node.addEventListener("scroll", this._checkForArrival));
  }
}
/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
let Qt = typeof window < "u" ? window.ResizeObserver : void 0;
const xt = Symbol("virtualizerRef"), st = "virtualizer-sizer";
let Xt;
class fi {
  constructor(t) {
    if (this._benchmarkStart = null, this._layout = null, this._clippingAncestors = [], this._scrollSize = null, this._scrollError = null, this._childrenPos = null, this._childMeasurements = null, this._toBeMeasured = /* @__PURE__ */ new Map(), this._rangeChanged = !0, this._itemsChanged = !0, this._visibilityChanged = !0, this._scrollerController = null, this._isScroller = !1, this._sizer = null, this._hostElementRO = null, this._childrenRO = null, this._mutationObserver = null, this._scrollEventListeners = [], this._scrollEventListenerOptions = {
      passive: !0
    }, this._loadListener = this._childLoaded.bind(this), this._scrollIntoViewTarget = null, this._updateScrollIntoViewCoordinates = null, this._items = [], this._first = -1, this._last = -1, this._firstVisible = -1, this._lastVisible = -1, this._scheduled = /* @__PURE__ */ new WeakSet(), this._measureCallback = null, this._measureChildOverride = null, this._layoutCompletePromise = null, this._layoutCompleteResolver = null, this._layoutCompleteRejecter = null, this._pendingLayoutComplete = null, this._layoutInitialized = null, this._connected = !1, !t)
      throw new Error("Virtualizer constructor requires a configuration object");
    if (t.hostElement)
      this._init(t);
    else
      throw new Error('Virtualizer configuration requires the "hostElement" property');
  }
  set items(t) {
    Array.isArray(t) && t !== this._items && (this._itemsChanged = !0, this._items = t, this._schedule(this._updateLayout));
  }
  _init(t) {
    this._isScroller = !!t.scroller, this._initHostElement(t);
    const e = t.layout || {};
    this._layoutInitialized = this._initLayout(e);
  }
  _initObservers() {
    this._mutationObserver = new MutationObserver(this._finishDOMUpdate.bind(this)), this._hostElementRO = new Qt(() => this._hostElementSizeChanged()), this._childrenRO = new Qt(this._childrenSizeChanged.bind(this));
  }
  _initHostElement(t) {
    const e = this._hostElement = t.hostElement;
    this._applyVirtualizerStyles(), e[xt] = this;
  }
  connected() {
    this._initObservers();
    const t = this._isScroller;
    this._clippingAncestors = gi(this._hostElement, t), this._scrollerController = new pi(this, this._clippingAncestors[0]), this._schedule(this._updateLayout), this._observeAndListen(), this._connected = !0;
  }
  _observeAndListen() {
    this._mutationObserver.observe(this._hostElement, { childList: !0 }), this._hostElementRO.observe(this._hostElement), this._scrollEventListeners.push(window), window.addEventListener("scroll", this, this._scrollEventListenerOptions), this._clippingAncestors.forEach((t) => {
      t.addEventListener("scroll", this, this._scrollEventListenerOptions), this._scrollEventListeners.push(t), this._hostElementRO.observe(t);
    }), this._hostElementRO.observe(this._scrollerController.element), this._children.forEach((t) => this._childrenRO.observe(t)), this._scrollEventListeners.forEach((t) => t.addEventListener("scroll", this, this._scrollEventListenerOptions));
  }
  disconnected() {
    var t, e, i, r;
    this._scrollEventListeners.forEach((n) => n.removeEventListener("scroll", this, this._scrollEventListenerOptions)), this._scrollEventListeners = [], this._clippingAncestors = [], (t = this._scrollerController) == null || t.detach(this), this._scrollerController = null, (e = this._mutationObserver) == null || e.disconnect(), this._mutationObserver = null, (i = this._hostElementRO) == null || i.disconnect(), this._hostElementRO = null, (r = this._childrenRO) == null || r.disconnect(), this._childrenRO = null, this._rejectLayoutCompletePromise("disconnected"), this._connected = !1;
  }
  _applyVirtualizerStyles() {
    const e = this._hostElement.style;
    e.display = e.display || "block", e.position = e.position || "relative", e.contain = e.contain || "size layout", this._isScroller && (e.overflow = e.overflow || "auto", e.minHeight = e.minHeight || "150px");
  }
  _getSizer() {
    const t = this._hostElement;
    if (!this._sizer) {
      let e = t.querySelector(`[${st}]`);
      e || (e = document.createElement("div"), e.setAttribute(st, ""), t.appendChild(e)), Object.assign(e.style, {
        position: "absolute",
        margin: "-2px 0 0 0",
        padding: 0,
        visibility: "hidden",
        fontSize: "2px"
      }), e.textContent = "&nbsp;", e.setAttribute(st, ""), this._sizer = e;
    }
    return this._sizer;
  }
  async updateLayoutConfig(t) {
    await this._layoutInitialized;
    const e = t.type || // The new config is compatible with the current layout,
    // so we update the config and return true to indicate
    // a successful update
    Xt;
    if (typeof e == "function" && this._layout instanceof e) {
      const i = { ...t };
      return delete i.type, this._layout.config = i, !0;
    }
    return !1;
  }
  async _initLayout(t) {
    let e, i;
    if (typeof t.type == "function") {
      i = t.type;
      const r = { ...t };
      delete r.type, e = r;
    } else
      e = t;
    i === void 0 && (Xt = i = (await import("./flow-D-0MTYCm.js")).FlowLayout), this._layout = new i((r) => this._handleLayoutMessage(r), e), this._layout.measureChildren && typeof this._layout.updateItemSizes == "function" && (typeof this._layout.measureChildren == "function" && (this._measureChildOverride = this._layout.measureChildren), this._measureCallback = this._layout.updateItemSizes.bind(this._layout)), this._layout.listenForChildLoadEvents && this._hostElement.addEventListener("load", this._loadListener, !0), this._schedule(this._updateLayout);
  }
  // TODO (graynorton): Rework benchmarking so that it has no API and
  // instead is always on except in production builds
  startBenchmarking() {
    this._benchmarkStart === null && (this._benchmarkStart = window.performance.now());
  }
  stopBenchmarking() {
    if (this._benchmarkStart !== null) {
      const t = window.performance.now(), e = t - this._benchmarkStart, r = performance.getEntriesByName("uv-virtualizing", "measure").filter((n) => n.startTime >= this._benchmarkStart && n.startTime < t).reduce((n, a) => n + a.duration, 0);
      return this._benchmarkStart = null, { timeElapsed: e, virtualizationTime: r };
    }
    return null;
  }
  _measureChildren() {
    const t = {}, e = this._children, i = this._measureChildOverride || this._measureChild;
    for (let r = 0; r < e.length; r++) {
      const n = e[r], a = this._first + r;
      (this._itemsChanged || this._toBeMeasured.has(n)) && (t[a] = i.call(this, n, this._items[a]));
    }
    this._childMeasurements = t, this._schedule(this._updateLayout), this._toBeMeasured.clear();
  }
  /**
   * Returns the width, height, and margins of the given child.
   */
  _measureChild(t) {
    const { width: e, height: i } = t.getBoundingClientRect();
    return Object.assign({ width: e, height: i }, mi(t));
  }
  async _schedule(t) {
    this._scheduled.has(t) || (this._scheduled.add(t), await Promise.resolve(), this._scheduled.delete(t), t.call(this));
  }
  async _updateDOM(t) {
    this._scrollSize = t.scrollSize, this._adjustRange(t.range), this._childrenPos = t.childPositions, this._scrollError = t.scrollError || null;
    const { _rangeChanged: e, _itemsChanged: i } = this;
    this._visibilityChanged && (this._notifyVisibility(), this._visibilityChanged = !1), (e || i) && (this._notifyRange(), this._rangeChanged = !1), this._finishDOMUpdate();
  }
  _finishDOMUpdate() {
    this._connected && (this._children.forEach((t) => this._childrenRO.observe(t)), this._checkScrollIntoViewTarget(this._childrenPos), this._positionChildren(this._childrenPos), this._sizeHostElement(this._scrollSize), this._correctScrollError(), this._benchmarkStart && "mark" in window.performance && window.performance.mark("uv-end"));
  }
  _updateLayout() {
    this._layout && this._connected && (this._layout.items = this._items, this._updateView(), this._childMeasurements !== null && (this._measureCallback && this._measureCallback(this._childMeasurements), this._childMeasurements = null), this._layout.reflowIfNeeded(), this._benchmarkStart && "mark" in window.performance && window.performance.mark("uv-end"));
  }
  _handleScrollEvent() {
    var t;
    if (this._benchmarkStart && "mark" in window.performance) {
      try {
        window.performance.measure("uv-virtualizing", "uv-start", "uv-end");
      } catch (e) {
        console.warn("Error measuring performance data: ", e);
      }
      window.performance.mark("uv-start");
    }
    this._scrollerController.correctingScrollError === !1 && ((t = this._layout) == null || t.unpin()), this._schedule(this._updateLayout);
  }
  handleEvent(t) {
    switch (t.type) {
      case "scroll":
        (t.currentTarget === window || this._clippingAncestors.includes(t.currentTarget)) && this._handleScrollEvent();
        break;
      default:
        console.warn("event not handled", t);
    }
  }
  _handleLayoutMessage(t) {
    t.type === "stateChanged" ? this._updateDOM(t) : t.type === "visibilityChanged" ? (this._firstVisible = t.firstVisible, this._lastVisible = t.lastVisible, this._notifyVisibility()) : t.type === "unpinned" && this._hostElement.dispatchEvent(new bt());
  }
  get _children() {
    const t = [];
    let e = this._hostElement.firstElementChild;
    for (; e; )
      e.hasAttribute(st) || t.push(e), e = e.nextElementSibling;
    return t;
  }
  _updateView() {
    var r;
    const t = this._hostElement, e = (r = this._scrollerController) == null ? void 0 : r.element, i = this._layout;
    if (t && e && i) {
      let n, a, l, o;
      const h = t.getBoundingClientRect();
      n = 0, a = 0, l = window.innerHeight, o = window.innerWidth;
      const p = this._clippingAncestors.map((U) => U.getBoundingClientRect());
      p.unshift(h);
      for (const U of p)
        n = Math.max(n, U.top), a = Math.max(a, U.left), l = Math.min(l, U.bottom), o = Math.min(o, U.right);
      const c = e.getBoundingClientRect(), m = {
        left: h.left - c.left,
        top: h.top - c.top
      }, u = {
        width: e.scrollWidth,
        height: e.scrollHeight
      }, b = n - h.top + t.scrollTop, E = a - h.left + t.scrollLeft, F = Math.max(0, l - n), it = Math.max(0, o - a);
      i.viewportSize = { width: it, height: F }, i.viewportScroll = { top: b, left: E }, i.totalScrollSize = u, i.offsetWithinScroller = m;
    }
  }
  /**
   * Styles the host element so that its size reflects the
   * total size of all items.
   */
  _sizeHostElement(t) {
    const i = t && t.width !== null ? Math.min(82e5, t.width) : 0, r = t && t.height !== null ? Math.min(82e5, t.height) : 0;
    if (this._isScroller)
      this._getSizer().style.transform = `translate(${i}px, ${r}px)`;
    else {
      const n = this._hostElement.style;
      n.minWidth = i ? `${i}px` : "100%", n.minHeight = r ? `${r}px` : "100%";
    }
  }
  /**
   * Sets the top and left transform style of the children from the values in
   * pos.
   */
  _positionChildren(t) {
    t && t.forEach(({ top: e, left: i, width: r, height: n, xOffset: a, yOffset: l }, o) => {
      const h = this._children[o - this._first];
      h && (h.style.position = "absolute", h.style.boxSizing = "border-box", h.style.transform = `translate(${i}px, ${e}px)`, r !== void 0 && (h.style.width = r + "px"), n !== void 0 && (h.style.height = n + "px"), h.style.left = a === void 0 ? null : a + "px", h.style.top = l === void 0 ? null : l + "px");
    });
  }
  async _adjustRange(t) {
    const { _first: e, _last: i, _firstVisible: r, _lastVisible: n } = this;
    this._first = t.first, this._last = t.last, this._firstVisible = t.firstVisible, this._lastVisible = t.lastVisible, this._rangeChanged = this._rangeChanged || this._first !== e || this._last !== i, this._visibilityChanged = this._visibilityChanged || this._firstVisible !== r || this._lastVisible !== n;
  }
  _correctScrollError() {
    if (this._scrollError) {
      const { scrollTop: t, scrollLeft: e } = this._scrollerController, { top: i, left: r } = this._scrollError;
      this._scrollError = null, this._scrollerController.correctScrollError({
        top: t - i,
        left: e - r
      });
    }
  }
  element(t) {
    var e;
    return t === 1 / 0 && (t = this._items.length - 1), ((e = this._items) == null ? void 0 : e[t]) === void 0 ? void 0 : {
      scrollIntoView: (i = {}) => this._scrollElementIntoView({ ...i, index: t })
    };
  }
  _scrollElementIntoView(t) {
    if (t.index >= this._first && t.index <= this._last)
      this._children[t.index - this._first].scrollIntoView(t);
    else if (t.index = Math.min(t.index, this._items.length - 1), t.behavior === "smooth") {
      const e = this._layout.getScrollIntoViewCoordinates(t), { behavior: i } = t;
      this._updateScrollIntoViewCoordinates = this._scrollerController.managedScrollTo(Object.assign(e, { behavior: i }), () => this._layout.getScrollIntoViewCoordinates(t), () => this._scrollIntoViewTarget = null), this._scrollIntoViewTarget = t;
    } else
      this._layout.pin = t;
  }
  /**
   * If we are smoothly scrolling to an element and the target element
   * is in the DOM, we update our target coordinates as needed
   */
  _checkScrollIntoViewTarget(t) {
    const { index: e } = this._scrollIntoViewTarget || {};
    e && (t != null && t.has(e)) && this._updateScrollIntoViewCoordinates(this._layout.getScrollIntoViewCoordinates(this._scrollIntoViewTarget));
  }
  /**
   * Emits a rangechange event with the current first, last, firstVisible, and
   * lastVisible.
   */
  _notifyRange() {
    this._hostElement.dispatchEvent(new yt({ first: this._first, last: this._last }));
  }
  _notifyVisibility() {
    this._hostElement.dispatchEvent(new gt({
      first: this._firstVisible,
      last: this._lastVisible
    }));
  }
  get layoutComplete() {
    return this._layoutCompletePromise || (this._layoutCompletePromise = new Promise((t, e) => {
      this._layoutCompleteResolver = t, this._layoutCompleteRejecter = e;
    })), this._layoutCompletePromise;
  }
  _rejectLayoutCompletePromise(t) {
    this._layoutCompleteRejecter !== null && this._layoutCompleteRejecter(t), this._resetLayoutCompleteState();
  }
  _scheduleLayoutComplete() {
    this._layoutCompletePromise && this._pendingLayoutComplete === null && (this._pendingLayoutComplete = requestAnimationFrame(() => requestAnimationFrame(() => this._resolveLayoutCompletePromise())));
  }
  _resolveLayoutCompletePromise() {
    this._layoutCompleteResolver !== null && this._layoutCompleteResolver(), this._resetLayoutCompleteState();
  }
  _resetLayoutCompleteState() {
    this._layoutCompletePromise = null, this._layoutCompleteResolver = null, this._layoutCompleteRejecter = null, this._pendingLayoutComplete = null;
  }
  /**
   * Render and update the view at the next opportunity with the given
   * hostElement size.
   */
  _hostElementSizeChanged() {
    this._schedule(this._updateLayout);
  }
  // TODO (graynorton): Rethink how this works. Probably child loading is too specific
  // to have dedicated support for; might want some more generic lifecycle hooks for
  // layouts to use. Possibly handle measurement this way, too, or maybe that remains
  // a first-class feature?
  _childLoaded() {
  }
  // This is the callback for the ResizeObserver that watches the
  // virtualizer's children. We land here at the end of every virtualizer
  // update cycle that results in changes to physical items, and we also
  // end up here if one or more children change size independently of
  // the virtualizer update cycle.
  _childrenSizeChanged(t) {
    var e;
    if ((e = this._layout) != null && e.measureChildren) {
      for (const i of t)
        this._toBeMeasured.set(i.target, i.contentRect);
      this._measureChildren();
    }
    this._scheduleLayoutComplete(), this._itemsChanged = !1, this._rangeChanged = !1;
  }
}
function mi(s) {
  const t = window.getComputedStyle(s);
  return {
    marginTop: rt(t.marginTop),
    marginRight: rt(t.marginRight),
    marginBottom: rt(t.marginBottom),
    marginLeft: rt(t.marginLeft)
  };
}
function rt(s) {
  const t = s ? parseFloat(s) : NaN;
  return Number.isNaN(t) ? 0 : t;
}
function Gt(s) {
  if (s.assignedSlot !== null)
    return s.assignedSlot;
  if (s.parentElement !== null)
    return s.parentElement;
  const t = s.parentNode;
  return t && t.nodeType === Node.DOCUMENT_FRAGMENT_NODE && t.host || null;
}
function yi(s, t = !1) {
  const e = [];
  let i = t ? s : Gt(s);
  for (; i !== null; )
    e.push(i), i = Gt(i);
  return e;
}
function gi(s, t = !1) {
  let e = !1;
  return yi(s, t).filter((i) => {
    if (e)
      return !1;
    const r = getComputedStyle(i);
    return e = r.position === "fixed", r.overflow !== "visible";
  });
}
/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const me = (s) => s, ye = (s, t) => g`${t}: ${JSON.stringify(s, null, 2)}`;
class bi extends ci {
  constructor(t) {
    if (super(t), this._virtualizer = null, this._first = 0, this._last = -1, this._renderItem = (e, i) => ye(e, i + this._first), this._keyFunction = (e, i) => me(e, i + this._first), this._items = [], t.type !== mt.CHILD)
      throw new Error("The virtualize directive can only be used in child expressions");
  }
  render(t) {
    t && this._setFunctions(t);
    const e = [];
    if (this._first >= 0 && this._last >= this._first)
      for (let i = this._first; i <= this._last; i++)
        e.push(this._items[i]);
    return di(e, this._keyFunction, this._renderItem);
  }
  update(t, [e]) {
    this._setFunctions(e);
    const i = this._items !== e.items;
    return this._items = e.items || [], this._virtualizer ? this._updateVirtualizerConfig(t, e) : this._initialize(t, e), i ? A : this.render();
  }
  async _updateVirtualizerConfig(t, e) {
    if (!await this._virtualizer.updateLayoutConfig(e.layout || {})) {
      const r = t.parentNode;
      this._makeVirtualizer(r, e);
    }
    this._virtualizer.items = this._items;
  }
  _setFunctions(t) {
    const { renderItem: e, keyFunction: i } = t;
    e && (this._renderItem = (r, n) => e(r, n + this._first)), i && (this._keyFunction = (r, n) => i(r, n + this._first));
  }
  _makeVirtualizer(t, e) {
    this._virtualizer && this._virtualizer.disconnected();
    const { layout: i, scroller: r, items: n } = e;
    this._virtualizer = new fi({ hostElement: t, layout: i, scroller: r }), this._virtualizer.items = n, this._virtualizer.connected();
  }
  _initialize(t, e) {
    const i = t.parentNode;
    i && i.nodeType === 1 && (i.addEventListener("rangeChanged", (r) => {
      this._first = r.first, this._last = r.last, this.setValue(this.render());
    }), this._makeVirtualizer(i, e));
  }
  disconnected() {
    var t;
    (t = this._virtualizer) == null || t.disconnected();
  }
  reconnected() {
    var t;
    (t = this._virtualizer) == null || t.connected();
  }
}
const vi = Lt(bi);
/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
class H extends N {
  constructor() {
    super(...arguments), this.items = [], this.renderItem = ye, this.keyFunction = me, this.layout = {}, this.scroller = !1;
  }
  createRenderRoot() {
    return this;
  }
  render() {
    const { items: t, renderItem: e, keyFunction: i, layout: r, scroller: n } = this;
    return g`${vi({
      items: t,
      renderItem: e,
      keyFunction: i,
      layout: r,
      scroller: n
    })}`;
  }
  element(t) {
    var e;
    return (e = this[xt]) == null ? void 0 : e.element(t);
  }
  get layoutComplete() {
    var t;
    return (t = this[xt]) == null ? void 0 : t.layoutComplete;
  }
  /**
   * This scrollToIndex() shim is here to provide backwards compatibility with other 0.x versions of
   * lit-virtualizer. It is deprecated and will likely be removed in the 1.0.0 release.
   */
  scrollToIndex(t, e = "start") {
    var i;
    (i = this.element(t)) == null || i.scrollIntoView({ block: e });
  }
}
et([
  v({ attribute: !1 })
], H.prototype, "items", void 0);
et([
  v()
], H.prototype, "renderItem", void 0);
et([
  v()
], H.prototype, "keyFunction", void 0);
et([
  v({ attribute: !1 })
], H.prototype, "layout", void 0);
et([
  v({ reflect: !0, type: Boolean })
], H.prototype, "scroller", void 0);
/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
customElements.define("lit-virtualizer", H);
const _i = /^(https?:|mailto:)/i;
function wi(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function ki(s) {
  if (!s) return "";
  let t = wi(s);
  return t = t.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (e, i, r) => _i.test(r) ? `<a href="${r}" target="_blank" rel="noopener noreferrer">${i}</a>` : i
  ), t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"), t = t.replace(/__(.+?)__/g, "<strong>$1</strong>"), t = t.replace(/\*(.+?)\*/g, "<em>$1</em>"), t = t.replace(/_(.+?)_/g, "<em>$1</em>"), t = t.replace(/\n/g, "<br>"), t;
}
function Si(s) {
  if (!s.length) return null;
  let t = 0;
  for (const e of s) {
    if (typeof e.durationMs != "number") return null;
    t += e.durationMs;
  }
  return t;
}
function $i(s) {
  const t = Math.round(s / 6e4);
  if (t < 60) return `${t} min`;
  const e = Math.floor(t / 60), i = t % 60;
  return i ? `${e} hr ${i} min` : `${e} hr`;
}
const Ci = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function Zt(s) {
  if (!s) return null;
  const t = new Date(s);
  return Number.isNaN(t.getTime()) ? null : `${Ci[t.getMonth()]} ${t.getFullYear()}`;
}
function Ei(s, t) {
  const e = Zt(s), i = Zt(t);
  return !e && !i ? null : e ? !i || e === i ? e : `${e} – ${i}` : i;
}
class Ai {
  constructor(t, e, i = () => {
  }, r = {}) {
    var n, a;
    this.provider = t, this.tracks = e, this.onChange = i, this.state = "uninitialized", this.halted = !1, this.shuffle = !1, this.positionMs = 0, this.durationMs = 0, this.failed = /* @__PURE__ */ new Set(), this.unavailable = /* @__PURE__ */ new Set(), this.pos = 0, this.loadedIndex = null, this.consecutiveErrors = 0, this.skipDelayMs = r.skipDelayMs ?? 0, this.errorLimit = r.errorLimit ?? 3, this.debug = r.debug ?? !1, this.random = r.random ?? Math.random, this.order = e.map((l, o) => o), this.provider.onStateChange((l) => this.handle(l)), (a = (n = this.provider).onProgress) == null || a.call(n, (l, o) => {
      this.positionMs = l, this.durationMs = o, this.onChange();
    });
  }
  // The current TRACK index (into `tracks`), for the UI's active marker.
  get index() {
    return this.order[this.pos] ?? 0;
  }
  // --- user-initiated actions (reset the circuit breaker) ---
  async start(t = 0) {
    this.resetBreaker(), this.pos = this.posOf(t), await this.loadCurrent();
  }
  async play() {
    this.resetBreaker(), this.loadedIndex !== this.index ? await this.loadCurrent() : await this.provider.play();
  }
  pause() {
    this.provider.pause();
  }
  seek(t) {
    this.provider.seek(t);
  }
  async next() {
    this.resetBreaker(), await this.advance();
  }
  async prev() {
    this.resetBreaker();
    const t = this.step(-1);
    t !== null && (this.pos = t, await this.loadCurrent());
  }
  // markUnavailable records (or clears) foreknowledge that a track can't be
  // played, so the queue skips it. Fed by the background availability prescan.
  markUnavailable(t, e = !0) {
    e ? this.unavailable.add(t) : this.unavailable.delete(t);
  }
  // setShuffle rebuilds the play order, keeping the current track playing.
  setShuffle(t) {
    if (t === this.shuffle) return;
    const e = this.index;
    if (t) {
      const i = this.order.filter((r) => r !== e);
      this.order = [e, ...this.shuffled(i)];
    } else
      this.order = this.tracks.map((i, r) => r);
    this.pos = this.posOf(e), this.shuffle = t, this.onChange();
  }
  dispose() {
    this.provider.dispose();
  }
  // --- internals ---
  posOf(t) {
    const e = this.order.indexOf(t);
    return e >= 0 ? e : 0;
  }
  resetBreaker() {
    this.consecutiveErrors = 0, this.halted = !1;
  }
  async loadCurrent() {
    const t = this.order[this.pos];
    t !== void 0 && (this.positionMs = 0, this.durationMs = 0, await this.provider.load(this.tracks[t]), this.loadedIndex = t, await this.provider.play());
  }
  async advance() {
    const t = this.step(1);
    t !== null && (this.pos = t, await this.loadCurrent());
  }
  // step finds the next position in the given direction whose track is not
  // known-unavailable, or null if there's none.
  step(t) {
    let e = this.pos + t;
    for (; e >= 0 && e < this.order.length; ) {
      if (!this.unavailable.has(this.order[e])) return e;
      e += t;
    }
    return null;
  }
  scheduleAutoSkip(t) {
    t > 0 ? setTimeout(() => void this.advance(), t) : this.advance();
  }
  shuffled(t) {
    const e = t.slice();
    for (let i = e.length - 1; i > 0; i--) {
      const r = Math.floor(this.random() * (i + 1));
      [e[i], e[r]] = [e[r], e[i]];
    }
    return e;
  }
  handle(t) {
    switch (this.state = t, t) {
      case "ready":
      case "playing":
        this.failed.delete(this.index), this.unavailable.delete(this.index), this.consecutiveErrors = 0;
        break;
      case "ended":
        this.advance();
        break;
      case "unavailable":
        this.failed.add(this.index), this.unavailable.add(this.index), this.scheduleAutoSkip(this.skipDelayMs);
        break;
      case "error":
        this.failed.add(this.index), this.consecutiveErrors += 1, this.consecutiveErrors >= this.errorLimit ? (this.halted = !0, this.log(`circuit breaker: halted after ${this.consecutiveErrors} consecutive errors`)) : this.scheduleAutoSkip(this.skipDelayMs * this.consecutiveErrors);
        break;
    }
    this.onChange();
  }
  log(...t) {
    this.debug && console.debug("[byom-player:controller]", ...t);
  }
}
const te = 250;
class xi {
  constructor(t = {}) {
    this.name = "mock", this.callback = () => {
    }, this.progressCallback = () => {
    }, this.timer = null, this.ticker = null, this.positionMs = 0, this.durationMs = t.trackDurationMs ?? 3e3;
  }
  async initialize() {
    this.emit("ready");
  }
  async load(t) {
    this.stop(), this.positionMs = 0, this.emit("ready");
  }
  async play() {
    this.stop(), this.emit("playing"), this.progressCallback(this.positionMs, this.durationMs), this.ticker = setInterval(() => {
      this.positionMs = Math.min(this.positionMs + te, this.durationMs), this.progressCallback(this.positionMs, this.durationMs);
    }, te), this.timer = setTimeout(() => {
      this.stop(), this.emit("ended");
    }, this.durationMs);
  }
  pause() {
    this.stop(), this.emit("paused");
  }
  seek(t) {
    this.positionMs = Math.max(0, Math.min(t, this.durationMs)), this.progressCallback(this.positionMs, this.durationMs);
  }
  dispose() {
    this.stop();
  }
  onStateChange(t) {
    this.callback = t;
  }
  onProgress(t) {
    this.progressCallback = t;
  }
  emit(t) {
    this.callback(t);
  }
  stop() {
    this.timer && (clearTimeout(this.timer), this.timer = null), this.ticker && (clearInterval(this.ticker), this.ticker = null);
  }
}
function P(s, t) {
  const e = (s & 65535) + (t & 65535);
  return (s >> 16) + (t >> 16) + (e >> 16) << 16 | e & 65535;
}
function Ti(s, t) {
  return s << t | s >>> 32 - t;
}
function vt(s, t, e, i, r, n) {
  return P(Ti(P(P(t, s), P(i, n)), r), e);
}
function w(s, t, e, i, r, n, a) {
  return vt(t & e | ~t & i, s, t, r, n, a);
}
function k(s, t, e, i, r, n, a) {
  return vt(t & i | e & ~i, s, t, r, n, a);
}
function S(s, t, e, i, r, n, a) {
  return vt(t ^ e ^ i, s, t, r, n, a);
}
function $(s, t, e, i, r, n, a) {
  return vt(e ^ (t | ~i), s, t, r, n, a);
}
function Pi(s, t) {
  s[t >> 5] |= 128 << t % 32, s[(t + 64 >>> 9 << 4) + 14] = t;
  let e = 1732584193, i = -271733879, r = -1732584194, n = 271733878;
  for (let a = 0; a < s.length; a += 16) {
    const l = e, o = i, h = r, p = n;
    e = w(e, i, r, n, s[a] | 0, 7, -680876936), n = w(n, e, i, r, s[a + 1] | 0, 12, -389564586), r = w(r, n, e, i, s[a + 2] | 0, 17, 606105819), i = w(i, r, n, e, s[a + 3] | 0, 22, -1044525330), e = w(e, i, r, n, s[a + 4] | 0, 7, -176418897), n = w(n, e, i, r, s[a + 5] | 0, 12, 1200080426), r = w(r, n, e, i, s[a + 6] | 0, 17, -1473231341), i = w(i, r, n, e, s[a + 7] | 0, 22, -45705983), e = w(e, i, r, n, s[a + 8] | 0, 7, 1770035416), n = w(n, e, i, r, s[a + 9] | 0, 12, -1958414417), r = w(r, n, e, i, s[a + 10] | 0, 17, -42063), i = w(i, r, n, e, s[a + 11] | 0, 22, -1990404162), e = w(e, i, r, n, s[a + 12] | 0, 7, 1804603682), n = w(n, e, i, r, s[a + 13] | 0, 12, -40341101), r = w(r, n, e, i, s[a + 14] | 0, 17, -1502002290), i = w(i, r, n, e, s[a + 15] | 0, 22, 1236535329), e = k(e, i, r, n, s[a + 1] | 0, 5, -165796510), n = k(n, e, i, r, s[a + 6] | 0, 9, -1069501632), r = k(r, n, e, i, s[a + 11] | 0, 14, 643717713), i = k(i, r, n, e, s[a] | 0, 20, -373897302), e = k(e, i, r, n, s[a + 5] | 0, 5, -701558691), n = k(n, e, i, r, s[a + 10] | 0, 9, 38016083), r = k(r, n, e, i, s[a + 15] | 0, 14, -660478335), i = k(i, r, n, e, s[a + 4] | 0, 20, -405537848), e = k(e, i, r, n, s[a + 9] | 0, 5, 568446438), n = k(n, e, i, r, s[a + 14] | 0, 9, -1019803690), r = k(r, n, e, i, s[a + 3] | 0, 14, -187363961), i = k(i, r, n, e, s[a + 8] | 0, 20, 1163531501), e = k(e, i, r, n, s[a + 13] | 0, 5, -1444681467), n = k(n, e, i, r, s[a + 2] | 0, 9, -51403784), r = k(r, n, e, i, s[a + 7] | 0, 14, 1735328473), i = k(i, r, n, e, s[a + 12] | 0, 20, -1926607734), e = S(e, i, r, n, s[a + 5] | 0, 4, -378558), n = S(n, e, i, r, s[a + 8] | 0, 11, -2022574463), r = S(r, n, e, i, s[a + 11] | 0, 16, 1839030562), i = S(i, r, n, e, s[a + 14] | 0, 23, -35309556), e = S(e, i, r, n, s[a + 1] | 0, 4, -1530992060), n = S(n, e, i, r, s[a + 4] | 0, 11, 1272893353), r = S(r, n, e, i, s[a + 7] | 0, 16, -155497632), i = S(i, r, n, e, s[a + 10] | 0, 23, -1094730640), e = S(e, i, r, n, s[a + 13] | 0, 4, 681279174), n = S(n, e, i, r, s[a] | 0, 11, -358537222), r = S(r, n, e, i, s[a + 3] | 0, 16, -722521979), i = S(i, r, n, e, s[a + 6] | 0, 23, 76029189), e = S(e, i, r, n, s[a + 9] | 0, 4, -640364487), n = S(n, e, i, r, s[a + 12] | 0, 11, -421815835), r = S(r, n, e, i, s[a + 15] | 0, 16, 530742520), i = S(i, r, n, e, s[a + 2] | 0, 23, -995338651), e = $(e, i, r, n, s[a] | 0, 6, -198630844), n = $(n, e, i, r, s[a + 7] | 0, 10, 1126891415), r = $(r, n, e, i, s[a + 14] | 0, 15, -1416354905), i = $(i, r, n, e, s[a + 5] | 0, 21, -57434055), e = $(e, i, r, n, s[a + 12] | 0, 6, 1700485571), n = $(n, e, i, r, s[a + 3] | 0, 10, -1894986606), r = $(r, n, e, i, s[a + 10] | 0, 15, -1051523), i = $(i, r, n, e, s[a + 1] | 0, 21, -2054922799), e = $(e, i, r, n, s[a + 8] | 0, 6, 1873313359), n = $(n, e, i, r, s[a + 15] | 0, 10, -30611744), r = $(r, n, e, i, s[a + 6] | 0, 15, -1560198380), i = $(i, r, n, e, s[a + 13] | 0, 21, 1309151649), e = $(e, i, r, n, s[a + 4] | 0, 6, -145523070), n = $(n, e, i, r, s[a + 11] | 0, 10, -1120210379), r = $(r, n, e, i, s[a + 2] | 0, 15, 718787259), i = $(i, r, n, e, s[a + 9] | 0, 21, -343485551), e = P(e, l), i = P(i, o), r = P(r, h), n = P(n, p);
  }
  return [e, i, r, n];
}
function Ii(s) {
  let t = "";
  for (let e = 0; e < s.length * 32; e += 8)
    t += String.fromCharCode(s[e >> 5] >>> e % 32 & 255);
  return t;
}
function Mi(s) {
  const t = [];
  for (let e = 0; e < s.length * 8; e += 8)
    t[e >> 5] = (t[e >> 5] || 0) | (s.charCodeAt(e / 8) & 255) << e % 32;
  return t;
}
function Ri(s) {
  return Ii(Pi(Mi(s), s.length * 8));
}
function Li(s) {
  const t = "0123456789abcdef";
  let e = "";
  for (let i = 0; i < s.length; i += 1) {
    const r = s.charCodeAt(i);
    e += t.charAt(r >>> 4 & 15) + t.charAt(r & 15);
  }
  return e;
}
function Oi(s) {
  const t = new TextEncoder().encode(s);
  let e = "";
  for (const i of t) e += String.fromCharCode(i);
  return e;
}
function zi(s) {
  return Li(Ri(Oi(s)));
}
function C(s) {
  if (s.isrc) return "isrc:" + s.isrc.toLowerCase();
  if (s.byomId) return "byom:" + s.byomId;
  const t = (e) => e.trim().toLowerCase().replace(/\s+/g, " ");
  return `q:${t(s.artist)}|${t(s.title)}`;
}
const ee = "byom-player:resolv:v1", Ui = 5e4, Di = 3600 * 1e3, q = "\0";
class _t {
  constructor(t = {}) {
    this.storage = t.storage === void 0 ? Ni() : t.storage, this.maxEntries = t.maxEntries ?? Ui, this.missTtlMs = t.missTtlMs ?? Di, this.now = t.now ?? (() => Date.now()), this.map = this.load();
  }
  get(t, e) {
    const i = t + q + e, r = this.map.get(i);
    if (r) {
      if ("id" in r) return r.id;
      if (this.now() - r.m >= this.missTtlMs) {
        this.map.delete(i), this.persist();
        return;
      }
      return null;
    }
  }
  set(t, e, i) {
    this.store(t + q + e, { id: i });
  }
  setMiss(t, e) {
    this.store(t + q + e, { m: this.now() });
  }
  store(t, e) {
    for (this.map.set(t, e); this.map.size > this.maxEntries; ) {
      const i = this.map.keys().next().value;
      if (i === void 0) break;
      this.map.delete(i);
    }
    this.persist();
  }
  evict(t, e) {
    this.map.delete(t + q + e) && this.persist();
  }
  clear(t) {
    const e = t + q;
    let i = !1;
    for (const r of this.map.keys())
      r.startsWith(e) && (this.map.delete(r), i = !0);
    i && this.persist();
  }
  load() {
    const t = /* @__PURE__ */ new Map();
    if (!this.storage) return t;
    try {
      const e = this.storage.getItem(ee);
      if (!e) return t;
      const i = JSON.parse(e);
      for (const [r, n] of Object.entries(i))
        typeof n == "string" ? t.set(r, { id: n }) : n && typeof n == "object" && ("id" in n || "m" in n) && t.set(r, n);
    } catch {
      return /* @__PURE__ */ new Map();
    }
    return t;
  }
  persist() {
    if (this.storage)
      try {
        this.storage.setItem(ee, JSON.stringify(Object.fromEntries(this.map)));
      } catch {
      }
  }
}
function Ni() {
  try {
    return typeof localStorage < "u" ? localStorage : null;
  } catch {
    return null;
  }
}
const ji = "1.16.1", Vi = "byom-player", Hi = 30, Fi = 240;
class Bi {
  constructor(t) {
    this.name = "subsonic", this.audio = new Audio(), this.listeners = new AbortController(), this.callback = () => {
    }, this.progressCallback = () => {
    }, this.currentId = null, this.nowPlayingSent = !1, this.submitted = !1, this.currentTrack = null, this.currentKey = null, this.currentIdFromCache = !1, this.retriedStale = !1, this.hasPlayed = !1, this.cfg = t, this.scope = "subsonic:" + this.cfg.baseUrl.replace(/\/$/, ""), this.cache = this.cfg.cache === !1 ? null : this.cfg.resolutionCache ?? new _t(), this.cfg.token && this.cfg.salt ? (this.authToken = this.cfg.token, this.authSalt = this.cfg.salt) : this.cfg.password && (this.authSalt = Ki(), this.authToken = zi(this.cfg.password + this.authSalt));
    const e = { signal: this.listeners.signal };
    this.audio.addEventListener(
      "playing",
      () => {
        this.hasPlayed = !0, this.callback("playing"), this.sendNowPlaying();
      },
      e
    ), this.audio.addEventListener("pause", () => this.callback("paused"), e), this.audio.addEventListener("ended", () => this.callback("ended"), e), this.audio.addEventListener("error", () => this.handleAudioError(), e), this.audio.addEventListener("timeupdate", () => this.emitProgress(), e), this.audio.addEventListener("durationchange", () => this.emitProgress(), e);
  }
  emitProgress() {
    const t = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
    this.progressCallback(this.audio.currentTime * 1e3, t * 1e3), this.maybeSubmit(this.audio.currentTime, t);
  }
  scrobbleEnabled() {
    return this.cfg.scrobble !== !1;
  }
  sendNowPlaying() {
    !this.currentId || this.nowPlayingSent || !this.scrobbleEnabled() || (this.nowPlayingSent = !0, this.scrobble(this.currentId, !1));
  }
  maybeSubmit(t, e) {
    if (!this.currentId || this.submitted || !this.scrobbleEnabled() || e < Hi) return;
    const i = Math.min(e / 2, Fi);
    t >= i && (this.submitted = !0, this.scrobble(this.currentId, !0));
  }
  // scrobble notifies the server of a play. Fire-and-forget: it never awaits,
  // never routes through the retrying fetchJson, and never affects provider
  // state — a flaky scrobble must not disrupt playback or trip the breaker.
  // submission=false is a "now playing" ping; submission=true is a play count.
  // Navidrome also accepts the bare /rest/scrobble alias.
  scrobble(t, e) {
    const i = this.url("scrobble.view", {
      id: t,
      submission: String(e),
      time: String(Date.now())
    });
    fetch(i).catch((r) => this.log("scrobble failed", r));
  }
  async initialize() {
    this.callback("ready");
  }
  async load(t) {
    var i;
    this.currentId = null, this.nowPlayingSent = !1, this.submitted = !1, this.currentTrack = t, this.currentKey = C(t), this.retriedStale = !1, this.hasPlayed = !1, this.currentIdFromCache = !!((i = this.cache) != null && i.get(this.scope, this.currentKey));
    let e;
    try {
      e = await this.resolve(t);
    } catch (r) {
      this.log("resolve error", t.artist, "-", t.title, r), this.callback("error");
      return;
    }
    if (!e) {
      this.log("not in collection", t.artist, "-", t.title), this.callback("unavailable");
      return;
    }
    this.log("resolved", t.artist, "-", t.title, "->", e), this.currentId = e, this.audio.src = this.streamUrl(e), this.callback("ready");
  }
  async play() {
    try {
      await this.audio.play();
    } catch {
      this.callback("error");
    }
  }
  pause() {
    this.audio.pause();
  }
  seek(t) {
    this.audio.currentTime = t / 1e3;
  }
  onStateChange(t) {
    this.callback = t;
  }
  onProgress(t) {
    this.progressCallback = t;
  }
  dispose() {
    this.listeners.abort(), this.audio.pause(), this.audio.removeAttribute("src"), this.audio.load();
  }
  // resolve queries Subsonic search3 for the best matching song id, or null when
  // the server responds successfully but the track isn't in the collection.
  // Transient failures (network/5xx/subsonic-failed) are retried, then thrown.
  async resolve(t) {
    var l, o, h, p, c, m, u;
    const e = C(t), i = (l = this.cache) == null ? void 0 : l.get(this.scope, e);
    if (i)
      return this.log("cache hit", t.artist, "-", t.title, "->", i), i;
    if (i === null)
      return this.log("cache miss (known)", t.artist, "-", t.title), null;
    const r = `${t.artist} ${t.title}`.trim(), n = await this.fetchJson(this.url("search3.view", { query: r, songCount: "1" })), a = ((c = (p = (h = (o = n == null ? void 0 : n["subsonic-response"]) == null ? void 0 : o.searchResult3) == null ? void 0 : h.song) == null ? void 0 : p[0]) == null ? void 0 : c.id) ?? null;
    return a ? (m = this.cache) == null || m.set(this.scope, e, a) : (u = this.cache) == null || u.setMiss(this.scope, e), a;
  }
  // clearCache drops this server's cached ids (e.g. after a library rescan).
  clearCache() {
    var t;
    (t = this.cache) == null || t.clear(this.scope);
  }
  // isResolutionCached reports whether resolve() would answer this track from
  // cache (no search3). Lets the availability prescan skip its throttle on hits.
  isResolutionCached(t) {
    var e;
    return ((e = this.cache) == null ? void 0 : e.get(this.scope, C(t))) !== void 0;
  }
  // handleAudioError distinguishes a stale cached id (errors before it ever
  // plays) from a genuine/transient failure. For the former, evict the entry
  // and re-resolve live once; otherwise surface 'error' as usual.
  handleAudioError() {
    if (!this.hasPlayed && this.currentIdFromCache && !this.retriedStale && this.cache && this.currentTrack && this.currentKey) {
      this.retriedStale = !0, this.cache.evict(this.scope, this.currentKey), this.log(
        "cached id failed; re-resolving",
        this.currentTrack.artist,
        "-",
        this.currentTrack.title
      ), this.reloadFresh(this.currentTrack);
      return;
    }
    this.callback("error");
  }
  // reloadFresh re-resolves after evicting a stale id, then resumes playback.
  async reloadFresh(t) {
    this.currentIdFromCache = !1;
    let e;
    try {
      e = await this.resolve(t);
    } catch {
      this.callback("error");
      return;
    }
    if (!e) {
      this.callback("unavailable");
      return;
    }
    this.currentId = e, this.audio.src = this.streamUrl(e), this.play();
  }
  log(...t) {
    this.cfg.debug && console.debug("[byom-player:direct]", ...t);
  }
  async fetchJson(t) {
    var r;
    const e = this.cfg.retries ?? 2, i = this.cfg.retryDelayMs ?? 400;
    for (let n = 0; ; n++)
      try {
        const a = await fetch(t);
        if (!a.ok) throw new Error(`HTTP ${a.status}`);
        const l = await a.json();
        if (((r = l == null ? void 0 : l["subsonic-response"]) == null ? void 0 : r.status) === "failed")
          throw new Error("subsonic-response status failed");
        return l;
      } catch (a) {
        if (n >= e) throw a;
        await new Promise((l) => setTimeout(l, i * (n + 1)));
      }
  }
  streamUrl(t) {
    return this.url("stream.view", { id: t });
  }
  async checkAvailability(t) {
    try {
      return await this.resolve(t) ? "available" : "unavailable";
    } catch {
      return "unknown";
    }
  }
  authParams() {
    const t = new URLSearchParams({ v: ji, c: Vi, f: "json" });
    return this.cfg.apiKey ? t.set("apiKey", this.cfg.apiKey) : this.authToken && this.authSalt && (this.cfg.username && t.set("u", this.cfg.username), t.set("t", this.authToken), t.set("s", this.authSalt)), t;
  }
  url(t, e) {
    const i = this.authParams();
    for (const [n, a] of Object.entries(e)) i.set(n, a);
    return `${this.cfg.baseUrl.replace(/\/$/, "")}/rest/${t}?${i.toString()}`;
  }
}
function Ki() {
  const s = new Uint8Array(8);
  return crypto.getRandomValues(s), Array.from(s, (t) => t.toString(16).padStart(2, "0")).join("");
}
const Y = "youtube", qi = 0, ge = 1, Yi = 2, Wi = 5, Ji = -1, Qi = 250, Xi = 2, Gi = 100, Zi = 101, ts = 150;
function es(s) {
  switch (s) {
    case Xi:
    case Gi:
    case Zi:
    case ts:
      return "unavailable";
    default:
      return "error";
  }
}
function is(s) {
  switch (s) {
    case qi:
      return "ended";
    case ge:
      return "playing";
    case Yi:
      return "paused";
    case Wi:
    case Ji:
      return "ready";
    default:
      return null;
  }
}
class ss {
  // a real video is loaded (guards play() on the empty player)
  constructor(t) {
    this.name = "youtube", this.stateCallback = () => {
    }, this.progressCallback = () => {
    }, this.ticker = null, this.cued = !1, this.cfg = t, this.engine = this.cfg.engine ?? new ns(), this.engine.onState((e) => this.handleYtState(e)), this.engine.onError((e) => this.handleYtError(e)), this.cache = this.cfg.cache === !1 ? null : this.cfg.resolutionCache ?? new _t();
  }
  // Mount the visible player into a host element (called before initialize()).
  attach(t) {
    this.engine.attach(t);
  }
  async initialize() {
    await this.engine.ready(), this.stateCallback("ready");
  }
  async load(t) {
    let e;
    try {
      e = await this.resolve(t);
    } catch (i) {
      this.log("resolve error", t.artist, "-", t.title, i), this.cued = !1, this.stateCallback("error");
      return;
    }
    if (!e) {
      this.log("no match", t.artist, "-", t.title), this.cued = !1, this.stateCallback("unavailable");
      return;
    }
    this.log("resolved", t.artist, "-", t.title, "->", e), this.cued = !0, this.engine.cue(e);
  }
  async play() {
    this.cued && this.engine.play();
  }
  pause() {
    this.engine.pause();
  }
  seek(t) {
    this.engine.seek(t);
  }
  onStateChange(t) {
    this.stateCallback = t;
  }
  onProgress(t) {
    this.progressCallback = t;
  }
  dispose() {
    this.stopTicker(), this.engine.destroy();
  }
  // resolve turns a track into a videoId via the chain: embedded id (from the
  // manifest) -> cache -> live search (if configured) -> give up (null). Positive
  // live results are cached; misses are negative-cached (TTL). Transient search
  // failures throw (controller circuit breaker).
  async resolve(t) {
    var n, a;
    const e = this.cachedId(t);
    if (e) return e;
    if (e === null || !this.searchConfigured()) return null;
    const i = await this.liveSearch(t), r = C(t);
    return i ? (n = this.cache) == null || n.set(Y, r, i) : (a = this.cache) == null || a.setMiss(Y, r), i;
  }
  searchConfigured() {
    return !!(this.cfg.apiKey || this.cfg.searchEndpoint);
  }
  // cachedId returns the embedded videoId (from the manifest), else the cache's
  // answer: a hit (string), a known miss (null), or unknown (undefined).
  cachedId(t) {
    var e, i;
    return ((e = t.resolvedIds) == null ? void 0 : e.youtube) ?? ((i = this.cache) == null ? void 0 : i.get(Y, C(t)));
  }
  // liveSearch performs the actual "{artist} {title} audio" lookup. Only called
  // when a searchEndpoint or apiKey is configured. Returns null on a clean miss;
  // throws on transient HTTP failure.
  async liveSearch(t) {
    var a, l, o, h, p, c;
    const e = `${t.artist} ${t.title} audio`.trim();
    if (this.cfg.apiKey) {
      const m = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(e)}&key=${encodeURIComponent(this.cfg.apiKey)}`, u = await this.fetchJson(m);
      return ((o = (l = (a = u == null ? void 0 : u.items) == null ? void 0 : a[0]) == null ? void 0 : l.id) == null ? void 0 : o.videoId) ?? null;
    }
    const i = this.cfg.searchEndpoint.includes("?") ? "&" : "?", r = `${this.cfg.searchEndpoint}${i}q=${encodeURIComponent(e)}`, n = await this.fetchJson(r);
    return (n == null ? void 0 : n.videoId) ?? ((c = (p = (h = n == null ? void 0 : n.items) == null ? void 0 : h[0]) == null ? void 0 : p.id) == null ? void 0 : c.videoId) ?? null;
  }
  // checkAvailability mirrors the resolution chain without playing: embedded/
  // cached ids answer for free; a live search runs only if configured (and only
  // then does it spend quota). Unknown (not error) when we can't tell.
  async checkAvailability(t) {
    var i, r;
    const e = this.cachedId(t);
    if (e) return "available";
    if (e === null || !this.searchConfigured()) return "unavailable";
    try {
      const n = await this.liveSearch(t), a = C(t);
      return n ? ((i = this.cache) == null || i.set(Y, a, n), "available") : ((r = this.cache) == null || r.setMiss(Y, a), "unavailable");
    } catch {
      return "unknown";
    }
  }
  // isResolutionCached reports whether availability/resolution is answerable
  // without touching the network (embedded id or any cache entry), so the
  // background prescan can skip its throttle for it.
  isResolutionCached(t) {
    return this.cachedId(t) !== void 0;
  }
  async fetchJson(t) {
    const e = await fetch(t);
    if (!e.ok) throw new Error(`HTTP ${e.status}`);
    return e.json();
  }
  handleYtState(t) {
    const e = is(t);
    e && this.stateCallback(e), t === ge ? this.startTicker() : this.stopTicker();
  }
  // Playback failed. Stop progress ticks and emit the mapped state so the
  // controller can advance (unavailable → clean skip) or account for a
  // transient error (error → circuit breaker).
  handleYtError(t) {
    const e = es(t);
    this.log("player error", t, "->", e), this.stopTicker(), this.stateCallback(e);
  }
  startTicker() {
    this.stopTicker(), this.progressCallback(this.engine.currentTimeMs(), this.engine.durationMs()), this.ticker = setInterval(() => {
      this.progressCallback(this.engine.currentTimeMs(), this.engine.durationMs());
    }, Qi);
  }
  stopTicker() {
    this.ticker && (clearInterval(this.ticker), this.ticker = null);
  }
  log(...t) {
    this.cfg.debug && console.debug("[byom-player:youtube]", ...t);
  }
}
let nt = null;
function rs() {
  return nt || (nt = new Promise((s) => {
    if (window.YT && window.YT.Player) {
      s();
      return;
    }
    const t = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      t == null || t(), s();
    };
    const e = document.createElement("script");
    e.src = "https://www.youtube.com/iframe_api", document.head.appendChild(e);
  }), nt);
}
class ns {
  constructor() {
    this.player = null, this.hiddenContainer = null, this.target = null, this.stateCallback = () => {
    }, this.errorCallback = () => {
    };
  }
  attach(t) {
    this.target = t;
  }
  async ready() {
    if (await rs(), this.player) return;
    const t = document.createElement("div"), e = !!this.target;
    this.target ? (t.style.cssText = "width:100%;height:100%;", this.target.appendChild(t)) : (this.hiddenContainer = document.createElement("div"), this.hiddenContainer.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;", document.body.appendChild(this.hiddenContainer), this.hiddenContainer.appendChild(t)), await new Promise((i) => {
      this.player = new window.YT.Player(t, {
        width: e ? "100%" : "1",
        height: e ? "100%" : "1",
        events: {
          onReady: () => i(),
          onStateChange: (r) => this.stateCallback(r.data),
          onError: (r) => this.errorCallback(r.data)
        }
      });
    });
  }
  cue(t) {
    var e;
    (e = this.player) == null || e.loadVideoById(t);
  }
  play() {
    var t;
    (t = this.player) == null || t.playVideo();
  }
  pause() {
    var t;
    (t = this.player) == null || t.pauseVideo();
  }
  seek(t) {
    var e;
    (e = this.player) == null || e.seekTo(t / 1e3, !0);
  }
  currentTimeMs() {
    var t, e;
    return (((e = (t = this.player) == null ? void 0 : t.getCurrentTime) == null ? void 0 : e.call(t)) ?? 0) * 1e3;
  }
  durationMs() {
    var t, e;
    return (((e = (t = this.player) == null ? void 0 : t.getDuration) == null ? void 0 : e.call(t)) ?? 0) * 1e3;
  }
  onState(t) {
    this.stateCallback = t;
  }
  onError(t) {
    this.errorCallback = t;
  }
  destroy() {
    var t, e, i;
    (e = (t = this.player) == null ? void 0 : t.destroy) == null || e.call(t), (i = this.hiddenContainer) == null || i.remove();
  }
}
class be extends Error {
  constructor(t = "Spotify account is not Premium") {
    super(t), this.name = "NotPremiumError";
  }
}
const as = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state"
  // required to control the SDK device via /me/player
], os = "https://accounts.spotify.com/authorize", ie = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
function ls(s = 64) {
  const t = new Uint8Array(s);
  crypto.getRandomValues(t);
  let e = "";
  for (const i of t) e += ie[i % ie.length];
  return e;
}
async function hs(s) {
  const t = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return ds(new Uint8Array(t));
}
function cs(s, t) {
  const e = new URL(os);
  return e.search = new URLSearchParams({
    response_type: "code",
    client_id: s.clientId,
    redirect_uri: s.redirectUri,
    scope: (s.scopes ?? as).join(" "),
    code_challenge_method: "S256",
    code_challenge: t
  }).toString(), e.toString();
}
function ds(s) {
  let t = "";
  for (const e of s) t += String.fromCharCode(e);
  return btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const us = "https://accounts.spotify.com/api/token", ps = 6e4;
class fs {
  constructor(t, e = localStorage) {
    this.clientId = t, this.storage = e;
  }
  key() {
    return `byom-spotify:${this.clientId}`;
  }
  load() {
    const t = this.storage.getItem(this.key());
    if (!t) return null;
    try {
      return JSON.parse(t);
    } catch {
      return null;
    }
  }
  save(t) {
    this.storage.setItem(this.key(), JSON.stringify(t));
  }
  clear() {
    this.storage.removeItem(this.key());
  }
}
async function ve(s, t, e) {
  const i = await fetch(us, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: s
  });
  if (!i.ok) throw new Error(`Spotify token endpoint returned ${i.status}`);
  const r = await i.json();
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token ?? e ?? "",
    expiresAt: t() + r.expires_in * 1e3
  };
}
function ms(s, t, e, i = Date.now) {
  return ve(
    new URLSearchParams({
      grant_type: "authorization_code",
      code: t,
      redirect_uri: s.redirectUri,
      client_id: s.clientId,
      code_verifier: e
    }),
    i
  );
}
function ys(s, t, e = Date.now) {
  return ve(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: t,
      client_id: s.clientId
    }),
    e,
    t
  );
}
class gs {
  constructor(t, e = {}) {
    this.cfg = t, this.store = e.store ?? new fs(t.clientId), this.win = e.win ?? window, this.now = e.now ?? Date.now;
  }
  hasToken() {
    return this.store.load() !== null;
  }
  // Clears the locally cached session. Spotify PKCE has no client-side token
  // revocation, so this ends the local session; it doesn't revoke server-side.
  logout() {
    this.store.clear();
  }
  async getValidToken() {
    const t = this.store.load();
    if (!t) return null;
    if (t.expiresAt - ps > this.now()) return t.accessToken;
    const e = await ys(this.cfg, t.refreshToken, this.now);
    return this.store.save(e), e.accessToken;
  }
  // Opens the authorize popup, awaits the code via postMessage, exchanges it.
  async login() {
    const t = ls(), e = await hs(t), i = this.win.open(
      cs(this.cfg, e),
      "spotify-login",
      "width=480,height=720"
    );
    if (!i) throw new Error("Spotify login popup was blocked");
    const r = await this.awaitCode(i), n = await ms(this.cfg, r, t, this.now);
    return this.store.save(n), n.accessToken;
  }
  awaitCode(t) {
    const e = new URL(this.cfg.redirectUri).origin;
    return new Promise((i, r) => {
      const n = (o) => {
        if (o.origin !== e || typeof o.data != "string") return;
        const h = new URLSearchParams(o.data), p = h.get("code"), c = h.get("error");
        !p && !c || (l(), c ? r(new Error(`Spotify authorization failed: ${c}`)) : i(p));
      }, a = setInterval(() => {
        t.closed && (l(), r(new Error("Spotify login popup was closed")));
      }, 500), l = () => {
        this.win.removeEventListener("message", n), clearInterval(a);
        try {
          t.close();
        } catch {
        }
      };
      this.win.addEventListener("message", n);
    });
  }
}
const bs = "https://sdk.scdn.co/spotify-player.js", vs = "https://api.spotify.com/v1/me/player/play";
let at = null;
function _s() {
  return at || (at = new Promise((s) => {
    if (window.Spotify) {
      s();
      return;
    }
    const t = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      t == null || t(), s();
    };
    const e = document.createElement("script");
    e.src = bs, document.head.appendChild(e);
  }), at);
}
let W = null, x = null;
function se(s) {
  x = s;
}
function ws(s) {
  return W || (W = (async () => {
    await _s();
    const t = new window.Spotify.Player({
      name: s,
      getOAuthToken: (e) => {
        x == null || x.token().then((i) => {
          i && e(i);
        });
      },
      volume: 1
    });
    t.addListener("player_state_changed", (e) => x == null ? void 0 : x.handleRawState(e));
    try {
      return await new Promise((e, i) => {
        t.addListener(
          "ready",
          ({ device_id: r }) => e({ player: t, deviceId: r })
        ), t.addListener(
          "account_error",
          ({ message: r }) => i(new be(r))
        ), t.addListener(
          "authentication_error",
          ({ message: r }) => i(new Error(`Spotify auth error: ${r}`))
        ), t.addListener(
          "initialization_error",
          ({ message: r }) => i(new Error(`Spotify init error: ${r}`))
        ), t.connect();
      });
    } catch (e) {
      throw W = null, e;
    }
  })(), W);
}
class ks {
  constructor(t, e) {
    this.cfg = t, this.getToken = e, this.player = null, this.deviceId = null, this.lastState = null, this.stateCb = () => {
    };
  }
  // Headless — no visible surface.
  attach() {
  }
  // Called by the shared Player to reach the active engine.
  token() {
    return this.getToken();
  }
  handleRawState(t) {
    this.lastState = t, t && this.stateCb(t.paused ? "paused" : "playing");
  }
  async ready() {
    se(this);
    const { player: t, deviceId: e } = await ws(this.cfg.deviceName ?? "byom-player");
    this.player = t, this.deviceId = e;
  }
  async load(t) {
    const e = await this.getToken();
    if (!e || !this.deviceId) throw new Error("Spotify device not ready");
    const i = await fetch(`${vs}?device_id=${encodeURIComponent(this.deviceId)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${e}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uris: [t] })
    });
    !i.ok && i.status !== 202 && i.status !== 204 && this.stateCb("error");
  }
  play() {
    var t;
    (t = this.player) == null || t.resume();
  }
  pause() {
    var t;
    (t = this.player) == null || t.pause();
  }
  seek(t) {
    var e;
    (e = this.player) == null || e.seek(t);
  }
  currentTimeMs() {
    var t;
    return ((t = this.lastState) == null ? void 0 : t.position) ?? 0;
  }
  durationMs() {
    var t;
    return ((t = this.lastState) == null ? void 0 : t.duration) ?? 0;
  }
  onState(t) {
    this.stateCb = t;
  }
  // Detach from the shared Player WITHOUT destroying it — recreating the SDK
  // Player breaks playback for the rest of the page (see the singleton note).
  // Pause so audio doesn't outlive the provider switch, and stop routing the
  // Player's callbacks to this now-defunct engine.
  destroy() {
    var t;
    (t = this.player) == null || t.pause(), x === this && se(null), this.player = null;
  }
}
const Ss = "https://open.spotify.com/embed/iframe-api/v1", $s = 750;
let ot = null;
function Cs() {
  return ot || (ot = new Promise((s) => {
    window.onSpotifyIframeApiReady = (e) => s(e);
    const t = document.createElement("script");
    t.src = Ss, document.head.appendChild(t);
  }), ot);
}
class Es {
  constructor() {
    this.controller = null, this.target = null, this.posMs = 0, this.durMs = 0, this.stateCb = () => {
    };
  }
  attach(t) {
    this.target = t;
  }
  async ready() {
    const t = await Cs(), e = this.target ?? document.body, i = document.createElement("div");
    e.appendChild(i), await new Promise((r) => {
      t.createController(i, { width: "100%", height: 152 }, (n) => {
        this.controller = n, n.addListener(
          "playback_update",
          (a) => {
            this.posMs = a.data.position, this.durMs = a.data.duration, this.durMs > 0 && this.posMs >= this.durMs - $s ? this.stateCb("ended") : this.stateCb(a.data.isPaused ? "paused" : "playing");
          }
        ), r();
      });
    });
  }
  async load(t) {
    var e;
    (e = this.controller) == null || e.loadUri(t);
  }
  play() {
    var t;
    (t = this.controller) == null || t.play();
  }
  pause() {
    var t;
    (t = this.controller) == null || t.pause();
  }
  seek(t) {
    var e;
    (e = this.controller) == null || e.seek(t / 1e3);
  }
  currentTimeMs() {
    return this.posMs;
  }
  durationMs() {
    return this.durMs;
  }
  onState(t) {
    this.stateCb = t;
  }
  destroy() {
    var t;
    (t = this.controller) == null || t.destroy(), this.controller = null;
  }
}
const As = 250;
function re(s) {
  if (!s) return null;
  const t = s.match(/^spotify:track:([A-Za-z0-9]+)/);
  if (t) return t[1];
  const e = s.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/);
  return e ? e[1] : null;
}
class xs {
  constructor(t) {
    this.name = "spotify", this.engine = null, this.target = null, this.disposed = !1, this.connected = !1, this.busy = !1, this.authCallback = () => {
    }, this.stateCallback = () => {
    }, this.progressCallback = () => {
    }, this.ticker = null, this.cfg = t, this.auth = this.cfg.auth ?? new gs(this.cfg);
  }
  attach(t) {
    this.target = t;
  }
  // Pick a playback tier: embed when forced; otherwise the SDK when a token is
  // available (falling back to embed for non-Premium), or the embed while
  // disconnected (the panel shows a Connect button to upgrade to the SDK).
  async initialize() {
    if (!this.canConnect) {
      await this.useEngine("embed"), this.stateCallback("ready");
      return;
    }
    await this.auth.getValidToken() ? await this.connectWithFallback() : await this.enterDisconnected();
  }
  // The SDK/OAuth tier needs a client id and mustn't be force-embedded.
  get canConnect() {
    return !this.cfg.forceEmbed && !!this.cfg.clientId;
  }
  // --- interactive auth (rendered declaratively by the host settings panel) ---
  getAuthState() {
    return this.canConnect ? this.connected ? {
      status: "Connected",
      actions: [{ id: "disconnect", label: "Disconnect Spotify" }],
      busy: this.busy
    } : {
      status: "Not connected",
      actions: [{ id: "connect", label: "Connect Spotify" }],
      busy: this.busy
    } : { actions: [] };
  }
  onAuthChange(t) {
    this.authCallback = t;
  }
  async runAuthAction(t) {
    if (t === "connect") {
      this.busy = !0, this.notifyAuth();
      try {
        await this.auth.login(), await this.connectWithFallback();
      } catch (e) {
        this.log("login failed", e), this.stateCallback("error");
      } finally {
        this.busy = !1, this.notifyAuth();
      }
    } else t === "disconnect" && (this.auth.logout(), await this.enterDisconnected());
  }
  notifyAuth() {
    this.authCallback();
  }
  // Disconnected: play through the embed (works for a viewer already signed into
  // Spotify — full tracks if Premium, 30s previews if free).
  async enterDisconnected() {
    await this.useEngine("embed"), this.connected = !1, this.notifyAuth(), this.stateCallback("ready");
  }
  // With a token in hand, try the SDK, falling back to the embed for non-Premium
  // accounts.
  async connectWithFallback() {
    try {
      await this.useEngine("sdk");
    } catch (t) {
      if (t instanceof be)
        this.log("account not premium — falling back to embed"), await this.useEngine("embed");
      else {
        this.log("sdk connect error", t), this.stateCallback("error");
        return;
      }
    }
    this.connected = !0, this.notifyAuth(), this.stateCallback("ready");
  }
  async load(t) {
    var i;
    const e = re(t.spotifyUrl);
    if (!e) {
      this.log("no spotify url", t.artist, "-", t.title), this.stateCallback("unavailable");
      return;
    }
    await ((i = this.engine) == null ? void 0 : i.load(`spotify:track:${e}`));
  }
  async play() {
    var t;
    (t = this.engine) == null || t.play();
  }
  pause() {
    var t;
    (t = this.engine) == null || t.pause();
  }
  seek(t) {
    var e;
    (e = this.engine) == null || e.seek(t);
  }
  onStateChange(t) {
    this.stateCallback = t;
  }
  onProgress(t) {
    this.progressCallback = t;
  }
  async checkAvailability(t) {
    return re(t.spotifyUrl) ? "available" : "unavailable";
  }
  // checkAvailability is a network-less parse of the track's Spotify URL in every
  // case (URL → available, none → unavailable), so the prescan never needs to
  // throttle — there's no server to be gentle with, whatever the answer.
  isResolutionCached() {
    return !0;
  }
  dispose() {
    var t;
    this.disposed = !0, this.stopTicker(), (t = this.engine) == null || t.destroy(), this.engine = null;
  }
  // --- internals ---
  makeEngine(t) {
    if (this.cfg.engineFactory)
      return this.cfg.engineFactory(t, () => this.auth.getValidToken());
    const e = () => this.auth.getValidToken();
    return t === "sdk" ? new ks(this.cfg, e) : new Es();
  }
  async useEngine(t) {
    var i;
    if (this.disposed) return;
    this.stopTicker(), (i = this.engine) == null || i.destroy(), this.engine = null, this.target && this.target.replaceChildren();
    const e = this.makeEngine(t);
    e.onState((r) => this.handleState(r)), this.target && e.attach(this.target), this.engine = e, await e.ready();
  }
  handleState(t) {
    this.stateCallback(t), t === "playing" ? this.startTicker() : this.stopTicker();
  }
  startTicker() {
    this.stopTicker(), this.tick(), this.ticker = setInterval(() => this.tick(), As);
  }
  tick() {
    this.engine && this.progressCallback(this.engine.currentTimeMs(), this.engine.durationMs());
  }
  stopTicker() {
    this.ticker && (clearInterval(this.ticker), this.ticker = null);
  }
  log(...t) {
    this.cfg.debug && console.debug("[byom-player:spotify]", ...t);
  }
}
const Ts = "byom-player", ct = "https://plex.tv/api/v2", Ps = "https://app.plex.tv/auth", ne = "byom-plex:client-id", lt = "byom-plex:session";
function Is(s = localStorage) {
  let t = s.getItem(ne);
  if (!t) {
    const e = new Uint8Array(16);
    crypto.getRandomValues(e), t = Array.from(e, (i) => i.toString(16).padStart(2, "0")).join(""), s.setItem(ne, t);
  }
  return t;
}
class Ms {
  constructor(t, e = {}) {
    this.fetch = e.fetch ?? fetch.bind(globalThis), this.win = e.win ?? window, this.storage = e.storage ?? localStorage, this.discover = e.discover ?? ((i) => this.defaultDiscover(i)), this.pollIntervalMs = e.pollIntervalMs ?? 1500, this.maxPolls = e.maxPolls ?? 120, this.product = t.product ?? Ts, this.serverName = t.serverName, this.clientId = Is(this.storage);
  }
  // Real discovery: resolve a single server to a session, or stash the account
  // token + server list so selectServer() can finish a multi-server pick.
  async defaultDiscover(t) {
    this.accountToken = t;
    const e = await Rs(
      { fetch: this.fetch, headers: this.headers() },
      t,
      { serverName: this.serverName }
    );
    return e.session ? e.session : (this.servers = e.servers ?? [], { servers: this.servers });
  }
  pendingServers() {
    return this.servers ?? [];
  }
  async selectServer(t) {
    if (!this.accountToken) throw new Error("link() must run before selectServer()");
    const r = (await (await this.fetch(`${ct}/resources?includeHttps=1`, {
      headers: { ...this.headers(), "X-Plex-Token": this.accountToken }
    })).json()).find((l) => l.clientIdentifier === t);
    if (!r) throw new Error("Unknown Plex server");
    const a = { baseUrl: await _e(
      this.fetch,
      this.headers(),
      r.connections,
      r.accessToken
    ), token: r.accessToken };
    return this.persist(a), a;
  }
  headers() {
    return {
      Accept: "application/json",
      "X-Plex-Product": this.product,
      "X-Plex-Client-Identifier": this.clientId,
      "X-Plex-Version": "1"
    };
  }
  hasSession() {
    return this.storage.getItem(lt) !== null;
  }
  async getSession() {
    const t = this.storage.getItem(lt);
    if (!t) return null;
    try {
      return JSON.parse(t);
    } catch {
      return null;
    }
  }
  logout() {
    this.storage.removeItem(lt);
  }
  persist(t) {
    this.storage.setItem(lt, JSON.stringify(t));
  }
  async link() {
    const t = await this.createPin(), e = `${Ps}#?clientID=${encodeURIComponent(this.clientId)}&code=${encodeURIComponent(
      t.code
    )}&context%5Bdevice%5D%5Bproduct%5D=${encodeURIComponent(this.product)}`, i = this.win.open(e, "plex-link", "width=600,height=720"), r = await this.pollForToken(t.id, i), n = await this.discover(r);
    "servers" in n || this.persist(n);
    try {
      i == null || i.close();
    } catch {
    }
    return n;
  }
  async createPin() {
    const t = await this.fetch(`${ct}/pins?strong=true`, {
      method: "POST",
      headers: this.headers()
    });
    if (!t.ok) throw new Error(`Plex pin request failed: ${t.status}`);
    const e = await t.json();
    return { id: e.id, code: e.code };
  }
  async pollForToken(t, e) {
    for (let i = 0; i < this.maxPolls; i++) {
      if (e != null && e.closed) throw new Error("Plex login popup was closed");
      const n = await (await this.fetch(`${ct}/pins/${t}`, { headers: this.headers() })).json();
      if (n.authToken) return n.authToken;
      await new Promise((a) => setTimeout(a, this.pollIntervalMs));
    }
    throw new Error("Plex authorization timed out");
  }
}
async function _e(s, t, e, i) {
  const r = [...e].sort((n, a) => Number(a.local) - Number(n.local));
  for (const n of r) {
    const a = n.uri.replace(/\/$/, "");
    try {
      if ((await s(`${a}/identity`, {
        headers: { ...t, "X-Plex-Token": i }
      })).ok) return a;
    } catch {
    }
  }
  throw new Error("No reachable Plex connection");
}
async function Rs(s, t, e) {
  const i = await s.fetch(`${ct}/resources?includeHttps=1`, {
    headers: { ...s.headers, "X-Plex-Token": t }
  });
  if (!i.ok) throw new Error(`Plex resources request failed: ${i.status}`);
  const n = (await i.json()).filter((o) => {
    var h;
    return (h = o.provides) == null ? void 0 : h.split(",").includes("server");
  });
  if (n.length === 0) throw new Error("No Plex servers on this account");
  let a;
  return e.serverName ? a = n.find((o) => o.name === e.serverName) : n.length === 1 && (a = n[0]), a ? { session: { baseUrl: await _e(
    s.fetch,
    s.headers,
    a.connections,
    a.accessToken
  ), token: a.accessToken } } : { servers: n.map((o) => ({ id: o.clientIdentifier, name: o.name })) };
}
function Ls(s) {
  var r, n, a, l;
  const t = s == null ? void 0 : s.MediaContainer;
  if (!t) return null;
  const e = Array.isArray(t.SearchResult) ? t.SearchResult.map((o) => o == null ? void 0 : o.Metadata) : [], i = Array.isArray(t.Metadata) ? t.Metadata : [];
  for (const o of [...e, ...i].filter(Boolean)) {
    if (o.type && o.type !== "track") continue;
    const h = (l = (a = (n = (r = o == null ? void 0 : o.Media) == null ? void 0 : r[0]) == null ? void 0 : n.Part) == null ? void 0 : a[0]) == null ? void 0 : l.key;
    if (typeof h == "string") return h;
  }
  return null;
}
class Os {
  constructor(t) {
    this.name = "plex", this.audio = new Audio(), this.listeners = new AbortController(), this.callback = () => {
    }, this.progressCallback = () => {
    }, this.base = "", this.token = "", this.resetCallback = () => {
    }, this.authStatus = "unlinked", this.pendingServers = [], this.busy = !1, this.authCallback = () => {
    }, this.currentTrack = null, this.currentKey = null, this.currentFromCache = !1, this.retriedStale = !1, this.hasPlayed = !1, this.cfg = t, this.base = (this.cfg.baseUrl ?? "").replace(/\/$/, ""), this.token = this.cfg.token ?? "", this.cache = this.cfg.cache === !1 ? null : this.cfg.resolutionCache ?? new _t(), this.auth = this.cfg.auth ?? (this.cfg.baseUrl && this.cfg.token ? void 0 : new Ms(this.cfg));
    const e = { signal: this.listeners.signal };
    this.audio.addEventListener(
      "playing",
      () => {
        this.hasPlayed = !0, this.callback("playing");
      },
      e
    ), this.audio.addEventListener("pause", () => this.callback("paused"), e), this.audio.addEventListener("ended", () => this.callback("ended"), e), this.audio.addEventListener("error", () => this.handleAudioError(), e), this.audio.addEventListener("timeupdate", () => this.emitProgress(), e), this.audio.addEventListener("durationchange", () => this.emitProgress(), e);
  }
  get scope() {
    return "plex:" + this.base;
  }
  // A usable session needs both a server and a token. Until then we must not
  // probe the server (the background prescan would 401 on every track).
  get authed() {
    return !!(this.base && this.token);
  }
  onReset(t) {
    this.resetCallback = t;
  }
  async initialize() {
    var e;
    if (this.base && this.token) {
      this.authStatus = "linked", this.callback("ready");
      return;
    }
    const t = await ((e = this.auth) == null ? void 0 : e.getSession());
    t ? (this.applySession(t), this.authStatus = "linked") : this.authStatus = "unlinked", this.notifyAuth(), this.callback("ready");
  }
  applySession(t) {
    this.base = t.baseUrl.replace(/\/$/, ""), this.token = t.token;
  }
  // --- interactive auth (rendered declaratively by the host settings panel) ---
  getAuthState() {
    return this.authStatus === "picker" ? {
      status: "Choose a server",
      actions: this.pendingServers.map((t) => ({ id: `server:${t.id}`, label: t.name })),
      busy: this.busy
    } : this.authStatus === "linked" ? {
      status: "Linked",
      actions: [{ id: "unlink", label: "Unlink Plex" }],
      busy: this.busy
    } : { status: "Not linked", actions: [{ id: "link", label: "Link Plex" }], busy: this.busy };
  }
  onAuthChange(t) {
    this.authCallback = t;
  }
  async runAuthAction(t) {
    if (t === "link") return this.link();
    if (t === "unlink") return this.unlink();
    if (t.startsWith("server:")) return this.pickServer(t.slice(7));
  }
  async link() {
    if (this.auth) {
      this.busy = !0, this.notifyAuth();
      try {
        const t = await this.auth.link();
        "servers" in t ? (this.pendingServers = t.servers, this.authStatus = "picker") : (this.applySession(t), this.authStatus = "linked", this.resetCallback());
      } catch (t) {
        this.log("link failed", t), this.callback("error");
      } finally {
        this.busy = !1, this.notifyAuth();
      }
    }
  }
  async pickServer(t) {
    var e;
    if ((e = this.auth) != null && e.selectServer) {
      this.busy = !0, this.notifyAuth();
      try {
        this.applySession(await this.auth.selectServer(t)), this.authStatus = "linked", this.resetCallback();
      } catch (i) {
        this.log("server select failed", i), this.callback("error");
      } finally {
        this.busy = !1, this.notifyAuth();
      }
    }
  }
  unlink() {
    var t;
    (t = this.auth) == null || t.logout(), this.base = "", this.token = "", this.audio.pause(), this.audio.removeAttribute("src"), this.authStatus = "unlinked", this.notifyAuth(), this.resetCallback(), this.callback("ready");
  }
  notifyAuth() {
    this.authCallback();
  }
  async load(t) {
    var i;
    this.currentTrack = t, this.currentKey = C(t), this.retriedStale = !1, this.hasPlayed = !1, this.currentFromCache = !!((i = this.cache) != null && i.get(this.scope, this.currentKey));
    let e;
    try {
      e = await this.resolve(t);
    } catch (r) {
      this.log("resolve error", t.artist, "-", t.title, r), this.callback("error");
      return;
    }
    if (!e) {
      this.log("not in library", t.artist, "-", t.title), this.callback("unavailable");
      return;
    }
    this.audio.src = this.streamUrl(e), this.callback("ready");
  }
  async play() {
    try {
      await this.audio.play();
    } catch {
      this.callback("error");
    }
  }
  pause() {
    this.audio.pause();
  }
  seek(t) {
    this.audio.currentTime = t / 1e3;
  }
  onStateChange(t) {
    this.callback = t;
  }
  onProgress(t) {
    this.progressCallback = t;
  }
  dispose() {
    this.listeners.abort(), this.audio.pause(), this.audio.removeAttribute("src"), this.audio.load();
  }
  async resolve(t) {
    var l, o, h;
    const e = C(t), i = (l = this.cache) == null ? void 0 : l.get(this.scope, e);
    if (i) return i;
    if (i === null) return null;
    const r = `${t.artist} ${t.title}`.trim(), n = await this.fetchJson(
      this.apiUrl("/library/search", { query: r, searchTypes: "music", limit: "5" })
    ), a = Ls(n);
    return a ? (o = this.cache) == null || o.set(this.scope, e, a) : (h = this.cache) == null || h.setMiss(this.scope, e), a;
  }
  async checkAvailability(t) {
    if (!this.authed) return "unknown";
    try {
      return await this.resolve(t) ? "available" : "unavailable";
    } catch {
      return "unknown";
    }
  }
  // Lets the availability prescan skip its cooldown when a check won't hit the
  // server: unlinked (checkAvailability short-circuits to 'unknown'), or a cached
  // hit / known miss.
  isResolutionCached(t) {
    var e;
    return this.authed ? ((e = this.cache) == null ? void 0 : e.get(this.scope, C(t))) !== void 0 : !0;
  }
  streamUrl(t) {
    const e = new URL(this.base + t);
    return e.searchParams.set("X-Plex-Token", this.token), e.toString();
  }
  apiUrl(t, e = {}) {
    const i = new URL(this.base + t);
    i.searchParams.set("X-Plex-Token", this.token);
    for (const [r, n] of Object.entries(e)) i.searchParams.set(r, n);
    return i.toString();
  }
  async fetchJson(t) {
    const e = this.cfg.retries ?? 2, i = this.cfg.retryDelayMs ?? 400;
    for (let r = 0; ; r++)
      try {
        const n = await fetch(t, { headers: { Accept: "application/json" } });
        if (!n.ok) throw new Error(`HTTP ${n.status}`);
        return await n.json();
      } catch (n) {
        if (r >= e) throw n;
        await new Promise((a) => setTimeout(a, i * (r + 1)));
      }
  }
  // A cached part key that errors before ever playing is likely stale (library
  // rescan changed part ids): evict and re-resolve once. Mirrors Subsonic.
  handleAudioError() {
    if (!this.hasPlayed && this.currentFromCache && !this.retriedStale && this.cache && this.currentTrack && this.currentKey) {
      this.retriedStale = !0, this.cache.evict(this.scope, this.currentKey), this.reloadFresh(this.currentTrack);
      return;
    }
    this.callback("error");
  }
  async reloadFresh(t) {
    this.currentFromCache = !1;
    let e;
    try {
      e = await this.resolve(t);
    } catch {
      this.callback("error");
      return;
    }
    if (!e) {
      this.callback("unavailable");
      return;
    }
    this.audio.src = this.streamUrl(e), this.play();
  }
  emitProgress() {
    const t = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
    this.progressCallback(this.audio.currentTime * 1e3, t * 1e3);
  }
  log(...t) {
    this.cfg.debug && console.debug("[byom-player:plex]", ...t);
  }
}
const zs = "mp3,aac,m4a,ogg,oga,opus,webm,wav", Us = "aac,mp3", ae = "byom-player:jellyfin:deviceId";
function we(s) {
  return typeof s == "string" ? s.toLowerCase().replace(/\s+/g, " ").trim() : "";
}
function Ds(s, t) {
  return t ? [
    ...Array.isArray(s.Artists) ? s.Artists : [],
    s.AlbumArtist
  ].map(we).some((i) => i && (i === t || i.includes(t) || t.includes(i))) : !1;
}
function Ns(s, t) {
  const e = s == null ? void 0 : s.Items;
  if (!Array.isArray(e)) return null;
  const i = e.filter(
    (a) => (!(a != null && a.Type) || a.Type === "Audio") && typeof (a == null ? void 0 : a.Id) == "string"
  );
  if (!i.length) return null;
  const r = we(t);
  return (i.find((a) => Ds(a, r)) ?? i[0]).Id;
}
class js {
  constructor(t) {
    this.name = "jellyfin", this.audio = new Audio(), this.listeners = new AbortController(), this.callback = () => {
    }, this.progressCallback = () => {
    }, this.base = "", this.token = "", this.userId = "", this.currentTrack = null, this.currentKey = null, this.currentFromCache = !1, this.retriedStale = !1, this.hasPlayed = !1, this.cfg = t, this.base = (this.cfg.baseUrl ?? "").replace(/\/$/, ""), this.token = this.cfg.token ?? "", this.userId = this.cfg.userId ?? "", this.deviceId = this.cfg.deviceId ?? Vs(), this.cache = this.cfg.cache === !1 ? null : this.cfg.resolutionCache ?? new _t();
    const e = { signal: this.listeners.signal };
    this.audio.addEventListener(
      "playing",
      () => {
        this.hasPlayed = !0, this.callback("playing");
      },
      e
    ), this.audio.addEventListener("pause", () => this.callback("paused"), e), this.audio.addEventListener("ended", () => this.callback("ended"), e), this.audio.addEventListener("error", () => this.handleAudioError(), e), this.audio.addEventListener("timeupdate", () => this.emitProgress(), e), this.audio.addEventListener("durationchange", () => this.emitProgress(), e);
  }
  get scope() {
    return "jellyfin:" + this.base;
  }
  // A usable session needs a server and a token. Until then we must not probe
  // the server (the background prescan would 401 on every track).
  get authed() {
    return !!(this.base && this.token);
  }
  async initialize() {
    if (this.authed) {
      this.callback("ready");
      return;
    }
    if (this.base && this.cfg.username && this.cfg.password)
      try {
        await this.authenticate(this.cfg.username, this.cfg.password);
      } catch (t) {
        this.log("authentication failed", t), this.callback("error");
        return;
      }
    this.callback("ready");
  }
  // POST /Users/AuthenticateByName -> { AccessToken, User: { Id } }. The initial
  // call carries only client identity in the Authorization header (no token yet).
  async authenticate(t, e) {
    var n;
    const i = await fetch(this.apiUrl("/Users/AuthenticateByName"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: this.authHeader()
      },
      body: JSON.stringify({ Username: t, Pw: e })
    });
    if (!i.ok) throw new Error(`HTTP ${i.status}`);
    const r = await i.json();
    if (!r.AccessToken) throw new Error("no AccessToken in auth response");
    this.token = r.AccessToken, this.userId = ((n = r.User) == null ? void 0 : n.Id) ?? this.userId;
  }
  // The Authorization header for the AuthenticateByName POST: client identity
  // only (no token yet). Once authenticated, all other requests carry the token
  // as an api_key query param instead (see apiUrl / streamUrl).
  authHeader() {
    return [
      `MediaBrowser Client="${this.cfg.clientName ?? "byom-player"}"`,
      `Device="${this.cfg.deviceName ?? "byom-player"}"`,
      `DeviceId="${this.deviceId}"`,
      `Version="${this.cfg.clientVersion ?? "0.1.0"}"`
    ].join(", ");
  }
  async load(t) {
    var i;
    this.currentTrack = t, this.currentKey = C(t), this.retriedStale = !1, this.hasPlayed = !1, this.currentFromCache = !!((i = this.cache) != null && i.get(this.scope, this.currentKey));
    let e;
    try {
      e = await this.resolve(t);
    } catch (r) {
      this.log("resolve error", t.artist, "-", t.title, r), this.callback("error");
      return;
    }
    if (!e) {
      this.log("not in library", t.artist, "-", t.title), this.callback("unavailable");
      return;
    }
    this.audio.src = this.streamUrl(e), this.callback("ready");
  }
  async play() {
    try {
      await this.audio.play();
    } catch {
      this.callback("error");
    }
  }
  pause() {
    this.audio.pause();
  }
  seek(t) {
    this.audio.currentTime = t / 1e3;
  }
  onStateChange(t) {
    this.callback = t;
  }
  onProgress(t) {
    this.progressCallback = t;
  }
  dispose() {
    this.listeners.abort(), this.audio.pause(), this.audio.removeAttribute("src"), this.audio.load();
  }
  // resolve: search the library for "{artist} {title}", return the first Audio
  // item's id. Caches hits; negative-caches misses.
  async resolve(t) {
    var l, o, h;
    const e = C(t), i = (l = this.cache) == null ? void 0 : l.get(this.scope, e);
    if (i) return i;
    if (i === null) return null;
    const r = {
      searchTerm: t.title.trim(),
      includeItemTypes: "Audio",
      recursive: "true",
      limit: "10",
      fields: "Artists"
    };
    this.userId && (r.userId = this.userId);
    const n = await this.fetchJson(this.apiUrl("/Items", r)), a = Ns(n, t.artist);
    return a ? (o = this.cache) == null || o.set(this.scope, e, a) : (h = this.cache) == null || h.setMiss(this.scope, e), a;
  }
  async checkAvailability(t) {
    if (!this.authed) return "unknown";
    try {
      return await this.resolve(t) ? "available" : "unavailable";
    } catch {
      return "unknown";
    }
  }
  // Lets the availability prescan skip its cooldown when a check won't hit the
  // server: unauthed (checkAvailability short-circuits to 'unknown'), or a
  // cached hit / known miss.
  isResolutionCached(t) {
    var e;
    return this.authed ? ((e = this.cache) == null ? void 0 : e.get(this.scope, C(t))) !== void 0 : !0;
  }
  // /Audio/{id}/universal streams with the token as a query param (an <audio>
  // src can't carry an Authorization header). The container/codec list lets
  // Jellyfin direct-play browser-friendly sources and transcode the rest.
  streamUrl(t) {
    const e = new URL(`${this.base}/Audio/${t}/universal`);
    return e.searchParams.set("api_key", this.token), e.searchParams.set("deviceId", this.deviceId), this.userId && e.searchParams.set("userId", this.userId), e.searchParams.set("container", zs), e.searchParams.set("audioCodec", Us), e.toString();
  }
  // API URLs carry the token as an api_key query param (like streamUrl). This
  // keeps GETs as simple CORS requests — no Authorization header means no
  // preflight — matching how the Subsonic/Navidrome provider authenticates.
  apiUrl(t, e = {}) {
    const i = new URL(this.base + t);
    this.token && i.searchParams.set("api_key", this.token);
    for (const [r, n] of Object.entries(e)) i.searchParams.set(r, n);
    return i.toString();
  }
  async fetchJson(t) {
    const e = await fetch(t, { headers: { Accept: "application/json" } });
    if (!e.ok) throw new Error(`HTTP ${e.status}`);
    return e.json();
  }
  // A cached id that errors before ever playing is likely stale (library rescan
  // changed item ids): evict and re-resolve once. Mirrors Plex/Subsonic.
  handleAudioError() {
    if (!this.hasPlayed && this.currentFromCache && !this.retriedStale && this.cache && this.currentTrack && this.currentKey) {
      this.retriedStale = !0, this.cache.evict(this.scope, this.currentKey), this.reloadFresh(this.currentTrack);
      return;
    }
    this.callback("error");
  }
  async reloadFresh(t) {
    this.currentFromCache = !1;
    let e;
    try {
      e = await this.resolve(t);
    } catch {
      this.callback("error");
      return;
    }
    if (!e) {
      this.callback("unavailable");
      return;
    }
    this.audio.src = this.streamUrl(e), this.play();
  }
  emitProgress() {
    const t = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
    this.progressCallback(this.audio.currentTime * 1e3, t * 1e3);
  }
  log(...t) {
    this.cfg.debug && console.debug("[byom-player:jellyfin]", ...t);
  }
}
function Vs() {
  try {
    const s = localStorage.getItem(ae);
    if (s) return s;
    const t = oe();
    return localStorage.setItem(ae, t), t;
  } catch {
    return oe();
  }
}
function oe() {
  const s = new Uint8Array(16);
  return crypto.getRandomValues(s), Array.from(s, (t) => t.toString(16).padStart(2, "0")).join("");
}
function Hs(s, t) {
  switch (s) {
    case "mock":
      return new xi();
    case "subsonic":
    case "direct":
      return new Bi(t);
    case "youtube":
      return new ss(t);
    case "spotify":
      return new xs(t);
    case "plex":
      return new Os(t);
    case "jellyfin":
      return new js(t);
    default:
      throw new Error(`Unknown audio provider: ${s}`);
  }
}
const Fs = 31e3, Bs = 5e3;
function Ks(s, t, e) {
  return s !== "spotify" ? !1 : t > 0 && t <= Fs && e > t + Bs;
}
class qs {
  constructor(t, e, i, r = {}) {
    var n, a;
    this.tracks = e, this.onResult = i, this.pending = [], this.queued = /* @__PURE__ */ new Set(), this.done = /* @__PURE__ */ new Set(), this.inFlight = null, this.draining = !1, this.disposed = !1, this.check = (n = t.checkAvailability) == null ? void 0 : n.bind(t), this.isCached = (a = t.isResolutionCached) == null ? void 0 : a.bind(t), this.delayMs = r.delayMs ?? 300;
  }
  request(t) {
    if (!this.check || this.disposed) return [];
    const e = [];
    for (const i of t)
      i < 0 || i >= this.tracks.length || this.done.has(i) || this.queued.has(i) || i === this.inFlight || (this.queued.add(i), this.pending.push(i), e.push(i));
    return e.length && this.drain(), e;
  }
  // Drop every queued-but-unstarted index that isn't in `keep`, returning the
  // dropped indices. Checked (`done`) indices and the one in-flight check are
  // untouched — the in-flight check finishes and caches its result. Dropped
  // indices become eligible again on a later request() (they were never checked).
  retain(t) {
    const e = [];
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const r = this.pending[i];
      t.has(r) || (this.pending.splice(i, 1), this.queued.delete(r), e.push(r));
    }
    return e;
  }
  dispose() {
    this.disposed = !0, this.pending.length = 0, this.queued.clear();
  }
  async drain() {
    var t;
    if (!(this.draining || !this.check)) {
      this.draining = !0;
      try {
        for (; this.pending.length && !this.disposed; ) {
          const e = this.pending.shift();
          this.queued.delete(e), this.inFlight = e;
          const i = ((t = this.isCached) == null ? void 0 : t.call(this, this.tracks[e])) ?? !1;
          let r;
          try {
            r = await this.check(this.tracks[e]);
          } catch {
            r = "unknown";
          }
          if (this.inFlight = null, this.disposed) return;
          this.done.add(e), this.onResult(e, r), this.delayMs > 0 && !i && this.pending.length && await new Promise((n) => setTimeout(n, this.delayMs));
        }
      } finally {
        this.draining = !1;
      }
    }
  }
}
const ke = "byom-player:settings:v1";
function Se(s) {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
function Ys(s) {
  const t = Se();
  if (!t) return { providers: {} };
  try {
    const e = t.getItem(ke);
    if (!e) return { providers: {} };
    const i = JSON.parse(e);
    return { ...i, providers: i.providers ?? {} };
  } catch {
    return { providers: {} };
  }
}
function Ws(s, t) {
  const e = Se();
  if (e)
    try {
      e.setItem(ke, JSON.stringify(s));
    } catch {
    }
}
function Js(s, t, e) {
  return { ...t[s] ?? {}, ...e.providers[s] ?? {} };
}
const Et = [
  "mock",
  "subsonic",
  "youtube",
  "spotify",
  "plex",
  "jellyfin"
];
function Qs(s) {
  if (!s) return [...Et];
  const t = s.split(",").map((e) => e.trim()).filter((e) => Et.includes(e));
  return t.length ? t : [...Et];
}
function Xs(s) {
  const t = [];
  for (const e of Array.from(s.querySelectorAll("byom-playlist"))) {
    const i = e.getAttribute("src");
    i && t.push({ title: e.getAttribute("title") ?? i, src: i });
  }
  return t;
}
function Gs(s, t, e) {
  const i = {};
  t && Object.keys(t).length && (i[e] = { ...t });
  const r = { ...i.spotify ?? {} };
  s.spotifyClientId && (r.clientId = s.spotifyClientId), s.spotifyRedirectUri && (r.redirectUri = s.spotifyRedirectUri), Object.keys(r).length && (i.spotify = r);
  const n = { ...i.youtube ?? {} };
  return s.youtubeApiKey && (n.apiKey = s.youtubeApiKey), s.youtubeSearchEndpoint && (n.searchEndpoint = s.youtubeSearchEndpoint), Object.keys(n).length && (i.youtube = n), i;
}
var Zs = Object.defineProperty, tr = Object.getOwnPropertyDescriptor, f = (s, t, e, i) => {
  for (var r = i > 1 ? void 0 : i ? tr(t, e) : t, n = s.length - 1, a; n >= 0; n--)
    (a = s[n]) && (r = (i ? a(t, e, r) : a(r)) || r);
  return i && r && Zs(t, e, r), r;
};
function er(s, t, e, i) {
  const r = s - (e - t) / 2, n = i - e;
  return Math.max(0, Math.min(r, n));
}
function ir(s, t) {
  var i;
  const e = t.trim().toLowerCase();
  return e ? s.title.toLowerCase().includes(e) || s.artist.toLowerCase().includes(e) || (((i = s.album) == null ? void 0 : i.toLowerCase().includes(e)) ?? !1) : !0;
}
function sr(s) {
  var t;
  return ((t = s.syncState) == null ? void 0 : t.spotifyPresent) === !1;
}
const rr = [
  { value: "", label: "Auto" },
  { value: "daylight", label: "Daylight" },
  { value: "midnight", label: "Midnight" },
  { value: "terminal", label: "Terminal" },
  { value: "sunset", label: "Sunset" },
  { value: "paper", label: "Paper" },
  { value: "dracula", label: "Dracula" }
], nr = {
  subsonic: [
    { key: "baseUrl", label: "Base URL" },
    { key: "username", label: "Username" },
    { key: "password", label: "Password", type: "password" },
    { key: "apiKey", label: "API key", advanced: !0 }
  ],
  plex: [
    { key: "baseUrl", label: "Base URL", advanced: !0 },
    { key: "token", label: "X-Plex-Token", advanced: !0 }
  ],
  jellyfin: [
    { key: "baseUrl", label: "Base URL" },
    { key: "username", label: "Username" },
    { key: "password", label: "Password", type: "password" },
    { key: "token", label: "API token", advanced: !0 },
    { key: "userId", label: "User ID", advanced: !0 }
  ],
  youtube: [],
  spotify: [],
  mock: []
};
let d = class extends N {
  constructor() {
    super(...arguments), this.src = "", this.provider = "mock", this.theme = "", this.providerConfig = {}, this.skipDelayMs = 400, this.debug = !1, this.prescan = !0, this.prescanDelayMs = 300, this.providers = "", this.noSettings = !1, this.spotifyClientId = "", this.spotifyRedirectUri = "", this.youtubeApiKey = "", this.youtubeSearchEndpoint = "", this.playlist = null, this.currentIndex = 0, this.playbackState = "uninitialized", this.failed = /* @__PURE__ */ new Set(), this.halted = !1, this.shuffle = !1, this.availability = /* @__PURE__ */ new Map(), this.checking = /* @__PURE__ */ new Set(), this.positionMs = 0, this.durationMs = 0, this.preview = !1, this.playlists = [], this.view = "list", this.videoExpanded = !1, this.descExpanded = !1, this.descOverflows = !1, this.draft = { providers: {} }, this.authState = null, this.filterQuery = "", this.settings = { providers: {} }, this.deployment = {}, this.controller = null, this.activeProvider = null, this.availQueue = null, this.seeking = !1, this.lastRange = null, this.centerToken = 0, this.commitTimer = null, this.commitDelayMs = 600, this.onGlobalKeydown = (s) => {
      var t;
      s.key !== "/" || s.metaKey || s.ctrlKey || s.altKey || this.view === "list" && (this.isEditable(this.deepActiveElement()) || (s.preventDefault(), (t = this.renderRoot.querySelector(".filter-input")) == null || t.focus()));
    }, this.onRangeChanged = (s) => {
      const { first: t, last: e } = s;
      typeof t != "number" || typeof e != "number" || t < 0 || (this.lastRange = { first: t, last: e }, this.syncAvailabilityChecks());
    };
  }
  async connectedCallback() {
    super.connectedCallback(), document.addEventListener("keydown", this.onGlobalKeydown), typeof ResizeObserver < "u" && !this.descResizeObserver && (this.descResizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => this.measureDescOverflow());
    }), this.descResizeObserver.observe(this)), this.settings = Ys(), this.settings.theme && (this.theme = this.settings.theme), this.playlists = Xs(this), this.playlists.length && !this.src && (this.src = this.playlists[0].src), this.settings.provider && (this.provider = this.settings.provider), this.deployment = Gs(
      {
        spotifyClientId: this.spotifyClientId || void 0,
        spotifyRedirectUri: this.spotifyRedirectUri || void 0,
        youtubeApiKey: this.youtubeApiKey || void 0,
        youtubeSearchEndpoint: this.youtubeSearchEndpoint || void 0
      },
      this.providerConfig,
      this.provider
    ), await this.loadAndInit();
  }
  // The set of providers the user may select in the panel.
  get allowedProviders() {
    return Qs(this.providers || null);
  }
  openSettings() {
    this.draft = {
      provider: this.provider,
      debug: this.debug,
      theme: this.theme,
      providers: structuredClone(this.settings.providers)
    }, this.view = "settings";
  }
  closeSettings() {
    this.flushCommit(), this.view = "list";
  }
  async refreshAvailability() {
    try {
      localStorage.removeItem("byom-player:resolv:v1");
    } catch {
    }
    await this.initProvider();
  }
  onDraftDebug(s) {
    this.draft = { ...this.draft, debug: s.currentTarget.checked }, this.commitSettings();
  }
  onDraftTheme(s) {
    this.draft = { ...this.draft, theme: s.currentTarget.value }, this.commitSettings();
  }
  // Run an interactive-auth action on the active provider (Connect/Link/etc.).
  // The provider fires onAuthChange, which refreshes this.authState → re-render.
  async runAuth(s) {
    var t, e;
    await ((e = (t = this.activeProvider) == null ? void 0 : t.runAuthAction) == null ? void 0 : e.call(t, s));
  }
  // Selecting a provider commits immediately so its connection UI (Spotify
  // Connect, Plex Link) appears inline without waiting for a debounce.
  async onDraftProvider(s) {
    this.draft = { ...this.draft, provider: s.currentTarget.value }, await this.commitSettings();
  }
  // Credential edits auto-commit after a short debounce — there is no Apply
  // button; the settings apply live.
  onDraftField(s, t, e) {
    const i = e.currentTarget.value, r = {
      ...this.draft.providers,
      [s]: { ...this.draft.providers[s], [t]: i }
    };
    this.draft = { ...this.draft, providers: r }, this.scheduleCommit();
  }
  scheduleCommit() {
    this.commitTimer && clearTimeout(this.commitTimer), this.commitTimer = setTimeout(() => {
      this.commitTimer = null, this.commitSettings();
    }, this.commitDelayMs);
  }
  flushCommit() {
    this.commitTimer && (clearTimeout(this.commitTimer), this.commitTimer = null, this.commitSettings());
  }
  // Persist the draft as the active settings and re-initialize the provider in
  // place. Does NOT close the panel — settings apply live.
  async commitSettings() {
    this.settings = {
      provider: this.draft.provider,
      debug: this.draft.debug,
      theme: this.draft.theme,
      providers: this.draft.providers
    }, Ws(this.settings), this.debug = this.settings.debug ?? !1, this.theme = this.draft.theme ?? "", this.draft.provider && (this.provider = this.draft.provider), this.dispatchEvent(
      new CustomEvent("settingschange", { detail: this.settings, bubbles: !0, composed: !0 })
    ), await this.initProvider();
  }
  disconnectedCallback() {
    var s, t, e;
    super.disconnectedCallback(), document.removeEventListener("keydown", this.onGlobalKeydown), this.commitTimer && clearTimeout(this.commitTimer), this.commitTimer = null, (s = this.availQueue) == null || s.dispose(), this.availQueue = null, (t = this.controller) == null || t.dispose(), this.controller = null, (e = this.descResizeObserver) == null || e.disconnect(), this.descResizeObserver = void 0;
  }
  // On a provider session change (link/unlink), drop stale availability: un-mark
  // the controller's skip-set, clear the displayed marks, then re-scan against
  // the new session (unlinked → quick 'unknown's; relinked → fresh results).
  handleProviderReset() {
    var s;
    for (const [t, e] of this.availability)
      e === "unavailable" && ((s = this.controller) == null || s.markUnavailable(t, !1));
    this.availability = /* @__PURE__ */ new Map(), this.failed = /* @__PURE__ */ new Set(), this.armAvailabilityQueue();
  }
  async loadAndInit() {
    this.src && await this.loadPlaylist() && await this.initProvider();
  }
  // Fetch + parse the manifest at this.src. Returns false (and flags error) on
  // failure. Split out so a playlist switch can reload without touching the
  // provider, and a provider switch can re-init without refetching.
  async loadPlaylist() {
    this.availability = /* @__PURE__ */ new Map();
    try {
      const s = await fetch(this.src);
      return this.playlist = $e(await s.json()), !0;
    } catch {
      return this.playbackState = "error", !1;
    }
  }
  // Effective provider config. Extended in later tasks to merge deployment
  // defaults + user settings; for now preserves the pre-panel behavior.
  buildEffectiveConfig() {
    const s = Js(this.provider, this.deployment, this.settings);
    return this.debug ? { ...s, debug: !0 } : s;
  }
  // Build + initialize the active provider, wire the controller, arm the
  // availability queue. Disposes any existing provider/controller first so this
  // is safe to call on a settings change (no element remount).
  async initProvider() {
    var e, i, r, n;
    if (!this.playlist) return;
    (e = this.controller) == null || e.dispose(), this.controller = null, this.availability = /* @__PURE__ */ new Map(), this.failed = /* @__PURE__ */ new Set(), await this.updateComplete, (i = this.renderRoot.querySelector(".video")) == null || i.replaceChildren(), this.activeProvider = null, this.authState = null;
    const s = this.providerFactory ?? Hs;
    let t;
    try {
      t = s(this.provider, this.buildEffectiveConfig());
    } catch (a) {
      this.debug && console.debug("[byom-player] provider construction failed", a), this.playbackState = "error";
      return;
    }
    if (this.activeProvider = t, t.getAuthState ? ((r = t.onAuthChange) == null || r.call(t, () => {
      var a;
      this.activeProvider === t && (this.authState = ((a = t.getAuthState) == null ? void 0 : a.call(t)) ?? null);
    }), this.authState = t.getAuthState()) : this.authState = null, t.attach) {
      await this.updateComplete;
      const a = this.renderRoot.querySelector(".video");
      a && t.attach(a);
    }
    try {
      await t.initialize();
    } catch (a) {
      this.debug && console.debug("[byom-player] provider initialize failed", a), this.playbackState = "error";
    }
    t.getAuthState && (this.authState = t.getAuthState()), this.controller = new Ai(
      t,
      this.playlist.tracks,
      () => this.syncFromController(),
      { skipDelayMs: this.skipDelayMs, debug: this.debug }
    ), (n = t.onReset) == null || n.call(t, () => this.handleProviderReset()), this.armAvailabilityQueue();
  }
  // (Re)create the availability queue for the active provider and seed it with
  // the tracks worth checking right now: a lookahead window around the current
  // track plus whatever the virtualizer last reported as visible. Safe to call
  // on init and on a provider/session reset.
  armAvailabilityQueue() {
    var t;
    (t = this.availQueue) == null || t.dispose(), this.availQueue = null, this.checking = /* @__PURE__ */ new Set();
    const s = this.activeProvider;
    !(s != null && s.checkAvailability) || !this.prescan || !this.playlist || (this.availQueue = new qs(
      s,
      this.playlist.tracks,
      (e, i) => this.onAvailabilityResult(e, i),
      { delayMs: this.prescanDelayMs }
    ), this.syncAvailabilityChecks());
  }
  onAvailabilityResult(s, t) {
    var e;
    if (this.availability = new Map(this.availability).set(s, t), this.checking.has(s)) {
      const i = new Set(this.checking);
      i.delete(s), this.checking = i;
    }
    t === "unavailable" && ((e = this.controller) == null || e.markUnavailable(s, !0));
  }
  // Enqueue real track indices and reflect the newly-accepted ones as in-flight.
  enqueueChecks(s) {
    var i;
    const t = ((i = this.availQueue) == null ? void 0 : i.request(s)) ?? [];
    if (!t.length) return;
    const e = new Set(this.checking);
    for (const r of t) e.add(r);
    this.checking = e;
  }
  // The set of tracks worth checking right now: the visible range plus a small
  // forward lookahead around the playing track (playback advances forward, even
  // when scrolled away).
  relevantCheckWindow() {
    const s = /* @__PURE__ */ new Set();
    if (this.lastRange) {
      const t = this.filteredRows, e = Math.max(0, this.lastRange.first);
      for (let i = e; i <= this.lastRange.last && i < t.length; i++) s.add(t[i].i);
    }
    for (let t = this.currentIndex; t < this.currentIndex + d.AVAIL_LOOKAHEAD; t++)
      t >= 0 && s.add(t);
    return s;
  }
  // Focus the availability queue on the currently-relevant window: prune queued
  // checks that have scrolled out of view (so a fast scroll through a
  // search-backed playlist doesn't leave a long tail of live searches for rows
  // you've left), then enqueue the window. Called on init, on range change, and
  // on track change. Visible rows are added before the lookahead, so they're
  // checked first.
  syncAvailabilityChecks() {
    const s = this.availQueue;
    if (!s) return;
    const t = this.relevantCheckWindow(), e = s.retain(t);
    if (e.length) {
      const i = new Set(this.checking);
      for (const r of e) i.delete(r);
      this.checking = i;
    }
    this.enqueueChecks([...t]);
  }
  syncFromController() {
    var s, t;
    this.controller && (this.currentIndex = this.controller.index, this.playbackState = this.controller.state, this.failed = new Set(this.controller.failed), this.halted = this.controller.halted, this.shuffle = this.controller.shuffle, this.durationMs = this.controller.durationMs, this.preview = Ks(
      this.provider,
      this.durationMs,
      ((t = (s = this.playlist) == null ? void 0 : s.tracks[this.currentIndex]) == null ? void 0 : t.durationMs) ?? 0
    ), this.seeking || (this.positionMs = this.controller.positionMs));
  }
  updated(s) {
    s.has("currentIndex") && (this.centerActiveTrack(), this.syncAvailabilityChecks()), s.has("playlist") && (this.descExpanded = !1, this.updateComplete.then(() => this.measureDescOverflow()));
  }
  // Scroll the virtualized list so the active row is centered.
  //
  // We identify the target row by its POSITION in the filtered list, not by the
  // rendered `active` class. The <lit-virtualizer> re-renders row content (which
  // row carries `active`) on its own async cycle, so at the moment this runs the
  // `active` class is often still on the previous row — reading it would center
  // one row behind on every advance. Row *positions*, however, don't change when
  // currentIndex changes, and the virtualizer reports its rendered range via
  // rangeChanged (captured as `lastRange`), with DOM rows in position order. So
  // the rendered <li> for position `pos` is querySelectorAll('li')[pos - first]
  // — the correct element regardless of the content re-render timing.
  //
  // We then MEASURE that row's real offset and center it (computeCenterOffset,
  // pure/unit-tested) — never predict pos * rowHeight, whose sub-pixel error
  // accumulates the deeper you jump. For a far jump whose target isn't rendered
  // yet, approximate the scroll to bring it into the window, then center it
  // exactly once the virtualizer has rendered it (polled over a few frames).
  //
  // No-op if the active track is filtered out, the list is empty, or there's no
  // layout engine (happy-dom in tests → scrollHeight 0).
  centerActiveTrack() {
    const s = ++this.centerToken, t = this.filteredRows.length, e = this.filteredRows.findIndex((l) => l.i === this.currentIndex);
    if (e < 0 || t === 0) return;
    const i = this.renderRoot.querySelector(".tracklist");
    if (!i || i.scrollHeight <= 0) return;
    const r = (l) => {
      var b;
      const o = this.lastRange;
      if (!o || e < o.first || e > o.last) return !1;
      const h = i.querySelectorAll("li");
      if (h.length !== o.last - o.first + 1) return !1;
      const p = h[e - o.first];
      if (!p) return !1;
      const c = p.getBoundingClientRect(), m = c.top - i.getBoundingClientRect().top + i.scrollTop, u = er(
        m,
        c.height,
        i.clientHeight,
        i.scrollHeight
      );
      return (b = i.scrollTo) == null || b.call(i, { top: u, behavior: l }), !0;
    };
    if (r("smooth")) return;
    i.scrollTop = Math.max(
      0,
      e * i.scrollHeight / t - i.clientHeight / 2
    );
    let n = 0;
    const a = () => {
      this.centerToken === s && (r("auto") || ++n > 20 || requestAnimationFrame(a));
    };
    requestAnimationFrame(a);
  }
  selectTrack(s) {
    var t;
    (t = this.controller) == null || t.start(s);
  }
  // The active row's number is the play/pause control, so clicking it toggles
  // playback instead of restarting; any other row selects + plays.
  onRowClick(s) {
    s === this.currentIndex ? this.togglePlay() : this.selectTrack(s);
  }
  // "{author} · {n} tracks · {total duration} · {created – updated}", each part
  // conditional. The author is a <span part="creator"> so skins can still target
  // it after the merge; its styling is uniform with the rest of the line.
  renderMetaLine(s) {
    const t = [`${s.tracks.length} ${s.tracks.length === 1 ? "track" : "tracks"}`], e = Si(s.tracks);
    e != null && t.push($i(e));
    const i = Ei(s.dateCreated, s.dateUpdated);
    i && t.push(i);
    const r = t.join(" · ");
    return g`<p class="meta-line" part="meta-line">
      ${s.creator ? g`<span class="author" part="creator">${s.creator}</span>${r ? " · " : ""}` : y}${r}
    </p>`;
  }
  async onPlaylistChange(s) {
    const t = s.currentTarget.value;
    t !== this.src && (this.src = t, await this.loadPlaylist() && await this.initProvider());
  }
  // Derived, filtered view — never mutates pl.tracks or playback indices. Each
  // row carries its real pl.tracks index so selection maps back correctly.
  get filteredRows() {
    const s = this.playlist;
    return s ? s.tracks.map((t, e) => ({ t, i: e })).filter(({ t }) => ir(t, this.filterQuery)) : [];
  }
  onFilterInput(s) {
    this.filterQuery = s.currentTarget.value;
  }
  clearFilter() {
    var s;
    this.filterQuery = "", (s = this.renderRoot.querySelector(".filter-input")) == null || s.focus();
  }
  onFilterKeydown(s) {
    s.key === "Escape" && (this.filterQuery = "", s.currentTarget.blur());
  }
  // The deepest focused element, piercing shadow roots — focus inside a shadow
  // tree surfaces as the host element in document.activeElement.
  deepActiveElement() {
    var t;
    let s = document.activeElement;
    for (; (t = s == null ? void 0 : s.shadowRoot) != null && t.activeElement; ) s = s.shadowRoot.activeElement;
    return s;
  }
  isEditable(s) {
    if (!s) return !1;
    const t = s.tagName;
    return t === "INPUT" || t === "TEXTAREA" || s.isContentEditable;
  }
  togglePlay() {
    var s, t;
    this.playbackState === "playing" ? (s = this.controller) == null || s.pause() : (t = this.controller) == null || t.play();
  }
  next() {
    var s;
    (s = this.controller) == null || s.next();
  }
  prev() {
    var s;
    (s = this.controller) == null || s.prev();
  }
  toggleShuffle() {
    this.controller && this.controller.setShuffle(!this.controller.shuffle);
  }
  toggleVideoExpanded() {
    this.videoExpanded = !this.videoExpanded;
  }
  toggleDescExpanded() {
    this.descExpanded = !this.descExpanded, this.descExpanded || this.updateComplete.then(() => this.measureDescOverflow());
  }
  // Whether the collapsed description overflows its capped (max-height) box.
  // Only meaningful while collapsed: an expanded description has no clamp, so we
  // leave the last value in place to keep the "less" toggle available.
  // happy-dom (tests) has no layout engine → heights are 0 → stays false.
  measureDescOverflow() {
    if (this.descExpanded) return;
    const s = this.renderRoot.querySelector(".description");
    this.descOverflows = s ? s.scrollHeight > s.clientHeight + 1 : !1;
  }
  onSeekInput() {
    this.seeking = !0;
  }
  onSeekChange(s) {
    var e;
    const t = Number(s.currentTarget.value);
    this.seeking = !1, (e = this.controller) == null || e.seek(t);
  }
  static formatTime(s) {
    const t = Math.max(0, Math.floor(s / 1e3)), e = Math.floor(t / 60), i = String(t % 60).padStart(2, "0");
    return `${e}:${i}`;
  }
  trackClasses(s, t) {
    const e = this.failed.has(s) || this.availability.get(s) === "unavailable", i = this.checking.has(s);
    return [
      s === this.currentIndex ? "active" : "",
      t ? "orphan" : "",
      e ? "unavailable" : "",
      i ? "pending" : ""
    ].filter(Boolean).join(" ");
  }
  // The single dominant state for the track part's `data-state` attribute.
  // active dominates (a playing row reads as active even if orphaned), then
  // unavailable, orphan, pending — mirroring the visual precedence.
  trackState(s, t) {
    const e = this.failed.has(s) || this.availability.get(s) === "unavailable", i = this.checking.has(s);
    return s === this.currentIndex ? "active" : e ? "unavailable" : t ? "orphan" : i ? "pending" : "";
  }
  // The per-row template, rendered by the virtualizer for each visible item.
  renderRow(s, t, e) {
    const i = sr(s), r = this.trackState(t, i), n = r === "active" && e ? "⏸︎" : "▶︎";
    return g`
      <li
        class=${this.trackClasses(t, i)}
        part="track"
        role="listitem"
        data-state=${r}
        @click=${() => this.onRowClick(t)}
      >
        <span class="num" part="track-number">
          <span class="idx">${r === "pending" ? "⋯" : t + 1}</span>
          <span class="glyph">${n}</span>
        </span>
        <span class="thumb" part="track-art">
          ${s.image ? g`<img src=${s.image} alt="" loading="lazy" />` : g`<span class="thumb-ph" aria-hidden="true">♪</span>`}
        </span>
        <span class="cell">
          <span class="t-title">${s.title}</span>
          <span class="t-artist">${s.artist}</span>
        </span>
        <span class="dur"
          >${r === "unavailable" ? "✕" : s.durationMs ? d.formatTime(s.durationMs) : ""}</span
        >
      </li>
    `;
  }
  render() {
    var n;
    const s = this.playlist;
    if (!s) return g`<div class="loading">Loading…</div>`;
    const t = this.filterQuery.trim(), e = this.filteredRows, i = this.playbackState === "playing", r = ((n = this.playlists.find((a) => a.src === this.src)) == null ? void 0 : n.title) ?? s.title;
    return g`
      <div class="root" part="root">
        <div class="head" part="header">
          <div class="art" part="art">
            ${s.image ? g`<img class="art-img" src=${s.image} alt="" />` : g`<span class="art-ph" aria-hidden="true">🎵</span>`}
          </div>
          <div class="meta" part="meta">
            ${this.playlists.length > 1 ? g`<div class="title-wrap" part="title">
                    <h2 class="title title--switch">
                      ${r}<span class="caret" aria-hidden="true">▾</span>
                    </h2>
                    <select
                      class="title-select"
                      aria-label="Playlist"
                      @change=${this.onPlaylistChange}
                    >
                      ${this.playlists.map(
      (a) => g`<option value=${a.src} ?selected=${a.src === this.src}>
                            ${a.title}
                          </option>`
    )}
                    </select>
                  </div>` : g`<h2 class="title" part="title">${s.title}</h2>`}
            ${this.renderMetaLine(s)}
          </div>
          ${s.annotation ? g`<div class="desc-block" part="description-block">
                  <div
                    class="description ${this.descExpanded ? "" : "is-collapsed"}"
                    part="description"
                  >
                    ${ei(ki(s.annotation))}
                  </div>
                  ${this.descOverflows ? g`<button
                          class="desc-toggle"
                          part="control description-toggle"
                          @click=${this.toggleDescExpanded}
                          aria-expanded=${this.descExpanded ? "true" : "false"}
                        >
                          ${this.descExpanded ? "▴ less" : "▾ more"}
                        </button>` : y}
                </div>` : y}
          ${this.noSettings ? y : g`<button
                  class="gear"
                  part="control gear"
                  @click=${this.openSettings}
                  aria-label="Settings"
                  title="Settings"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="3"></circle>
                    <path
                      d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                    ></path>
                  </svg>
                </button>`}
        </div>
        <div class="transport" part="transport">
          <div class="ctl-group">
            <button class="prev" part="control prev" @click=${this.prev} aria-label="Previous">
              ${"⏮︎"}
            </button>
            <button
              class="playpause"
              part="control play"
              @click=${this.togglePlay}
              aria-label="Play/Pause"
            >
              ${i ? "⏸︎" : "▶︎"}
            </button>
            <button class="next" part="control next" @click=${this.next} aria-label="Next">
              ${"⏭︎"}
            </button>
          </div>
          <div class="seek" part="progress">
            <span class="time">${d.formatTime(this.positionMs)}</span>
            <input
              class="progress"
              part="seek"
              type="range"
              min="0"
              max=${this.durationMs || 0}
              .value=${String(this.positionMs)}
              ?disabled=${!this.durationMs}
              aria-label="Seek"
              @input=${this.onSeekInput}
              @change=${this.onSeekChange}
            />
            <span class="time">${d.formatTime(this.durationMs)}</span>
          </div>
          ${this.preview ? g`<span
                  class="preview-badge"
                  part="preview-badge"
                  title="If you're signed into Spotify Premium in this browser, press ▶ in the Spotify player below for the full track."
                  >Preview · 30s ⓘ</span
                >` : y}
          <button
            class="shuffle ${this.shuffle ? "on" : ""}"
            part="control shuffle"
            @click=${this.toggleShuffle}
            aria-label="Shuffle"
            aria-pressed=${this.shuffle ? "true" : "false"}
            title=${this.shuffle ? "Shuffle: on" : "Shuffle: off"}
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <polyline points="16 3 21 3 21 8"></polyline>
              <line x1="4" y1="20" x2="21" y2="3"></line>
              <polyline points="21 16 21 21 16 21"></polyline>
              <line x1="15" y1="15" x2="21" y2="21"></line>
              <line x1="4" y1="4" x2="9" y2="9"></line>
            </svg>
          </button>
        </div>
        <div class="status">
          ${this.halted ? g`<span class="halted"
                  >Playback stopped after repeated errors — pick a track to retry.</span
                >` : y}
        </div>
        <div class="filter-row" part="filter">
          <input
            class="filter-input"
            part="filter-input"
            type="text"
            placeholder="Filter tracks…"
            .value=${this.filterQuery}
            aria-label="Filter tracks"
            @input=${this.onFilterInput}
            @keydown=${this.onFilterKeydown}
          />
          ${this.filterQuery ? g`<button
                  class="filter-clear"
                  part="filter-clear"
                  @click=${this.clearFilter}
                  aria-label="Clear filter"
                >
                  ×
                </button>` : y}
        </div>
        <div class="stage ${this.videoExpanded ? "video-expanded" : ""}" part="stage">
          <div class="tracklist-empty">
            ${e.length === 0 && t ? g`<p class="no-matches">No tracks match "${t}"</p>` : y}
          </div>
          <div class="tracklist" part="tracklist">
            <lit-virtualizer
              role="list"
              .items=${e}
              .keyFunction=${(a) => a.i}
              .renderItem=${(a) => this.renderRow(a.t, a.i, i)}
              @rangeChanged=${this.onRangeChanged}
            ></lit-virtualizer>
          </div>
          <div class="video-wrap" part="video-wrap">
            <div class="video" part="video"></div>
            <button
              class="video-toggle"
              part="video-toggle"
              type="button"
              @click=${this.toggleVideoExpanded}
              aria-expanded=${this.videoExpanded ? "true" : "false"}
              aria-label=${this.videoExpanded ? "Collapse video" : "Expand video"}
              title=${this.videoExpanded ? "Collapse video" : "Expand video"}
            >
              ${this.videoExpanded ? "×" : "⤢"}
            </button>
          </div>
        </div>
      </div>
      <div class="settings-overlay" ?hidden=${this.view === "list"} @click=${this.onOverlayClick}>
        ${this.renderSettings()}
      </div>
    `;
  }
  // Close when the backdrop (not the settings card) is clicked.
  onOverlayClick(s) {
    s.target.classList.contains("settings-overlay") && this.closeSettings();
  }
  renderField(s, t) {
    var e;
    return g`<label class="field">
      <span>${t.label}</span>
      <input
        name=${t.key}
        type=${t.type ?? "text"}
        autocomplete="off"
        .value=${((e = this.draft.providers[s]) == null ? void 0 : e[t.key]) ?? ""}
        @input=${(i) => this.onDraftField(s, t.key, i)}
      />
    </label>`;
  }
  renderSettings() {
    const s = this.draft.provider ?? this.provider, t = nr[s] ?? [], e = t.filter((r) => !r.advanced), i = t.filter((r) => r.advanced);
    return g`
      <div
        class="settings ${this.view === "settings" ? "open" : ""}"
        part="settings"
        role="dialog"
        aria-modal="true"
      >
        <div class="settings-head">
          <button class="settings-back" @click=${this.closeSettings} aria-label="Back">←</button>
          <span class="settings-title">Settings</span>
        </div>
        <label class="field">
          <span>Appearance</span>
          <select
            class="theme-select"
            .value=${this.draft.theme ?? ""}
            @change=${this.onDraftTheme}
          >
            ${rr.map(
      (r) => g`<option value=${r.value} ?selected=${r.value === (this.draft.theme ?? "")}>
                  ${r.label}
                </option>`
    )}
          </select>
        </label>
        <label class="field">
          <span>Provider</span>
          <select class="provider-select" .value=${s} @change=${this.onDraftProvider}>
            ${this.allowedProviders.map((r) => g`<option value=${r} ?selected=${r === s}>${r}</option>`)}
          </select>
        </label>
        ${e.length ? g`<div class="provider-fields">
                ${e.map((r) => this.renderField(s, r))}
              </div>` : y}
        ${this.authState && this.authState.actions.length ? g`<div class="settings-connection">
                <span class="settings-label">Connection</span>
                ${this.authState.status ? g`<span class="auth-status">${this.authState.status}</span>` : y}
                <div class="auth-actions">
                  ${this.authState.actions.map(
      (r) => {
        var n;
        return g`<button
                        class="auth-btn"
                        ?disabled=${(n = this.authState) == null ? void 0 : n.busy}
                        @click=${() => this.runAuth(r.id)}
                      >
                        ${r.label}
                      </button>`;
      }
    )}
                </div>
              </div>` : y}
        <div class="settings-actions">
          <button class="refresh" @click=${this.refreshAvailability}>Refresh availability</button>
        </div>
        <details class="advanced">
          <summary>Advanced</summary>
          ${i.map((r) => this.renderField(s, r))}
          <label class="field debug-field">
            <input
              class="debug-toggle"
              type="checkbox"
              .checked=${this.draft.debug ?? !1}
              @change=${this.onDraftDebug}
            />
            <span>Debug diagnostics</span>
          </label>
        </details>
      </div>
    `;
  }
};
d.AVAIL_LOOKAHEAD = 10;
d.styles = Me`
    :host {
      /* Token vocabulary (the theme contract). Defaults below are the Auto
         light palette; @media dark supplies the Auto dark palette; named
         themes (:host([theme])) override both. Host inline --byom-* wins. */
      --byom-bg: #f7f7f5;
      --byom-surface: #ffffff;
      --byom-text: #1a1a1a;
      --byom-text-muted: #6b6b6b;
      --byom-accent: #3b5bdb;
      --byom-on-accent: #ffffff;
      --byom-border: #d9d9d6;
      --byom-warn: #b06a00;
      --byom-font: system-ui, sans-serif;
      --byom-border-radius: 8px;
      --byom-video-scale: 0.42;

      display: block;
      background: var(--byom-bg);
      color: var(--byom-text);
      font-family: var(--byom-font);
      border-radius: var(--byom-border-radius);
      padding: 1rem;
      position: relative; /* anchor for the settings modal overlay */
    }
    /* App-shell wrapper. A flex column that fills the host's height when the host
       is given one (e.g. a viewport-fitted page shell): the stage flexes into the
       remaining space and the tracklist is the single scroll region. An internal
       wrapper (not :host) so a consumer overriding the host's display can't
       defeat it. container-type drives width-based @container queries for the
       responsive head below. When the host is unconstrained, height:100% resolves
       to auto and the player is content-sized. */
    .root {
      display: flex;
      flex-direction: column;
      min-height: 0;
      height: 100%;
      container-type: inline-size;
    }
    /* Auto dark default = Midnight */
    @media (prefers-color-scheme: dark) {
      :host {
        --byom-bg: #1e1e1e;
        --byom-surface: #2a2a2a;
        --byom-text: #ffffff;
        --byom-text-muted: #a0a0a0;
        --byom-accent: #ff0055;
        --byom-on-accent: #14141a;
        --byom-border: #3a3a3a;
      }
    }
    :host([theme='daylight']) {
      --byom-bg: #f7f7f5;
      --byom-surface: #ffffff;
      --byom-text: #1a1a1a;
      --byom-text-muted: #6b6b6b;
      --byom-accent: #3b5bdb;
      --byom-on-accent: #ffffff;
      --byom-border: #d9d9d6;
    }
    :host([theme='midnight']) {
      --byom-bg: #1e1e1e;
      --byom-surface: #2a2a2a;
      --byom-text: #ffffff;
      --byom-text-muted: #a0a0a0;
      --byom-accent: #ff0055;
      --byom-on-accent: #14141a;
      --byom-border: #3a3a3a;
    }
    :host([theme='terminal']) {
      --byom-bg: #0b0f0b;
      --byom-surface: #121812;
      --byom-text: #c8f7c8;
      --byom-text-muted: #5a8a5a;
      --byom-accent: #39ff14;
      --byom-on-accent: #06120a;
      --byom-border: #1f3a1f;
    }
    :host([theme='sunset']) {
      --byom-bg: #241a17;
      --byom-surface: #2f221d;
      --byom-text: #f5e6dc;
      --byom-text-muted: #b08d7d;
      --byom-accent: #ff8c42;
      --byom-on-accent: #241a17;
      --byom-border: #4a352c;
    }
    :host([theme='paper']) {
      --byom-bg: #f4ecd8;
      --byom-surface: #fffaf0;
      --byom-text: #3a2f26;
      --byom-text-muted: #8a7a66;
      --byom-accent: #0f766e;
      --byom-on-accent: #fffaf0;
      --byom-border: #ddd0b8;
    }
    /* Stretch: Dracula */
    :host([theme='dracula']) {
      --byom-bg: #282a36;
      --byom-surface: #343746;
      --byom-text: #f8f8f2;
      --byom-text-muted: #6272a4;
      --byom-accent: #bd93f9;
      --byom-on-accent: #282a36;
      --byom-border: #44475a;
    }
    /* Header grid: cover art (left, spanning both rows) + text column
       (title + meta line — author, track stats — on row 1, description on row 2)
       + settings gear (right, spanning both rows). At narrow container width the
       head restacks: the cover shrinks and the description drops to its own
       full-width row (see @container below). */
    .head {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      grid-template-areas:
        'art meta gear'
        'art desc gear';
      column-gap: 0.9rem;
      row-gap: 0.25rem;
      align-items: start;
    }
    .art {
      grid-area: art;
      width: 104px;
      height: 104px;
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: var(--byom-surface);
      border: 1px solid var(--byom-border);
      border-radius: calc(var(--byom-border-radius) / 2);
      color: var(--byom-text-muted);
      font-size: 2.6rem;
    }
    .art-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .meta {
      grid-area: meta;
      min-width: 0;
    }
    .title {
      margin: 0;
      font-size: 1.35rem;
      line-height: 1.15;
      font-weight: 700;
      color: var(--byom-text);
    }
    /* Title-as-selector: a visible title + adjacent ▾, with a transparent native
       <select> overlaid for interaction. Keeps the caret glued to the title
       regardless of how wide the widest option is. */
    .title-wrap {
      position: relative;
      display: inline-block;
      max-width: 100%;
    }
    .title--switch {
      cursor: pointer;
    }
    .title--switch .caret {
      margin-left: 0.35rem;
      font-size: 0.6em;
      color: var(--byom-text-muted);
      vertical-align: middle;
    }
    .title-wrap:hover .title--switch,
    .title-wrap:focus-within .title--switch,
    .title-wrap:hover .title--switch .caret,
    .title-wrap:focus-within .title--switch .caret {
      color: var(--byom-accent);
    }
    .title-select {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      border: none;
      background: transparent;
      color: transparent;
      font: inherit;
      opacity: 0;
      cursor: pointer;
    }
    .meta-line {
      margin: 0.3rem 0 0;
      color: var(--byom-text-muted);
      font-size: 0.78rem;
      font-variant-numeric: tabular-nums;
    }
    .desc-block {
      grid-area: desc;
      margin: 0.35rem 0 0;
    }
    .description {
      color: var(--byom-text-muted);
      font-size: 0.82rem;
      line-height: 1.4;
    }
    /* Toggle is hidden by default (wide players never clamp). */
    .desc-toggle {
      display: none;
    }
    /* Narrow container: cover shrinks and the description takes its own
       full-width row beneath the cover + title/meta. */
    @container (max-width: 30rem) {
      .head {
        grid-template-areas:
          'art meta gear'
          'desc desc desc';
      }
      .art {
        width: 52px;
        height: 52px;
        font-size: 1.4rem;
      }
      /* Collapse long descriptions on narrow players to ~2 lines, the lower
         portion fading out via the mask gradient (no ellipsis, so the text
         dissolves rather than getting cut with "…"). */
      .description.is-collapsed {
        max-height: calc(1.4em * 2);
        overflow: hidden;
        -webkit-mask-image: linear-gradient(to bottom, #000 55%, transparent);
        mask-image: linear-gradient(to bottom, #000 55%, transparent);
      }
      .desc-toggle {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        /* A <button> shrink-wraps to its content even when block-level, so
           auto inline margins (not justify-content) are what center it. */
        margin: 0 auto 0;
        padding: 0;
        background: transparent;
        border: 0;
        cursor: pointer;
        color: var(--byom-accent);
        font: inherit;
        font-size: 0.78rem;
      }
      /* When collapsed, lift the toggle up so it overlaps the faded tail of the
         description — the mask makes that text transparent, so the centered
         toggle reads cleanly there and we reclaim ~a line of vertical space.
         Only when collapsed: expanded text is fully opaque and mustn't be
         covered. */
      .description.is-collapsed + .desc-toggle {
        margin-top: -0.45rem;
      }
    }
    .description a {
      color: var(--byom-accent);
      text-decoration: none;
    }
    .description a:hover {
      text-decoration: underline;
    }
    /* Stage fills the app-shell's remaining height: the tracklist (the single
       scroll region) flexes into it, and a mounted 16:9 embed reserves capped
       space above. No fixed viewport cap — the host bounds the height. */
    .stage {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      flex: 1 1 auto;
      min-height: 0;
      margin-top: 0.5rem;
      position: relative;
    }
    .video {
      flex: 0 0 auto;
      aspect-ratio: 16 / 9;
      /* Cap so a short shell still leaves room for the tracklist; the 16:9 box
         letterboxes within when capped. */
      max-height: 30vh;
      /* The box's width is derived from the 30vh height cap (via aspect-ratio),
         so on players wider than the box it must center rather than pin left. */
      margin-inline: auto;
      background: var(--byom-surface);
      border-radius: calc(var(--byom-border-radius) / 2);
      overflow: hidden;
    }
    .video:empty {
      display: none;
    }
    .video iframe {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
    }
    /* The embed lives inside a positioned wrapper so a corner toggle can anchor
       to it. Wrapper reserves space like the old .video flex child did, and the
       whole region hides when no embed is mounted. */
    .video-wrap {
      position: relative;
      flex: 0 0 auto;
    }
    .video-wrap:has(.video:empty) {
      display: none;
    }
    /* Toggle only appears on narrow players (see the @container block). */
    .video-toggle {
      display: none;
    }
    /* Narrow players: the embed collapses to a small floating "preview" pinned
       to the lower-right of the stage. It's rendered at a full 320x180 and
       scaled down via transform (not a natively-tiny iframe) so YouTube and
       Spotify both stay faithful. Tapping the preview expands it to full width;
       tapping again collapses it. --byom-video-scale is the single size knob. */
    @container (max-width: 30rem) {
      /* --- Collapsed (default): floating mini in the corner --- */
      .stage:not(.video-expanded) .video-wrap {
        position: absolute;
        right: 0;
        bottom: 0;
        z-index: 2;
        width: calc(320px * var(--byom-video-scale));
        height: calc(180px * var(--byom-video-scale));
        max-height: none;
        overflow: hidden;
        border: 1px solid var(--byom-border);
        border-radius: calc(var(--byom-border-radius) / 2);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
      }
      .stage:not(.video-expanded) .video {
        width: 320px;
        height: 180px;
        max-height: none;
        aspect-ratio: auto;
        transform: scale(var(--byom-video-scale));
        transform-origin: top left;
      }
      /* Reserve room so the last rows can scroll clear of the floating mini,
         but only when an embed is actually mounted. */
      .stage:not(.video-expanded):has(.video:not(:empty)) .tracklist {
        padding-bottom: calc(180px * var(--byom-video-scale) + 0.75rem);
      }
      /* Transparent full-cover tap target → expand. Also stops accidental taps
         on the embed's own controls while it's tiny. A small scrimmed glyph in
         the corner hints that it's tappable. */
      .stage:not(.video-expanded) .video-toggle {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: flex-end;
        justify-content: flex-end;
        padding: 2px 4px;
        font-size: 0.8rem;
        line-height: 1;
        color: var(--byom-text);
        background: transparent;
        border: 0;
        cursor: pointer;
        z-index: 3;
      }
      .stage:not(.video-expanded) .video-toggle::before {
        content: '';
        position: absolute;
        right: 0;
        bottom: 0;
        width: 1.4rem;
        height: 1.4rem;
        background: color-mix(in srgb, var(--byom-bg) 70%, transparent);
        border-top-left-radius: calc(var(--byom-border-radius) / 2);
        z-index: -1;
      }

      /* --- Expanded: full-width embed (today's layout) + a corner collapse
             button. .video-wrap/.video fall back to their base rules; only the
             toggle needs positioning. --- */
      .stage.video-expanded .video-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: absolute;
        top: 4px;
        right: 4px;
        min-width: 1.6rem;
        min-height: 1.6rem;
        font-size: 1rem;
        line-height: 1;
        color: var(--byom-text);
        background: color-mix(in srgb, var(--byom-bg) 70%, transparent);
        border: 1px solid var(--byom-border);
        border-radius: 999px;
        cursor: pointer;
        z-index: 3;
      }
    }
    /* Transport footer: prev/play-pause/next + inline seek + shuffle. */
    .transport {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin-top: 0.9rem;
    }
    .ctl-group {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      flex: 0 0 auto;
    }
    .transport button {
      cursor: pointer;
      font-size: 1.3rem;
      line-height: 1;
      color: var(--byom-text);
      background: transparent;
      border: none;
      border-radius: 999px;
      min-width: 2.4rem;
      min-height: 2.4rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .transport button:hover {
      background: color-mix(in srgb, var(--byom-text) 10%, transparent);
    }
    .transport .playpause {
      font-size: 1.6rem;
      color: var(--byom-on-accent);
      background: var(--byom-accent);
    }
    /* Heads-up pill shown when the Spotify embed is stuck on a 30s preview; the
       tooltip explains the Premium-click path. Colors derive from --byom-warn so
       it adapts across themes. */
    .preview-badge {
      flex: 0 0 auto;
      align-self: center;
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
      cursor: help;
      color: var(--byom-warn);
      border: 1px solid color-mix(in srgb, var(--byom-warn) 45%, transparent);
      background: color-mix(in srgb, var(--byom-warn) 12%, transparent);
      border-radius: 999px;
      padding: 0.12rem 0.5rem;
    }
    .transport .playpause:hover {
      background: var(--byom-accent);
      filter: brightness(1.08);
    }
    /* Shuffle is a round icon button like the transport controls; the accent
       fill signals the on state (toggle). */
    .transport .shuffle {
      flex: 0 0 auto;
      opacity: 0.7;
    }
    .transport .shuffle svg {
      width: 1.15rem;
      height: 1.15rem;
      display: block;
    }
    .transport .shuffle.on {
      background: var(--byom-accent);
      color: var(--byom-on-accent);
      opacity: 1;
    }
    .seek {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
    }
    .seek .progress {
      flex: 1;
      min-width: 0;
      accent-color: var(--byom-accent);
    }
    .seek .time {
      flex: 0 0 auto;
      font-variant-numeric: tabular-nums;
      font-size: 0.72rem;
      color: var(--byom-text-muted);
    }
    .filter-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0.5rem 0;
    }
    .filter-row .filter-input {
      flex: 1;
      background: var(--byom-surface);
      color: var(--byom-text);
      border: 1px solid var(--byom-border);
      border-radius: 999px;
      padding: 0.3rem 0.8rem;
      font: inherit;
      font-size: 0.9rem;
    }
    .filter-row .filter-input:focus {
      outline: none;
      border-color: var(--byom-accent);
    }
    .filter-row .filter-clear {
      cursor: pointer;
      background: transparent;
      border: none;
      color: var(--byom-text-muted);
      font-size: 1.2rem;
      line-height: 1;
      padding: 0 0.3rem;
    }
    .filter-row .filter-clear:hover {
      color: var(--byom-text);
    }
    .no-matches {
      color: var(--byom-text-muted);
      font-size: 0.85rem;
      padding: 0.5rem;
      margin: 0;
    }
    .tracklist {
      display: block;
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
    }
    /* Spotify-style rows: number | title/artist | duration. */
    .tracklist li {
      /* The virtualizer positions each row absolutely, so it must be told to
         span the full width — otherwise it shrinks to its content and the 1fr
         title column has no slack to push the duration to the right edge. */
      width: 100%;
      box-sizing: border-box;
      cursor: pointer;
      display: grid;
      /* First column fits up to a 4-digit track number (8000+ track playlists). */
      grid-template-columns: 2.2rem var(--byom-track-art-size, 2rem) 1fr auto;
      align-items: center;
      gap: 0.6rem;
      padding: 0.3rem 0.5rem 0.3rem 0.4rem;
      border-left: 3px solid transparent; /* reserve the active bar's width */
      border-radius: calc(var(--byom-border-radius) / 2);
    }
    .tracklist li:hover {
      background: color-mix(in srgb, var(--byom-text) 8%, transparent);
    }
    .num {
      position: relative;
      text-align: center;
      color: var(--byom-text-muted);
      font-size: 0.75rem;
      font-variant-numeric: tabular-nums;
    }
    .num .glyph {
      display: none;
      font-size: 0.85rem;
    }
    /* Hover a playable row → its number becomes a play glyph. */
    .tracklist li:not(.active):not(.unavailable):not(.pending):hover .num .idx {
      visibility: hidden;
    }
    .tracklist li:not(.active):not(.unavailable):not(.pending):hover .num .glyph {
      display: block;
      position: absolute;
      inset: 0;
      color: var(--byom-text);
    }
    /* Per-row cover thumbnail (size tunable via --byom-track-art-size). */
    .thumb {
      width: var(--byom-track-art-size, 2rem);
      height: var(--byom-track-art-size, 2rem);
      border-radius: calc(var(--byom-border-radius) / 3);
      overflow: hidden;
      background: var(--byom-surface);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .thumb-ph {
      color: var(--byom-text-muted);
      font-size: 0.9rem;
    }
    .cell {
      min-width: 0;
    }
    .t-title {
      display: block;
      color: var(--byom-text);
      font-size: 0.9rem;
      line-height: 1.25;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .t-artist {
      display: block;
      color: var(--byom-text-muted);
      font-size: 0.76rem;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .dur {
      color: var(--byom-text-muted);
      font-size: 0.78rem;
      font-variant-numeric: tabular-nums;
    }
    /* active: accent bar + tint, number becomes the pause/play glyph */
    .tracklist li.active {
      border-left-color: var(--byom-accent);
      background: color-mix(in srgb, var(--byom-accent) 12%, transparent);
    }
    .tracklist li.active .num {
      color: var(--byom-accent);
    }
    .tracklist li.active .num .idx {
      display: none;
    }
    .tracklist li.active .num .glyph {
      display: block;
      color: var(--byom-accent);
    }
    .tracklist li.active .t-title {
      color: var(--byom-accent);
      font-weight: 600;
    }
    .tracklist li.active .t-artist {
      color: color-mix(in srgb, var(--byom-accent) 65%, var(--byom-text-muted));
    }
    /* orphan: muted + a detached marker after the title */
    .tracklist li.orphan .t-title {
      color: var(--byom-text-muted);
    }
    .tracklist li.orphan .t-title::after {
      content: '↯';
      margin-left: 0.35rem;
      opacity: 0.8;
      font-size: 0.85em;
    }
    /* unavailable: struck title (the ✕ lives in the duration slot) */
    .tracklist li.unavailable .t-title {
      color: var(--byom-text-muted);
      text-decoration: line-through;
    }
    /* pending: muted, accent ⋯ shown in the number slot (rendered in markup) */
    .tracklist li.pending .num {
      color: var(--byom-accent);
    }
    .tracklist li.pending .t-title,
    .tracklist li.pending .t-artist {
      color: var(--byom-text-muted);
    }
    .status .halted {
      color: var(--byom-accent);
      font-size: 0.85rem;
    }
    .gear {
      grid-area: gear;
      flex: 0 0 auto;
      display: block;
      background: transparent;
      border: none;
      color: var(--byom-text-muted);
      padding: 0;
      margin-top: 0.15rem; /* nudge the icon down to the title's cap height */
      cursor: pointer;
    }
    .gear svg {
      display: block;
      width: 1.5rem;
      height: 1.5rem;
    }
    .gear:hover {
      color: var(--byom-text);
    }
    /* Modal overlay: covers the player + blocks interaction with it while open. */
    .settings-overlay {
      position: absolute;
      inset: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: rgba(0, 0, 0, 0.6);
      border-radius: var(--byom-border-radius);
    }
    .settings {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      width: 100%;
      max-width: 22rem;
      /* Height is decoupled from the (now content-driven) stage: a comfortable
         min so it doesn't collapse for sparse providers, capped so it never
         outgrows the component; content scrolls past the cap. */
      min-height: 16rem;
      max-height: min(80%, 32rem);
      overflow: auto;
      background: var(--byom-surface);
      border: 1px solid var(--byom-border);
      border-radius: var(--byom-border-radius);
      padding: 1.25rem;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    }
    .settings-head {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .settings-back {
      background: transparent;
      border: none;
      color: var(--byom-text);
      cursor: pointer;
      font-size: 1.1rem;
    }
    .settings .field {
      display: grid;
      gap: 0.15rem;
      font-size: 0.8rem;
      opacity: 0.9;
    }
    .settings .field input,
    .settings .field select {
      background: var(--byom-bg);
      color: var(--byom-text);
      border: 1px solid var(--byom-border);
      border-radius: calc(var(--byom-border-radius) / 2);
      padding: 0.3rem;
      font: inherit;
    }
    .settings .field input:focus,
    .settings .field select:focus {
      border-color: var(--byom-accent);
      outline: none;
    }
    .settings .apply {
      align-self: flex-start;
      background: var(--byom-accent);
      color: var(--byom-on-accent);
      border: none;
      border-radius: 999px;
      padding: 0.4rem 1rem;
      cursor: pointer;
      font-weight: bold;
    }
    .advanced {
      font-size: 0.8rem;
    }
    .advanced summary {
      cursor: pointer;
      opacity: 0.6;
      padding: 0.2rem 0;
    }
    .advanced > .field {
      margin-top: 0.4rem;
    }
    .settings-connection {
      display: grid;
      gap: 0.3rem;
    }
    .settings-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.6;
    }
    .auth-status {
      font-size: 0.8rem;
      opacity: 0.85;
    }
    .auth-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .auth-btn {
      cursor: pointer;
      background: var(--byom-accent);
      color: var(--byom-on-accent);
      border: none;
      border-radius: 999px;
      padding: 0.35rem 0.9rem;
      font: inherit;
    }
    .auth-btn[disabled] {
      opacity: 0.5;
      cursor: default;
    }
    .settings-actions {
      display: grid;
      gap: 0.5rem;
    }
    .debug-field {
      grid-auto-flow: column;
      justify-content: start;
      align-items: center;
      gap: 0.4rem;
    }
    .refresh {
      justify-self: start;
      background: transparent;
      color: var(--byom-text);
      border: 1px solid var(--byom-accent);
      border-radius: 999px;
      padding: 0.3rem 0.9rem;
      cursor: pointer;
      font: inherit;
    }
    [hidden] {
      display: none !important;
    }
  `;
f([
  v()
], d.prototype, "src", 2);
f([
  v()
], d.prototype, "provider", 2);
f([
  v({ reflect: !0 })
], d.prototype, "theme", 2);
f([
  v({ attribute: !1 })
], d.prototype, "providerConfig", 2);
f([
  v({ attribute: !1 })
], d.prototype, "providerFactory", 2);
f([
  v({ type: Number })
], d.prototype, "skipDelayMs", 2);
f([
  v({ type: Boolean })
], d.prototype, "debug", 2);
f([
  v({ type: Boolean })
], d.prototype, "prescan", 2);
f([
  v({ type: Number })
], d.prototype, "prescanDelayMs", 2);
f([
  v()
], d.prototype, "providers", 2);
f([
  v({ type: Boolean, attribute: "no-settings" })
], d.prototype, "noSettings", 2);
f([
  v({ attribute: "spotify-client-id" })
], d.prototype, "spotifyClientId", 2);
f([
  v({ attribute: "spotify-redirect-uri" })
], d.prototype, "spotifyRedirectUri", 2);
f([
  v({ attribute: "youtube-api-key" })
], d.prototype, "youtubeApiKey", 2);
f([
  v({ attribute: "youtube-search-endpoint" })
], d.prototype, "youtubeSearchEndpoint", 2);
f([
  _()
], d.prototype, "playlist", 2);
f([
  _()
], d.prototype, "currentIndex", 2);
f([
  _()
], d.prototype, "playbackState", 2);
f([
  _()
], d.prototype, "failed", 2);
f([
  _()
], d.prototype, "halted", 2);
f([
  _()
], d.prototype, "shuffle", 2);
f([
  _()
], d.prototype, "availability", 2);
f([
  _()
], d.prototype, "checking", 2);
f([
  _()
], d.prototype, "positionMs", 2);
f([
  _()
], d.prototype, "durationMs", 2);
f([
  _()
], d.prototype, "preview", 2);
f([
  _()
], d.prototype, "playlists", 2);
f([
  _()
], d.prototype, "view", 2);
f([
  _()
], d.prototype, "videoExpanded", 2);
f([
  _()
], d.prototype, "descExpanded", 2);
f([
  _()
], d.prototype, "descOverflows", 2);
f([
  _()
], d.prototype, "draft", 2);
f([
  _()
], d.prototype, "authState", 2);
f([
  _()
], d.prototype, "filterQuery", 2);
d = f([
  Ge("byom-player")
], d);
export {
  Tt as BYOM_EXT_NS,
  d as ByomPlayer,
  $e as loadManifest
};
