const mt = "https://github.com/lmorchard/byom-sync";
function Pe(i) {
  const t = i, e = (t == null ? void 0 : t.playlist) ?? t ?? {}, s = e.track ?? e.tracks ?? [];
  return {
    title: e.title ?? "",
    creator: e.creator,
    dateCreated: e.date ?? e.date_created,
    dateUpdated: Me(e.extension),
    annotation: e.annotation,
    image: e.image,
    tracks: s.map(Ie)
  };
}
function Me(i) {
  var e;
  const t = (e = i == null ? void 0 : i[mt]) == null ? void 0 : e[0];
  return typeof (t == null ? void 0 : t.date_updated) == "string" ? t.date_updated : void 0;
}
function Ie(i) {
  var t;
  return {
    title: i.title ?? "",
    artist: i.creator ?? "",
    album: i.album,
    isrc: Oe(i.identifier),
    byomId: Ue(i.identifier),
    image: i.image,
    durationMs: typeof i.duration == "number" ? i.duration * 1e3 : void 0,
    spotifyUrl: (t = i.location) == null ? void 0 : t[0],
    syncState: ze(i.extension),
    resolvedIds: Le(i.extension),
    purchaseUrl: Re(i.extension)
  };
}
function Re(i) {
  var s;
  const t = (s = i == null ? void 0 : i[mt]) == null ? void 0 : s[0], e = t == null ? void 0 : t.purchase_url;
  return typeof e == "string" && e !== "" ? e : void 0;
}
function Le(i) {
  var r;
  const t = (r = i == null ? void 0 : i[mt]) == null ? void 0 : r[0], e = t == null ? void 0 : t.resolved;
  if (!e || typeof e != "object") return;
  const s = typeof e.youtube == "string" ? e.youtube : void 0;
  return s ? { youtube: s } : void 0;
}
function Oe(i) {
  for (const t of i ?? []) {
    const e = /^urn:isrc:(.+)$/i.exec(t);
    if (e) return e[1];
  }
}
function Ue(i) {
  for (const t of i ?? []) {
    const e = /^urn:byom:(.+)$/i.exec(t);
    if (e) return e[1];
  }
}
function ze(i) {
  var e;
  const t = (e = i == null ? void 0 : i[mt]) == null ? void 0 : e[0];
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
const ct = globalThis, It = ct.ShadowRoot && (ct.ShadyCSS === void 0 || ct.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, Rt = Symbol(), Nt = /* @__PURE__ */ new WeakMap();
let pe = class {
  constructor(t, e, s) {
    if (this._$cssResult$ = !0, s !== Rt) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = e;
  }
  get styleSheet() {
    let t = this.o;
    const e = this.t;
    if (It && t === void 0) {
      const s = e !== void 0 && e.length === 1;
      s && (t = Nt.get(e)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), s && Nt.set(e, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const Ne = (i) => new pe(typeof i == "string" ? i : i + "", void 0, Rt), De = (i, ...t) => {
  const e = i.length === 1 ? i[0] : t.reduce((s, r, n) => s + ((o) => {
    if (o._$cssResult$ === !0) return o.cssText;
    if (typeof o == "number") return o;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + o + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(r) + i[n + 1], i[0]);
  return new pe(e, i, Rt);
}, je = (i, t) => {
  if (It) i.adoptedStyleSheets = t.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
  else for (const e of t) {
    const s = document.createElement("style"), r = ct.litNonce;
    r !== void 0 && s.setAttribute("nonce", r), s.textContent = e.cssText, i.appendChild(s);
  }
}, Dt = It ? (i) => i : (i) => i instanceof CSSStyleSheet ? ((t) => {
  let e = "";
  for (const s of t.cssRules) e += s.cssText;
  return Ne(e);
})(i) : i;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: He, defineProperty: Ve, getOwnPropertyDescriptor: Fe, getOwnPropertyNames: Be, getOwnPropertySymbols: Ke, getPrototypeOf: qe } = Object, M = globalThis, jt = M.trustedTypes, We = jt ? jt.emptyScript : "", $t = M.reactiveElementPolyfillSupport, J = (i, t) => i, ut = { toAttribute(i, t) {
  switch (t) {
    case Boolean:
      i = i ? We : null;
      break;
    case Object:
    case Array:
      i = i == null ? i : JSON.stringify(i);
  }
  return i;
}, fromAttribute(i, t) {
  let e = i;
  switch (t) {
    case Boolean:
      e = i !== null;
      break;
    case Number:
      e = i === null ? null : Number(i);
      break;
    case Object:
    case Array:
      try {
        e = JSON.parse(i);
      } catch {
        e = null;
      }
  }
  return e;
} }, Lt = (i, t) => !He(i, t), Ht = { attribute: !0, type: String, converter: ut, reflect: !1, useDefault: !1, hasChanged: Lt };
Symbol.metadata ?? (Symbol.metadata = Symbol("metadata")), M.litPropertyMetadata ?? (M.litPropertyMetadata = /* @__PURE__ */ new WeakMap());
let D = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ?? (this.l = [])).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, e = Ht) {
    if (e.state && (e.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((e = Object.create(e)).wrapped = !0), this.elementProperties.set(t, e), !e.noAccessor) {
      const s = Symbol(), r = this.getPropertyDescriptor(t, s, e);
      r !== void 0 && Ve(this.prototype, t, r);
    }
  }
  static getPropertyDescriptor(t, e, s) {
    const { get: r, set: n } = Fe(this.prototype, t) ?? { get() {
      return this[e];
    }, set(o) {
      this[e] = o;
    } };
    return { get: r, set(o) {
      const a = r == null ? void 0 : r.call(this);
      n == null || n.call(this, o), this.requestUpdate(t, a, s);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? Ht;
  }
  static _$Ei() {
    if (this.hasOwnProperty(J("elementProperties"))) return;
    const t = qe(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(J("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(J("properties"))) {
      const e = this.properties, s = [...Be(e), ...Ke(e)];
      for (const r of s) this.createProperty(r, e[r]);
    }
    const t = this[Symbol.metadata];
    if (t !== null) {
      const e = litPropertyMetadata.get(t);
      if (e !== void 0) for (const [s, r] of e) this.elementProperties.set(s, r);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [e, s] of this.elementProperties) {
      const r = this._$Eu(e, s);
      r !== void 0 && this._$Eh.set(r, e);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(t) {
    const e = [];
    if (Array.isArray(t)) {
      const s = new Set(t.flat(1 / 0).reverse());
      for (const r of s) e.unshift(Dt(r));
    } else t !== void 0 && e.push(Dt(t));
    return e;
  }
  static _$Eu(t, e) {
    const s = e.attribute;
    return s === !1 ? void 0 : typeof s == "string" ? s : typeof t == "string" ? t.toLowerCase() : void 0;
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
    for (const s of e.keys()) this.hasOwnProperty(s) && (t.set(s, this[s]), delete this[s]);
    t.size > 0 && (this._$Ep = t);
  }
  createRenderRoot() {
    const t = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return je(t, this.constructor.elementStyles), t;
  }
  connectedCallback() {
    var t;
    this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this.enableUpdating(!0), (t = this._$EO) == null || t.forEach((e) => {
      var s;
      return (s = e.hostConnected) == null ? void 0 : s.call(e);
    });
  }
  enableUpdating(t) {
  }
  disconnectedCallback() {
    var t;
    (t = this._$EO) == null || t.forEach((e) => {
      var s;
      return (s = e.hostDisconnected) == null ? void 0 : s.call(e);
    });
  }
  attributeChangedCallback(t, e, s) {
    this._$AK(t, s);
  }
  _$ET(t, e) {
    var n;
    const s = this.constructor.elementProperties.get(t), r = this.constructor._$Eu(t, s);
    if (r !== void 0 && s.reflect === !0) {
      const o = (((n = s.converter) == null ? void 0 : n.toAttribute) !== void 0 ? s.converter : ut).toAttribute(e, s.type);
      this._$Em = t, o == null ? this.removeAttribute(r) : this.setAttribute(r, o), this._$Em = null;
    }
  }
  _$AK(t, e) {
    var n, o;
    const s = this.constructor, r = s._$Eh.get(t);
    if (r !== void 0 && this._$Em !== r) {
      const a = s.getPropertyOptions(r), l = typeof a.converter == "function" ? { fromAttribute: a.converter } : ((n = a.converter) == null ? void 0 : n.fromAttribute) !== void 0 ? a.converter : ut;
      this._$Em = r;
      const h = l.fromAttribute(e, a.type);
      this[r] = h ?? ((o = this._$Ej) == null ? void 0 : o.get(r)) ?? h, this._$Em = null;
    }
  }
  requestUpdate(t, e, s, r = !1, n) {
    var o;
    if (t !== void 0) {
      const a = this.constructor;
      if (r === !1 && (n = this[t]), s ?? (s = a.getPropertyOptions(t)), !((s.hasChanged ?? Lt)(n, e) || s.useDefault && s.reflect && n === ((o = this._$Ej) == null ? void 0 : o.get(t)) && !this.hasAttribute(a._$Eu(t, s)))) return;
      this.C(t, e, s);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, e, { useDefault: s, reflect: r, wrapped: n }, o) {
    s && !(this._$Ej ?? (this._$Ej = /* @__PURE__ */ new Map())).has(t) && (this._$Ej.set(t, o ?? e ?? this[t]), n !== !0 || o !== void 0) || (this._$AL.has(t) || (this.hasUpdated || s || (e = void 0), this._$AL.set(t, e)), r === !0 && this._$Em !== t && (this._$Eq ?? (this._$Eq = /* @__PURE__ */ new Set())).add(t));
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
    var s;
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this._$Ep) {
        for (const [n, o] of this._$Ep) this[n] = o;
        this._$Ep = void 0;
      }
      const r = this.constructor.elementProperties;
      if (r.size > 0) for (const [n, o] of r) {
        const { wrapped: a } = o, l = this[n];
        a !== !0 || this._$AL.has(n) || l === void 0 || this.C(n, void 0, o, l);
      }
    }
    let t = !1;
    const e = this._$AL;
    try {
      t = this.shouldUpdate(e), t ? (this.willUpdate(e), (s = this._$EO) == null || s.forEach((r) => {
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
    (e = this._$EO) == null || e.forEach((s) => {
      var r;
      return (r = s.hostUpdated) == null ? void 0 : r.call(s);
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
D.elementStyles = [], D.shadowRootOptions = { mode: "open" }, D[J("elementProperties")] = /* @__PURE__ */ new Map(), D[J("finalized")] = /* @__PURE__ */ new Map(), $t == null || $t({ ReactiveElement: D }), (M.reactiveElementVersions ?? (M.reactiveElementVersions = [])).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const X = globalThis, Vt = (i) => i, pt = X.trustedTypes, Ft = pt ? pt.createPolicy("lit-html", { createHTML: (i) => i }) : void 0, fe = "$lit$", T = `lit$${Math.random().toFixed(9).slice(2)}$`, me = "?" + T, Ye = `<${me}>`, U = document, Z = () => U.createComment(""), tt = (i) => i === null || typeof i != "object" && typeof i != "function", Ot = Array.isArray, Qe = (i) => Ot(i) || typeof (i == null ? void 0 : i[Symbol.iterator]) == "function", St = `[ 	
\f\r]`, K = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, Bt = /-->/g, Kt = />/g, I = RegExp(`>|${St}(?:([^\\s"'>=/]+)(${St}*=${St}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), qt = /'/g, Wt = /"/g, ye = /^(?:script|style|textarea|title)$/i, Je = (i) => (t, ...e) => ({ _$litType$: i, strings: t, values: e }), p = Je(1), A = Symbol.for("lit-noChange"), g = Symbol.for("lit-nothing"), Yt = /* @__PURE__ */ new WeakMap(), L = U.createTreeWalker(U, 129);
function ge(i, t) {
  if (!Ot(i) || !i.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return Ft !== void 0 ? Ft.createHTML(t) : t;
}
const Xe = (i, t) => {
  const e = i.length - 1, s = [];
  let r, n = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = K;
  for (let a = 0; a < e; a++) {
    const l = i[a];
    let h, u, c = -1, y = 0;
    for (; y < l.length && (o.lastIndex = y, u = o.exec(l), u !== null); ) y = o.lastIndex, o === K ? u[1] === "!--" ? o = Bt : u[1] !== void 0 ? o = Kt : u[2] !== void 0 ? (ye.test(u[2]) && (r = RegExp("</" + u[2], "g")), o = I) : u[3] !== void 0 && (o = I) : o === I ? u[0] === ">" ? (o = r ?? K, c = -1) : u[1] === void 0 ? c = -2 : (c = o.lastIndex - u[2].length, h = u[1], o = u[3] === void 0 ? I : u[3] === '"' ? Wt : qt) : o === Wt || o === qt ? o = I : o === Bt || o === Kt ? o = K : (o = I, r = void 0);
    const f = o === I && i[a + 1].startsWith("/>") ? " " : "";
    n += o === K ? l + Ye : c >= 0 ? (s.push(h), l.slice(0, c) + fe + l.slice(c) + T + f) : l + T + (c === -2 ? a : f);
  }
  return [ge(i, n + (i[e] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), s];
};
class et {
  constructor({ strings: t, _$litType$: e }, s) {
    let r;
    this.parts = [];
    let n = 0, o = 0;
    const a = t.length - 1, l = this.parts, [h, u] = Xe(t, e);
    if (this.el = et.createElement(h, s), L.currentNode = this.el.content, e === 2 || e === 3) {
      const c = this.el.content.firstChild;
      c.replaceWith(...c.childNodes);
    }
    for (; (r = L.nextNode()) !== null && l.length < a; ) {
      if (r.nodeType === 1) {
        if (r.hasAttributes()) for (const c of r.getAttributeNames()) if (c.endsWith(fe)) {
          const y = u[o++], f = r.getAttribute(c).split(T), b = /([.?@])?(.*)/.exec(y);
          l.push({ type: 1, index: n, name: b[2], strings: f, ctor: b[1] === "." ? Ze : b[1] === "?" ? ti : b[1] === "@" ? ei : yt }), r.removeAttribute(c);
        } else c.startsWith(T) && (l.push({ type: 6, index: n }), r.removeAttribute(c));
        if (ye.test(r.tagName)) {
          const c = r.textContent.split(T), y = c.length - 1;
          if (y > 0) {
            r.textContent = pt ? pt.emptyScript : "";
            for (let f = 0; f < y; f++) r.append(c[f], Z()), L.nextNode(), l.push({ type: 2, index: ++n });
            r.append(c[y], Z());
          }
        }
      } else if (r.nodeType === 8) if (r.data === me) l.push({ type: 2, index: n });
      else {
        let c = -1;
        for (; (c = r.data.indexOf(T, c + 1)) !== -1; ) l.push({ type: 7, index: n }), c += T.length - 1;
      }
      n++;
    }
  }
  static createElement(t, e) {
    const s = U.createElement("template");
    return s.innerHTML = t, s;
  }
}
function H(i, t, e = i, s) {
  var o, a;
  if (t === A) return t;
  let r = s !== void 0 ? (o = e._$Co) == null ? void 0 : o[s] : e._$Cl;
  const n = tt(t) ? void 0 : t._$litDirective$;
  return (r == null ? void 0 : r.constructor) !== n && ((a = r == null ? void 0 : r._$AO) == null || a.call(r, !1), n === void 0 ? r = void 0 : (r = new n(i), r._$AT(i, e, s)), s !== void 0 ? (e._$Co ?? (e._$Co = []))[s] = r : e._$Cl = r), r !== void 0 && (t = H(i, r._$AS(i, t.values), r, s)), t;
}
class Ge {
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
    const { el: { content: e }, parts: s } = this._$AD, r = ((t == null ? void 0 : t.creationScope) ?? U).importNode(e, !0);
    L.currentNode = r;
    let n = L.nextNode(), o = 0, a = 0, l = s[0];
    for (; l !== void 0; ) {
      if (o === l.index) {
        let h;
        l.type === 2 ? h = new V(n, n.nextSibling, this, t) : l.type === 1 ? h = new l.ctor(n, l.name, l.strings, this, t) : l.type === 6 && (h = new ii(n, this, t)), this._$AV.push(h), l = s[++a];
      }
      o !== (l == null ? void 0 : l.index) && (n = L.nextNode(), o++);
    }
    return L.currentNode = U, r;
  }
  p(t) {
    let e = 0;
    for (const s of this._$AV) s !== void 0 && (s.strings !== void 0 ? (s._$AI(t, s, e), e += s.strings.length - 2) : s._$AI(t[e])), e++;
  }
}
class V {
  get _$AU() {
    var t;
    return ((t = this._$AM) == null ? void 0 : t._$AU) ?? this._$Cv;
  }
  constructor(t, e, s, r) {
    this.type = 2, this._$AH = g, this._$AN = void 0, this._$AA = t, this._$AB = e, this._$AM = s, this.options = r, this._$Cv = (r == null ? void 0 : r.isConnected) ?? !0;
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
    t = H(this, t, e), tt(t) ? t === g || t == null || t === "" ? (this._$AH !== g && this._$AR(), this._$AH = g) : t !== this._$AH && t !== A && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : Qe(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== g && tt(this._$AH) ? this._$AA.nextSibling.data = t : this.T(U.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    var n;
    const { values: e, _$litType$: s } = t, r = typeof s == "number" ? this._$AC(t) : (s.el === void 0 && (s.el = et.createElement(ge(s.h, s.h[0]), this.options)), s);
    if (((n = this._$AH) == null ? void 0 : n._$AD) === r) this._$AH.p(e);
    else {
      const o = new Ge(r, this), a = o.u(this.options);
      o.p(e), this.T(a), this._$AH = o;
    }
  }
  _$AC(t) {
    let e = Yt.get(t.strings);
    return e === void 0 && Yt.set(t.strings, e = new et(t)), e;
  }
  k(t) {
    Ot(this._$AH) || (this._$AH = [], this._$AR());
    const e = this._$AH;
    let s, r = 0;
    for (const n of t) r === e.length ? e.push(s = new V(this.O(Z()), this.O(Z()), this, this.options)) : s = e[r], s._$AI(n), r++;
    r < e.length && (this._$AR(s && s._$AB.nextSibling, r), e.length = r);
  }
  _$AR(t = this._$AA.nextSibling, e) {
    var s;
    for ((s = this._$AP) == null ? void 0 : s.call(this, !1, !0, e); t !== this._$AB; ) {
      const r = Vt(t).nextSibling;
      Vt(t).remove(), t = r;
    }
  }
  setConnected(t) {
    var e;
    this._$AM === void 0 && (this._$Cv = t, (e = this._$AP) == null || e.call(this, t));
  }
}
class yt {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, e, s, r, n) {
    this.type = 1, this._$AH = g, this._$AN = void 0, this.element = t, this.name = e, this._$AM = r, this.options = n, s.length > 2 || s[0] !== "" || s[1] !== "" ? (this._$AH = Array(s.length - 1).fill(new String()), this.strings = s) : this._$AH = g;
  }
  _$AI(t, e = this, s, r) {
    const n = this.strings;
    let o = !1;
    if (n === void 0) t = H(this, t, e, 0), o = !tt(t) || t !== this._$AH && t !== A, o && (this._$AH = t);
    else {
      const a = t;
      let l, h;
      for (t = n[0], l = 0; l < n.length - 1; l++) h = H(this, a[s + l], e, l), h === A && (h = this._$AH[l]), o || (o = !tt(h) || h !== this._$AH[l]), h === g ? t = g : t !== g && (t += (h ?? "") + n[l + 1]), this._$AH[l] = h;
    }
    o && !r && this.j(t);
  }
  j(t) {
    t === g ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class Ze extends yt {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === g ? void 0 : t;
  }
}
class ti extends yt {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== g);
  }
}
class ei extends yt {
  constructor(t, e, s, r, n) {
    super(t, e, s, r, n), this.type = 5;
  }
  _$AI(t, e = this) {
    if ((t = H(this, t, e, 0) ?? g) === A) return;
    const s = this._$AH, r = t === g && s !== g || t.capture !== s.capture || t.once !== s.once || t.passive !== s.passive, n = t !== g && (s === g || r);
    r && this.element.removeEventListener(this.name, this, s), n && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    var e;
    typeof this._$AH == "function" ? this._$AH.call(((e = this.options) == null ? void 0 : e.host) ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class ii {
  constructor(t, e, s) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = e, this.options = s;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    H(this, t);
  }
}
const si = { I: V }, Ct = X.litHtmlPolyfillSupport;
Ct == null || Ct(et, V), (X.litHtmlVersions ?? (X.litHtmlVersions = [])).push("3.3.3");
const ri = (i, t, e) => {
  const s = (e == null ? void 0 : e.renderBefore) ?? t;
  let r = s._$litPart$;
  if (r === void 0) {
    const n = (e == null ? void 0 : e.renderBefore) ?? null;
    s._$litPart$ = r = new V(t.insertBefore(Z(), n), n, void 0, e ?? {});
  }
  return r._$AI(i), r;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const O = globalThis;
let j = class extends D {
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
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = ri(e, this.renderRoot, this.renderOptions);
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
var ue;
j._$litElement$ = !0, j.finalized = !0, (ue = O.litElementHydrateSupport) == null || ue.call(O, { LitElement: j });
const Et = O.litElementPolyfillSupport;
Et == null || Et({ LitElement: j });
(O.litElementVersions ?? (O.litElementVersions = [])).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const ni = (i) => (t, e) => {
  e !== void 0 ? e.addInitializer(() => {
    customElements.define(i, t);
  }) : customElements.define(i, t);
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const oi = { attribute: !0, type: String, converter: ut, reflect: !1, hasChanged: Lt }, ai = (i = oi, t, e) => {
  const { kind: s, metadata: r } = e;
  let n = globalThis.litPropertyMetadata.get(r);
  if (n === void 0 && globalThis.litPropertyMetadata.set(r, n = /* @__PURE__ */ new Map()), s === "setter" && ((i = Object.create(i)).wrapped = !0), n.set(e.name, i), s === "accessor") {
    const { name: o } = e;
    return { set(a) {
      const l = t.get.call(this);
      t.set.call(this, a), this.requestUpdate(o, l, i, !0, a);
    }, init(a) {
      return a !== void 0 && this.C(o, void 0, i, a), a;
    } };
  }
  if (s === "setter") {
    const { name: o } = e;
    return function(a) {
      const l = this[o];
      t.call(this, a), this.requestUpdate(o, l, i, !0, a);
    };
  }
  throw Error("Unsupported decorator location: " + s);
};
function v(i) {
  return (t, e) => typeof e == "object" ? ai(i, t, e) : ((s, r, n) => {
    const o = r.hasOwnProperty(n);
    return r.constructor.createProperty(n, s), o ? Object.getOwnPropertyDescriptor(r, n) : void 0;
  })(i, t, e);
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function _(i) {
  return v({ ...i, state: !0, attribute: !1 });
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const gt = { CHILD: 2 }, Ut = (i) => (...t) => ({ _$litDirective$: i, values: t });
let zt = class {
  constructor(t) {
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AT(t, e, s) {
    this._$Ct = t, this._$AM = e, this._$Ci = s;
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
class Pt extends zt {
  constructor(t) {
    if (super(t), this.it = g, t.type !== gt.CHILD) throw Error(this.constructor.directiveName + "() can only be used in child bindings");
  }
  render(t) {
    if (t === g || t == null) return this._t = void 0, this.it = t;
    if (t === A) return t;
    if (typeof t != "string") throw Error(this.constructor.directiveName + "() called with a non-string value");
    if (t === this.it) return this._t;
    this.it = t;
    const e = [t];
    return e.raw = e, this._t = { _$litType$: this.constructor.resultType, strings: e, values: [] };
  }
}
Pt.directiveName = "unsafeHTML", Pt.resultType = 1;
const li = Ut(Pt);
function it(i, t, e, s) {
  var r = arguments.length, n = r < 3 ? t : s === null ? s = Object.getOwnPropertyDescriptor(t, e) : s, o;
  if (typeof Reflect == "object" && typeof Reflect.decorate == "function") n = Reflect.decorate(i, t, e, s);
  else for (var a = i.length - 1; a >= 0; a--) (o = i[a]) && (n = (r < 3 ? o(n) : r > 3 ? o(t, e, n) : o(t, e)) || n);
  return r > 3 && n && Object.defineProperty(t, e, n), n;
}
/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { I: hi } = si, Qt = (i) => i, ci = (i) => i.strings === void 0, Jt = () => document.createComment(""), q = (i, t, e) => {
  var n;
  const s = i._$AA.parentNode, r = t === void 0 ? i._$AB : t._$AA;
  if (e === void 0) {
    const o = s.insertBefore(Jt(), r), a = s.insertBefore(Jt(), r);
    e = new hi(o, a, i, i.options);
  } else {
    const o = e._$AB.nextSibling, a = e._$AM, l = a !== i;
    if (l) {
      let h;
      (n = e._$AQ) == null || n.call(e, i), e._$AM = i, e._$AP !== void 0 && (h = i._$AU) !== a._$AU && e._$AP(h);
    }
    if (o !== r || l) {
      let h = e._$AA;
      for (; h !== o; ) {
        const u = Qt(h).nextSibling;
        Qt(s).insertBefore(h, r), h = u;
      }
    }
  }
  return e;
}, R = (i, t, e = i) => (i._$AI(t, e), i), di = {}, ui = (i, t = di) => i._$AH = t, pi = (i) => i._$AH, At = (i) => {
  i._$AR(), i._$AA.remove();
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const G = (i, t) => {
  var s;
  const e = i._$AN;
  if (e === void 0) return !1;
  for (const r of e) (s = r._$AO) == null || s.call(r, t, !1), G(r, t);
  return !0;
}, ft = (i) => {
  let t, e;
  do {
    if ((t = i._$AM) === void 0) break;
    e = t._$AN, e.delete(i), i = t;
  } while ((e == null ? void 0 : e.size) === 0);
}, be = (i) => {
  for (let t; t = i._$AM; i = t) {
    let e = t._$AN;
    if (e === void 0) t._$AN = e = /* @__PURE__ */ new Set();
    else if (e.has(i)) break;
    e.add(i), yi(t);
  }
};
function fi(i) {
  this._$AN !== void 0 ? (ft(this), this._$AM = i, be(this)) : this._$AM = i;
}
function mi(i, t = !1, e = 0) {
  const s = this._$AH, r = this._$AN;
  if (r !== void 0 && r.size !== 0) if (t) if (Array.isArray(s)) for (let n = e; n < s.length; n++) G(s[n], !1), ft(s[n]);
  else s != null && (G(s, !1), ft(s));
  else G(this, i);
}
const yi = (i) => {
  i.type == gt.CHILD && (i._$AP ?? (i._$AP = mi), i._$AQ ?? (i._$AQ = fi));
};
class gi extends zt {
  constructor() {
    super(...arguments), this._$AN = void 0;
  }
  _$AT(t, e, s) {
    super._$AT(t, e, s), be(this), this.isConnected = t._$AU;
  }
  _$AO(t, e = !0) {
    var s, r;
    t !== this.isConnected && (this.isConnected = t, t ? (s = this.reconnected) == null || s.call(this) : (r = this.disconnected) == null || r.call(this)), e && (G(this, t), ft(this));
  }
  setValue(t) {
    if (ci(this._$Ct)) this._$Ct._$AI(t, this);
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
const Xt = (i, t, e) => {
  const s = /* @__PURE__ */ new Map();
  for (let r = t; r <= e; r++) s.set(i[r], r);
  return s;
}, bi = Ut(class extends zt {
  constructor(i) {
    if (super(i), i.type !== gt.CHILD) throw Error("repeat() can only be used in text expressions");
  }
  dt(i, t, e) {
    let s;
    e === void 0 ? e = t : t !== void 0 && (s = t);
    const r = [], n = [];
    let o = 0;
    for (const a of i) r[o] = s ? s(a, o) : o, n[o] = e(a, o), o++;
    return { values: n, keys: r };
  }
  render(i, t, e) {
    return this.dt(i, t, e).values;
  }
  update(i, [t, e, s]) {
    const r = pi(i), { values: n, keys: o } = this.dt(t, e, s);
    if (!Array.isArray(r)) return this.ut = o, n;
    const a = this.ut ?? (this.ut = []), l = [];
    let h, u, c = 0, y = r.length - 1, f = 0, b = n.length - 1;
    for (; c <= y && f <= b; ) if (r[c] === null) c++;
    else if (r[y] === null) y--;
    else if (a[c] === o[f]) l[f] = R(r[c], n[f]), c++, f++;
    else if (a[y] === o[b]) l[b] = R(r[y], n[b]), y--, b--;
    else if (a[c] === o[b]) l[b] = R(r[c], n[b]), q(i, l[b + 1], r[c]), c++, b--;
    else if (a[y] === o[f]) l[f] = R(r[y], n[f]), q(i, r[c], r[y]), y--, f++;
    else if (h === void 0 && (h = Xt(o, f, b), u = Xt(a, c, y)), h.has(a[c])) if (h.has(a[y])) {
      const E = u.get(o[f]), B = E !== void 0 ? r[E] : null;
      if (B === null) {
        const st = q(i, r[c]);
        R(st, n[f]), l[f] = st;
      } else l[f] = R(B, n[f]), q(i, r[c], B), r[E] = null;
      f++;
    } else At(r[y]), y--;
    else At(r[c]), c++;
    for (; f <= b; ) {
      const E = q(i, l[b + 1]);
      R(E, n[f]), l[f++] = E;
    }
    for (; c <= y; ) {
      const E = r[c++];
      E !== null && At(E);
    }
    return this.ut = o, ui(i, l), A;
  }
});
/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
class bt extends Event {
  constructor(t) {
    super(bt.eventName, { bubbles: !1 }), this.first = t.first, this.last = t.last;
  }
}
bt.eventName = "rangeChanged";
class vt extends Event {
  constructor(t) {
    super(vt.eventName, { bubbles: !1 }), this.first = t.first, this.last = t.last;
  }
}
vt.eventName = "visibilityChanged";
class _t extends Event {
  constructor() {
    super(_t.eventName, { bubbles: !1 });
  }
}
_t.eventName = "unpinned";
/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
class vi {
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
class _i extends vi {
  constructor(t, e) {
    super(e), this._clients = /* @__PURE__ */ new Set(), this._retarget = null, this._end = null, this.__destination = null, this.correctingScrollError = !1, this._checkForArrival = this._checkForArrival.bind(this), this._updateManagedScrollTo = this._updateManagedScrollTo.bind(this), this.scrollTo = this.scrollTo.bind(this), this.scrollBy = this.scrollBy.bind(this);
    const s = this._node;
    this._originalScrollTo = s.scrollTo, this._originalScrollBy = s.scrollBy, this._originalScroll = s.scroll, this._attach(t);
  }
  get _destination() {
    return this.__destination;
  }
  get scrolling() {
    return this._destination !== null;
  }
  scrollTo(t, e) {
    const s = typeof t == "number" && typeof e == "number" ? { left: t, top: e } : t;
    this._scrollTo(s);
  }
  scrollBy(t, e) {
    const s = typeof t == "number" && typeof e == "number" ? { left: t, top: e } : t;
    s.top !== void 0 && (s.top += this.scrollTop), s.left !== void 0 && (s.left += this.scrollLeft), this._scrollTo(s);
  }
  _nativeScrollTo(t) {
    this._originalScrollTo.bind(this._element || window)(t);
  }
  _scrollTo(t, e = null, s = null) {
    this._end !== null && this._end(), t.behavior === "smooth" ? (this._setDestination(t), this._retarget = e, this._end = s) : this._resetScrollState(), this._nativeScrollTo(t);
  }
  _setDestination(t) {
    let { top: e, left: s } = t;
    return e = e === void 0 ? void 0 : Math.max(0, Math.min(e, this.maxScrollTop)), s = s === void 0 ? void 0 : Math.max(0, Math.min(s, this.maxScrollLeft)), this._destination !== null && s === this._destination.left && e === this._destination.top ? !1 : (this.__destination = { top: e, left: s, behavior: "smooth" }, !0);
  }
  _resetScrollState() {
    this.__destination = null, this._retarget = null, this._end = null;
  }
  _updateManagedScrollTo(t) {
    this._destination && this._setDestination(t) && this._nativeScrollTo(this._destination);
  }
  managedScrollTo(t, e, s) {
    return this._scrollTo(t, e, s), this._updateManagedScrollTo;
  }
  correctScrollError(t) {
    this.correctingScrollError = !0, requestAnimationFrame(() => requestAnimationFrame(() => this.correctingScrollError = !1)), this._nativeScrollTo(t), this._retarget && this._setDestination(this._retarget()), this._destination && this._nativeScrollTo(this._destination);
  }
  _checkForArrival() {
    if (this._destination !== null) {
      const { scrollTop: t, scrollLeft: e } = this;
      let { top: s, left: r } = this._destination;
      s = Math.min(s || 0, this.maxScrollTop), r = Math.min(r || 0, this.maxScrollLeft);
      const n = Math.abs(s - t), o = Math.abs(r - e);
      n < 1 && o < 1 && (this._end && this._end(), this._resetScrollState());
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
let Gt = typeof window < "u" ? window.ResizeObserver : void 0;
const Mt = Symbol("virtualizerRef"), rt = "virtualizer-sizer";
let Zt;
class wi {
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
    this._mutationObserver = new MutationObserver(this._finishDOMUpdate.bind(this)), this._hostElementRO = new Gt(() => this._hostElementSizeChanged()), this._childrenRO = new Gt(this._childrenSizeChanged.bind(this));
  }
  _initHostElement(t) {
    const e = this._hostElement = t.hostElement;
    this._applyVirtualizerStyles(), e[Mt] = this;
  }
  connected() {
    this._initObservers();
    const t = this._isScroller;
    this._clippingAncestors = Si(this._hostElement, t), this._scrollerController = new _i(this, this._clippingAncestors[0]), this._schedule(this._updateLayout), this._observeAndListen(), this._connected = !0;
  }
  _observeAndListen() {
    this._mutationObserver.observe(this._hostElement, { childList: !0 }), this._hostElementRO.observe(this._hostElement), this._scrollEventListeners.push(window), window.addEventListener("scroll", this, this._scrollEventListenerOptions), this._clippingAncestors.forEach((t) => {
      t.addEventListener("scroll", this, this._scrollEventListenerOptions), this._scrollEventListeners.push(t), this._hostElementRO.observe(t);
    }), this._hostElementRO.observe(this._scrollerController.element), this._children.forEach((t) => this._childrenRO.observe(t)), this._scrollEventListeners.forEach((t) => t.addEventListener("scroll", this, this._scrollEventListenerOptions));
  }
  disconnected() {
    var t, e, s, r;
    this._scrollEventListeners.forEach((n) => n.removeEventListener("scroll", this, this._scrollEventListenerOptions)), this._scrollEventListeners = [], this._clippingAncestors = [], (t = this._scrollerController) == null || t.detach(this), this._scrollerController = null, (e = this._mutationObserver) == null || e.disconnect(), this._mutationObserver = null, (s = this._hostElementRO) == null || s.disconnect(), this._hostElementRO = null, (r = this._childrenRO) == null || r.disconnect(), this._childrenRO = null, this._rejectLayoutCompletePromise("disconnected"), this._connected = !1;
  }
  _applyVirtualizerStyles() {
    const e = this._hostElement.style;
    e.display = e.display || "block", e.position = e.position || "relative", e.contain = e.contain || "size layout", this._isScroller && (e.overflow = e.overflow || "auto", e.minHeight = e.minHeight || "150px");
  }
  _getSizer() {
    const t = this._hostElement;
    if (!this._sizer) {
      let e = t.querySelector(`[${rt}]`);
      e || (e = document.createElement("div"), e.setAttribute(rt, ""), t.appendChild(e)), Object.assign(e.style, {
        position: "absolute",
        margin: "-2px 0 0 0",
        padding: 0,
        visibility: "hidden",
        fontSize: "2px"
      }), e.textContent = "&nbsp;", e.setAttribute(rt, ""), this._sizer = e;
    }
    return this._sizer;
  }
  async updateLayoutConfig(t) {
    await this._layoutInitialized;
    const e = t.type || // The new config is compatible with the current layout,
    // so we update the config and return true to indicate
    // a successful update
    Zt;
    if (typeof e == "function" && this._layout instanceof e) {
      const s = { ...t };
      return delete s.type, this._layout.config = s, !0;
    }
    return !1;
  }
  async _initLayout(t) {
    let e, s;
    if (typeof t.type == "function") {
      s = t.type;
      const r = { ...t };
      delete r.type, e = r;
    } else
      e = t;
    s === void 0 && (Zt = s = (await import("./flow-D-0MTYCm.js")).FlowLayout), this._layout = new s((r) => this._handleLayoutMessage(r), e), this._layout.measureChildren && typeof this._layout.updateItemSizes == "function" && (typeof this._layout.measureChildren == "function" && (this._measureChildOverride = this._layout.measureChildren), this._measureCallback = this._layout.updateItemSizes.bind(this._layout)), this._layout.listenForChildLoadEvents && this._hostElement.addEventListener("load", this._loadListener, !0), this._schedule(this._updateLayout);
  }
  // TODO (graynorton): Rework benchmarking so that it has no API and
  // instead is always on except in production builds
  startBenchmarking() {
    this._benchmarkStart === null && (this._benchmarkStart = window.performance.now());
  }
  stopBenchmarking() {
    if (this._benchmarkStart !== null) {
      const t = window.performance.now(), e = t - this._benchmarkStart, r = performance.getEntriesByName("uv-virtualizing", "measure").filter((n) => n.startTime >= this._benchmarkStart && n.startTime < t).reduce((n, o) => n + o.duration, 0);
      return this._benchmarkStart = null, { timeElapsed: e, virtualizationTime: r };
    }
    return null;
  }
  _measureChildren() {
    const t = {}, e = this._children, s = this._measureChildOverride || this._measureChild;
    for (let r = 0; r < e.length; r++) {
      const n = e[r], o = this._first + r;
      (this._itemsChanged || this._toBeMeasured.has(n)) && (t[o] = s.call(this, n, this._items[o]));
    }
    this._childMeasurements = t, this._schedule(this._updateLayout), this._toBeMeasured.clear();
  }
  /**
   * Returns the width, height, and margins of the given child.
   */
  _measureChild(t) {
    const { width: e, height: s } = t.getBoundingClientRect();
    return Object.assign({ width: e, height: s }, ki(t));
  }
  async _schedule(t) {
    this._scheduled.has(t) || (this._scheduled.add(t), await Promise.resolve(), this._scheduled.delete(t), t.call(this));
  }
  async _updateDOM(t) {
    this._scrollSize = t.scrollSize, this._adjustRange(t.range), this._childrenPos = t.childPositions, this._scrollError = t.scrollError || null;
    const { _rangeChanged: e, _itemsChanged: s } = this;
    this._visibilityChanged && (this._notifyVisibility(), this._visibilityChanged = !1), (e || s) && (this._notifyRange(), this._rangeChanged = !1), this._finishDOMUpdate();
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
    t.type === "stateChanged" ? this._updateDOM(t) : t.type === "visibilityChanged" ? (this._firstVisible = t.firstVisible, this._lastVisible = t.lastVisible, this._notifyVisibility()) : t.type === "unpinned" && this._hostElement.dispatchEvent(new _t());
  }
  get _children() {
    const t = [];
    let e = this._hostElement.firstElementChild;
    for (; e; )
      e.hasAttribute(rt) || t.push(e), e = e.nextElementSibling;
    return t;
  }
  _updateView() {
    var r;
    const t = this._hostElement, e = (r = this._scrollerController) == null ? void 0 : r.element, s = this._layout;
    if (t && e && s) {
      let n, o, a, l;
      const h = t.getBoundingClientRect();
      n = 0, o = 0, a = window.innerHeight, l = window.innerWidth;
      const u = this._clippingAncestors.map((z) => z.getBoundingClientRect());
      u.unshift(h);
      for (const z of u)
        n = Math.max(n, z.top), o = Math.max(o, z.left), a = Math.min(a, z.bottom), l = Math.min(l, z.right);
      const c = e.getBoundingClientRect(), y = {
        left: h.left - c.left,
        top: h.top - c.top
      }, f = {
        width: e.scrollWidth,
        height: e.scrollHeight
      }, b = n - h.top + t.scrollTop, E = o - h.left + t.scrollLeft, B = Math.max(0, a - n), st = Math.max(0, l - o);
      s.viewportSize = { width: st, height: B }, s.viewportScroll = { top: b, left: E }, s.totalScrollSize = f, s.offsetWithinScroller = y;
    }
  }
  /**
   * Styles the host element so that its size reflects the
   * total size of all items.
   */
  _sizeHostElement(t) {
    const s = t && t.width !== null ? Math.min(82e5, t.width) : 0, r = t && t.height !== null ? Math.min(82e5, t.height) : 0;
    if (this._isScroller)
      this._getSizer().style.transform = `translate(${s}px, ${r}px)`;
    else {
      const n = this._hostElement.style;
      n.minWidth = s ? `${s}px` : "100%", n.minHeight = r ? `${r}px` : "100%";
    }
  }
  /**
   * Sets the top and left transform style of the children from the values in
   * pos.
   */
  _positionChildren(t) {
    t && t.forEach(({ top: e, left: s, width: r, height: n, xOffset: o, yOffset: a }, l) => {
      const h = this._children[l - this._first];
      h && (h.style.position = "absolute", h.style.boxSizing = "border-box", h.style.transform = `translate(${s}px, ${e}px)`, r !== void 0 && (h.style.width = r + "px"), n !== void 0 && (h.style.height = n + "px"), h.style.left = o === void 0 ? null : o + "px", h.style.top = a === void 0 ? null : a + "px");
    });
  }
  async _adjustRange(t) {
    const { _first: e, _last: s, _firstVisible: r, _lastVisible: n } = this;
    this._first = t.first, this._last = t.last, this._firstVisible = t.firstVisible, this._lastVisible = t.lastVisible, this._rangeChanged = this._rangeChanged || this._first !== e || this._last !== s, this._visibilityChanged = this._visibilityChanged || this._firstVisible !== r || this._lastVisible !== n;
  }
  _correctScrollError() {
    if (this._scrollError) {
      const { scrollTop: t, scrollLeft: e } = this._scrollerController, { top: s, left: r } = this._scrollError;
      this._scrollError = null, this._scrollerController.correctScrollError({
        top: t - s,
        left: e - r
      });
    }
  }
  element(t) {
    var e;
    return t === 1 / 0 && (t = this._items.length - 1), ((e = this._items) == null ? void 0 : e[t]) === void 0 ? void 0 : {
      scrollIntoView: (s = {}) => this._scrollElementIntoView({ ...s, index: t })
    };
  }
  _scrollElementIntoView(t) {
    if (t.index >= this._first && t.index <= this._last)
      this._children[t.index - this._first].scrollIntoView(t);
    else if (t.index = Math.min(t.index, this._items.length - 1), t.behavior === "smooth") {
      const e = this._layout.getScrollIntoViewCoordinates(t), { behavior: s } = t;
      this._updateScrollIntoViewCoordinates = this._scrollerController.managedScrollTo(Object.assign(e, { behavior: s }), () => this._layout.getScrollIntoViewCoordinates(t), () => this._scrollIntoViewTarget = null), this._scrollIntoViewTarget = t;
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
    this._hostElement.dispatchEvent(new bt({ first: this._first, last: this._last }));
  }
  _notifyVisibility() {
    this._hostElement.dispatchEvent(new vt({
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
      for (const s of t)
        this._toBeMeasured.set(s.target, s.contentRect);
      this._measureChildren();
    }
    this._scheduleLayoutComplete(), this._itemsChanged = !1, this._rangeChanged = !1;
  }
}
function ki(i) {
  const t = window.getComputedStyle(i);
  return {
    marginTop: nt(t.marginTop),
    marginRight: nt(t.marginRight),
    marginBottom: nt(t.marginBottom),
    marginLeft: nt(t.marginLeft)
  };
}
function nt(i) {
  const t = i ? parseFloat(i) : NaN;
  return Number.isNaN(t) ? 0 : t;
}
function te(i) {
  if (i.assignedSlot !== null)
    return i.assignedSlot;
  if (i.parentElement !== null)
    return i.parentElement;
  const t = i.parentNode;
  return t && t.nodeType === Node.DOCUMENT_FRAGMENT_NODE && t.host || null;
}
function $i(i, t = !1) {
  const e = [];
  let s = t ? i : te(i);
  for (; s !== null; )
    e.push(s), s = te(s);
  return e;
}
function Si(i, t = !1) {
  let e = !1;
  return $i(i, t).filter((s) => {
    if (e)
      return !1;
    const r = getComputedStyle(s);
    return e = r.position === "fixed", r.overflow !== "visible";
  });
}
/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const ve = (i) => i, _e = (i, t) => p`${t}: ${JSON.stringify(i, null, 2)}`;
class Ci extends gi {
  constructor(t) {
    if (super(t), this._virtualizer = null, this._first = 0, this._last = -1, this._renderItem = (e, s) => _e(e, s + this._first), this._keyFunction = (e, s) => ve(e, s + this._first), this._items = [], t.type !== gt.CHILD)
      throw new Error("The virtualize directive can only be used in child expressions");
  }
  render(t) {
    t && this._setFunctions(t);
    const e = [];
    if (this._first >= 0 && this._last >= this._first)
      for (let s = this._first; s <= this._last; s++)
        e.push(this._items[s]);
    return bi(e, this._keyFunction, this._renderItem);
  }
  update(t, [e]) {
    this._setFunctions(e);
    const s = this._items !== e.items;
    return this._items = e.items || [], this._virtualizer ? this._updateVirtualizerConfig(t, e) : this._initialize(t, e), s ? A : this.render();
  }
  async _updateVirtualizerConfig(t, e) {
    if (!await this._virtualizer.updateLayoutConfig(e.layout || {})) {
      const r = t.parentNode;
      this._makeVirtualizer(r, e);
    }
    this._virtualizer.items = this._items;
  }
  _setFunctions(t) {
    const { renderItem: e, keyFunction: s } = t;
    e && (this._renderItem = (r, n) => e(r, n + this._first)), s && (this._keyFunction = (r, n) => s(r, n + this._first));
  }
  _makeVirtualizer(t, e) {
    this._virtualizer && this._virtualizer.disconnected();
    const { layout: s, scroller: r, items: n } = e;
    this._virtualizer = new wi({ hostElement: t, layout: s, scroller: r }), this._virtualizer.items = n, this._virtualizer.connected();
  }
  _initialize(t, e) {
    const s = t.parentNode;
    s && s.nodeType === 1 && (s.addEventListener("rangeChanged", (r) => {
      this._first = r.first, this._last = r.last, this.setValue(this.render());
    }), this._makeVirtualizer(s, e));
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
const Ei = Ut(Ci);
/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
class F extends j {
  constructor() {
    super(...arguments), this.items = [], this.renderItem = _e, this.keyFunction = ve, this.layout = {}, this.scroller = !1;
  }
  createRenderRoot() {
    return this;
  }
  render() {
    const { items: t, renderItem: e, keyFunction: s, layout: r, scroller: n } = this;
    return p`${Ei({
      items: t,
      renderItem: e,
      keyFunction: s,
      layout: r,
      scroller: n
    })}`;
  }
  element(t) {
    var e;
    return (e = this[Mt]) == null ? void 0 : e.element(t);
  }
  get layoutComplete() {
    var t;
    return (t = this[Mt]) == null ? void 0 : t.layoutComplete;
  }
  /**
   * This scrollToIndex() shim is here to provide backwards compatibility with other 0.x versions of
   * lit-virtualizer. It is deprecated and will likely be removed in the 1.0.0 release.
   */
  scrollToIndex(t, e = "start") {
    var s;
    (s = this.element(t)) == null || s.scrollIntoView({ block: e });
  }
}
it([
  v({ attribute: !1 })
], F.prototype, "items", void 0);
it([
  v()
], F.prototype, "renderItem", void 0);
it([
  v()
], F.prototype, "keyFunction", void 0);
it([
  v({ attribute: !1 })
], F.prototype, "layout", void 0);
it([
  v({ reflect: !0, type: Boolean })
], F.prototype, "scroller", void 0);
/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
customElements.define("lit-virtualizer", F);
const Ai = /^(https?:|mailto:)/i, xi = /\uE000L(\d+)\uE000/g;
function Ti(i) {
  return i.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function ee(i) {
  return i.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/__(.+?)__/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/_(.+?)_/g, "<em>$1</em>");
}
function Pi(i) {
  if (!i) return "";
  let t = Ti(i.replace(/\uE000/g, ""));
  const e = [];
  return t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (s, r, n) => Ai.test(n) ? (e.push(
    `<a href="${n}" target="_blank" rel="noopener noreferrer">${ee(r)}</a>`
  ), `L${e.length - 1}`) : r), t = ee(t), t = t.replace(/\n/g, "<br>"), t = t.replace(xi, (s, r) => e[Number(r)] ?? ""), t;
}
function Mi(i) {
  if (!i.length) return null;
  let t = 0;
  for (const e of i) {
    if (typeof e.durationMs != "number") return null;
    t += e.durationMs;
  }
  return t;
}
function Ii(i) {
  const t = Math.round(i / 6e4);
  if (t < 60) return `${t} min`;
  const e = Math.floor(t / 60), s = t % 60;
  return s ? `${e} hr ${s} min` : `${e} hr`;
}
const Ri = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function ie(i) {
  if (!i) return null;
  const t = new Date(i);
  return Number.isNaN(t.getTime()) ? null : `${Ri[t.getMonth()]} ${t.getFullYear()}`;
}
function Li(i, t) {
  const e = ie(i), s = ie(t);
  return !e && !s ? null : e ? !s || e === s ? e : `${e} – ${s}` : s;
}
class Oi {
  constructor(t, e, s = () => {
  }, r = {}) {
    var n, o;
    this.provider = t, this.tracks = e, this.onChange = s, this.state = "uninitialized", this.halted = !1, this.shuffle = !1, this.positionMs = 0, this.durationMs = 0, this.failed = /* @__PURE__ */ new Set(), this.unavailable = /* @__PURE__ */ new Set(), this.pos = 0, this.loadedIndex = null, this.consecutiveErrors = 0, this.skipDelayMs = r.skipDelayMs ?? 0, this.errorLimit = r.errorLimit ?? 3, this.debug = r.debug ?? !1, this.random = r.random ?? Math.random, this.order = e.map((a, l) => l), this.provider.onStateChange((a) => this.handle(a)), (o = (n = this.provider).onProgress) == null || o.call(n, (a, l) => {
      this.positionMs = a, this.durationMs = l, this.onChange();
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
      const s = this.order.filter((r) => r !== e);
      this.order = [e, ...this.shuffled(s)];
    } else
      this.order = this.tracks.map((s, r) => r);
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
    for (let s = e.length - 1; s > 0; s--) {
      const r = Math.floor(this.random() * (s + 1));
      [e[s], e[r]] = [e[r], e[s]];
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
const se = 250;
class Ui {
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
      this.positionMs = Math.min(this.positionMs + se, this.durationMs), this.progressCallback(this.positionMs, this.durationMs);
    }, se), this.timer = setTimeout(() => {
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
function P(i, t) {
  const e = (i & 65535) + (t & 65535);
  return (i >> 16) + (t >> 16) + (e >> 16) << 16 | e & 65535;
}
function zi(i, t) {
  return i << t | i >>> 32 - t;
}
function wt(i, t, e, s, r, n) {
  return P(zi(P(P(t, i), P(s, n)), r), e);
}
function w(i, t, e, s, r, n, o) {
  return wt(t & e | ~t & s, i, t, r, n, o);
}
function k(i, t, e, s, r, n, o) {
  return wt(t & s | e & ~s, i, t, r, n, o);
}
function $(i, t, e, s, r, n, o) {
  return wt(t ^ e ^ s, i, t, r, n, o);
}
function S(i, t, e, s, r, n, o) {
  return wt(e ^ (t | ~s), i, t, r, n, o);
}
function Ni(i, t) {
  i[t >> 5] |= 128 << t % 32, i[(t + 64 >>> 9 << 4) + 14] = t;
  let e = 1732584193, s = -271733879, r = -1732584194, n = 271733878;
  for (let o = 0; o < i.length; o += 16) {
    const a = e, l = s, h = r, u = n;
    e = w(e, s, r, n, i[o] | 0, 7, -680876936), n = w(n, e, s, r, i[o + 1] | 0, 12, -389564586), r = w(r, n, e, s, i[o + 2] | 0, 17, 606105819), s = w(s, r, n, e, i[o + 3] | 0, 22, -1044525330), e = w(e, s, r, n, i[o + 4] | 0, 7, -176418897), n = w(n, e, s, r, i[o + 5] | 0, 12, 1200080426), r = w(r, n, e, s, i[o + 6] | 0, 17, -1473231341), s = w(s, r, n, e, i[o + 7] | 0, 22, -45705983), e = w(e, s, r, n, i[o + 8] | 0, 7, 1770035416), n = w(n, e, s, r, i[o + 9] | 0, 12, -1958414417), r = w(r, n, e, s, i[o + 10] | 0, 17, -42063), s = w(s, r, n, e, i[o + 11] | 0, 22, -1990404162), e = w(e, s, r, n, i[o + 12] | 0, 7, 1804603682), n = w(n, e, s, r, i[o + 13] | 0, 12, -40341101), r = w(r, n, e, s, i[o + 14] | 0, 17, -1502002290), s = w(s, r, n, e, i[o + 15] | 0, 22, 1236535329), e = k(e, s, r, n, i[o + 1] | 0, 5, -165796510), n = k(n, e, s, r, i[o + 6] | 0, 9, -1069501632), r = k(r, n, e, s, i[o + 11] | 0, 14, 643717713), s = k(s, r, n, e, i[o] | 0, 20, -373897302), e = k(e, s, r, n, i[o + 5] | 0, 5, -701558691), n = k(n, e, s, r, i[o + 10] | 0, 9, 38016083), r = k(r, n, e, s, i[o + 15] | 0, 14, -660478335), s = k(s, r, n, e, i[o + 4] | 0, 20, -405537848), e = k(e, s, r, n, i[o + 9] | 0, 5, 568446438), n = k(n, e, s, r, i[o + 14] | 0, 9, -1019803690), r = k(r, n, e, s, i[o + 3] | 0, 14, -187363961), s = k(s, r, n, e, i[o + 8] | 0, 20, 1163531501), e = k(e, s, r, n, i[o + 13] | 0, 5, -1444681467), n = k(n, e, s, r, i[o + 2] | 0, 9, -51403784), r = k(r, n, e, s, i[o + 7] | 0, 14, 1735328473), s = k(s, r, n, e, i[o + 12] | 0, 20, -1926607734), e = $(e, s, r, n, i[o + 5] | 0, 4, -378558), n = $(n, e, s, r, i[o + 8] | 0, 11, -2022574463), r = $(r, n, e, s, i[o + 11] | 0, 16, 1839030562), s = $(s, r, n, e, i[o + 14] | 0, 23, -35309556), e = $(e, s, r, n, i[o + 1] | 0, 4, -1530992060), n = $(n, e, s, r, i[o + 4] | 0, 11, 1272893353), r = $(r, n, e, s, i[o + 7] | 0, 16, -155497632), s = $(s, r, n, e, i[o + 10] | 0, 23, -1094730640), e = $(e, s, r, n, i[o + 13] | 0, 4, 681279174), n = $(n, e, s, r, i[o] | 0, 11, -358537222), r = $(r, n, e, s, i[o + 3] | 0, 16, -722521979), s = $(s, r, n, e, i[o + 6] | 0, 23, 76029189), e = $(e, s, r, n, i[o + 9] | 0, 4, -640364487), n = $(n, e, s, r, i[o + 12] | 0, 11, -421815835), r = $(r, n, e, s, i[o + 15] | 0, 16, 530742520), s = $(s, r, n, e, i[o + 2] | 0, 23, -995338651), e = S(e, s, r, n, i[o] | 0, 6, -198630844), n = S(n, e, s, r, i[o + 7] | 0, 10, 1126891415), r = S(r, n, e, s, i[o + 14] | 0, 15, -1416354905), s = S(s, r, n, e, i[o + 5] | 0, 21, -57434055), e = S(e, s, r, n, i[o + 12] | 0, 6, 1700485571), n = S(n, e, s, r, i[o + 3] | 0, 10, -1894986606), r = S(r, n, e, s, i[o + 10] | 0, 15, -1051523), s = S(s, r, n, e, i[o + 1] | 0, 21, -2054922799), e = S(e, s, r, n, i[o + 8] | 0, 6, 1873313359), n = S(n, e, s, r, i[o + 15] | 0, 10, -30611744), r = S(r, n, e, s, i[o + 6] | 0, 15, -1560198380), s = S(s, r, n, e, i[o + 13] | 0, 21, 1309151649), e = S(e, s, r, n, i[o + 4] | 0, 6, -145523070), n = S(n, e, s, r, i[o + 11] | 0, 10, -1120210379), r = S(r, n, e, s, i[o + 2] | 0, 15, 718787259), s = S(s, r, n, e, i[o + 9] | 0, 21, -343485551), e = P(e, a), s = P(s, l), r = P(r, h), n = P(n, u);
  }
  return [e, s, r, n];
}
function Di(i) {
  let t = "";
  for (let e = 0; e < i.length * 32; e += 8)
    t += String.fromCharCode(i[e >> 5] >>> e % 32 & 255);
  return t;
}
function ji(i) {
  const t = [];
  for (let e = 0; e < i.length * 8; e += 8)
    t[e >> 5] = (t[e >> 5] || 0) | (i.charCodeAt(e / 8) & 255) << e % 32;
  return t;
}
function Hi(i) {
  return Di(Ni(ji(i), i.length * 8));
}
function Vi(i) {
  const t = "0123456789abcdef";
  let e = "";
  for (let s = 0; s < i.length; s += 1) {
    const r = i.charCodeAt(s);
    e += t.charAt(r >>> 4 & 15) + t.charAt(r & 15);
  }
  return e;
}
function Fi(i) {
  const t = new TextEncoder().encode(i);
  let e = "";
  for (const s of t) e += String.fromCharCode(s);
  return e;
}
function Bi(i) {
  return Vi(Hi(Fi(i)));
}
function C(i) {
  if (i.isrc) return "isrc:" + i.isrc.toLowerCase();
  if (i.byomId) return "byom:" + i.byomId;
  const t = (e) => e.trim().toLowerCase().replace(/\s+/g, " ");
  return `q:${t(i.artist)}|${t(i.title)}`;
}
const re = "byom-player:resolv:v1", Ki = 5e4, qi = 3600 * 1e3, W = "\0";
class kt {
  constructor(t = {}) {
    this.storage = t.storage === void 0 ? Wi() : t.storage, this.maxEntries = t.maxEntries ?? Ki, this.missTtlMs = t.missTtlMs ?? qi, this.now = t.now ?? (() => Date.now()), this.map = this.load();
  }
  get(t, e) {
    const s = t + W + e, r = this.map.get(s);
    if (r) {
      if ("id" in r) return r.id;
      if (this.now() - r.m >= this.missTtlMs) {
        this.map.delete(s), this.persist();
        return;
      }
      return null;
    }
  }
  set(t, e, s) {
    this.store(t + W + e, { id: s });
  }
  setMiss(t, e) {
    this.store(t + W + e, { m: this.now() });
  }
  store(t, e) {
    for (this.map.set(t, e); this.map.size > this.maxEntries; ) {
      const s = this.map.keys().next().value;
      if (s === void 0) break;
      this.map.delete(s);
    }
    this.persist();
  }
  evict(t, e) {
    this.map.delete(t + W + e) && this.persist();
  }
  clear(t) {
    const e = t + W;
    let s = !1;
    for (const r of this.map.keys())
      r.startsWith(e) && (this.map.delete(r), s = !0);
    s && this.persist();
  }
  load() {
    const t = /* @__PURE__ */ new Map();
    if (!this.storage) return t;
    try {
      const e = this.storage.getItem(re);
      if (!e) return t;
      const s = JSON.parse(e);
      for (const [r, n] of Object.entries(s))
        typeof n == "string" ? t.set(r, { id: n }) : n && typeof n == "object" && ("id" in n || "m" in n) && t.set(r, n);
    } catch {
      return /* @__PURE__ */ new Map();
    }
    return t;
  }
  persist() {
    if (this.storage)
      try {
        this.storage.setItem(re, JSON.stringify(Object.fromEntries(this.map)));
      } catch {
      }
  }
}
function Wi() {
  try {
    return typeof localStorage < "u" ? localStorage : null;
  } catch {
    return null;
  }
}
const Yi = "1.16.1", Qi = "byom-player", Ji = 30, Xi = 240;
class Gi {
  constructor(t) {
    this.name = "subsonic", this.isCollection = !0, this.audio = new Audio(), this.listeners = new AbortController(), this.callback = () => {
    }, this.progressCallback = () => {
    }, this.currentId = null, this.nowPlayingSent = !1, this.submitted = !1, this.currentTrack = null, this.currentKey = null, this.currentIdFromCache = !1, this.retriedStale = !1, this.hasPlayed = !1, this.cfg = t, this.scope = "subsonic:" + this.cfg.baseUrl.replace(/\/$/, ""), this.cache = this.cfg.cache === !1 ? null : this.cfg.resolutionCache ?? new kt(), this.cfg.token && this.cfg.salt ? (this.authToken = this.cfg.token, this.authSalt = this.cfg.salt) : this.cfg.password && (this.authSalt = Zi(), this.authToken = Bi(this.cfg.password + this.authSalt));
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
    if (!this.currentId || this.submitted || !this.scrobbleEnabled() || e < Ji) return;
    const s = Math.min(e / 2, Xi);
    t >= s && (this.submitted = !0, this.scrobble(this.currentId, !0));
  }
  // scrobble notifies the server of a play. Fire-and-forget: it never awaits,
  // never routes through the retrying fetchJson, and never affects provider
  // state — a flaky scrobble must not disrupt playback or trip the breaker.
  // submission=false is a "now playing" ping; submission=true is a play count.
  // Navidrome also accepts the bare /rest/scrobble alias.
  scrobble(t, e) {
    const s = this.url("scrobble.view", {
      id: t,
      submission: String(e),
      time: String(Date.now())
    });
    fetch(s).catch((r) => this.log("scrobble failed", r));
  }
  async initialize() {
    this.callback("ready");
  }
  async load(t) {
    var s;
    this.currentId = null, this.nowPlayingSent = !1, this.submitted = !1, this.currentTrack = t, this.currentKey = C(t), this.retriedStale = !1, this.hasPlayed = !1, this.currentIdFromCache = !!((s = this.cache) != null && s.get(this.scope, this.currentKey));
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
    var a, l, h, u, c, y, f;
    const e = C(t), s = (a = this.cache) == null ? void 0 : a.get(this.scope, e);
    if (s)
      return this.log("cache hit", t.artist, "-", t.title, "->", s), s;
    if (s === null)
      return this.log("cache miss (known)", t.artist, "-", t.title), null;
    const r = `${t.artist} ${t.title}`.trim(), n = await this.fetchJson(this.url("search3.view", { query: r, songCount: "1" })), o = ((c = (u = (h = (l = n == null ? void 0 : n["subsonic-response"]) == null ? void 0 : l.searchResult3) == null ? void 0 : h.song) == null ? void 0 : u[0]) == null ? void 0 : c.id) ?? null;
    return o ? (y = this.cache) == null || y.set(this.scope, e, o) : (f = this.cache) == null || f.setMiss(this.scope, e), o;
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
    const e = this.cfg.retries ?? 2, s = this.cfg.retryDelayMs ?? 400;
    for (let n = 0; ; n++)
      try {
        const o = await fetch(t);
        if (!o.ok) throw new Error(`HTTP ${o.status}`);
        const a = await o.json();
        if (((r = a == null ? void 0 : a["subsonic-response"]) == null ? void 0 : r.status) === "failed")
          throw new Error("subsonic-response status failed");
        return a;
      } catch (o) {
        if (n >= e) throw o;
        await new Promise((a) => setTimeout(a, s * (n + 1)));
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
    const t = new URLSearchParams({ v: Yi, c: Qi, f: "json" });
    return this.cfg.apiKey ? t.set("apiKey", this.cfg.apiKey) : this.authToken && this.authSalt && (this.cfg.username && t.set("u", this.cfg.username), t.set("t", this.authToken), t.set("s", this.authSalt)), t;
  }
  url(t, e) {
    const s = this.authParams();
    for (const [n, o] of Object.entries(e)) s.set(n, o);
    return `${this.cfg.baseUrl.replace(/\/$/, "")}/rest/${t}?${s.toString()}`;
  }
}
function Zi() {
  const i = new Uint8Array(8);
  return crypto.getRandomValues(i), Array.from(i, (t) => t.toString(16).padStart(2, "0")).join("");
}
const Y = "youtube", ts = 0, we = 1, es = 2, is = 5, ss = -1, rs = 250, ns = 2, os = 100, as = 101, ls = 150;
function hs(i) {
  switch (i) {
    case ns:
    case os:
    case as:
    case ls:
      return "unavailable";
    default:
      return "error";
  }
}
function cs(i) {
  switch (i) {
    case ts:
      return "ended";
    case we:
      return "playing";
    case es:
      return "paused";
    case is:
    case ss:
      return "ready";
    default:
      return null;
  }
}
class ds {
  // a real video is loaded (guards play() on the empty player)
  constructor(t) {
    this.name = "youtube", this.stateCallback = () => {
    }, this.progressCallback = () => {
    }, this.ticker = null, this.cued = !1, this.cfg = t, this.engine = this.cfg.engine ?? new ps(), this.engine.onState((e) => this.handleYtState(e)), this.engine.onError((e) => this.handleYtError(e)), this.cache = this.cfg.cache === !1 ? null : this.cfg.resolutionCache ?? new kt();
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
    } catch (s) {
      this.log("resolve error", t.artist, "-", t.title, s), this.cued = !1, this.stateCallback("error");
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
    var n, o;
    const e = this.cachedId(t);
    if (e) return e;
    if (e === null || !this.searchConfigured()) return null;
    const s = await this.liveSearch(t), r = C(t);
    return s ? (n = this.cache) == null || n.set(Y, r, s) : (o = this.cache) == null || o.setMiss(Y, r), s;
  }
  searchConfigured() {
    return !!(this.cfg.apiKey || this.cfg.searchEndpoint);
  }
  // cachedId returns the embedded videoId (from the manifest), else the cache's
  // answer: a hit (string), a known miss (null), or unknown (undefined).
  cachedId(t) {
    var e, s;
    return ((e = t.resolvedIds) == null ? void 0 : e.youtube) ?? ((s = this.cache) == null ? void 0 : s.get(Y, C(t)));
  }
  // liveSearch performs the actual "{artist} {title} audio" lookup. Only called
  // when a searchEndpoint or apiKey is configured. Returns null on a clean miss;
  // throws on transient HTTP failure.
  async liveSearch(t) {
    var o, a, l, h, u, c;
    const e = `${t.artist} ${t.title} audio`.trim();
    if (this.cfg.apiKey) {
      const y = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(e)}&key=${encodeURIComponent(this.cfg.apiKey)}`, f = await this.fetchJson(y);
      return ((l = (a = (o = f == null ? void 0 : f.items) == null ? void 0 : o[0]) == null ? void 0 : a.id) == null ? void 0 : l.videoId) ?? null;
    }
    const s = this.cfg.searchEndpoint.includes("?") ? "&" : "?", r = `${this.cfg.searchEndpoint}${s}q=${encodeURIComponent(e)}`, n = await this.fetchJson(r);
    return (n == null ? void 0 : n.videoId) ?? ((c = (u = (h = n == null ? void 0 : n.items) == null ? void 0 : h[0]) == null ? void 0 : u.id) == null ? void 0 : c.videoId) ?? null;
  }
  // checkAvailability mirrors the resolution chain without playing: embedded/
  // cached ids answer for free; a live search runs only if configured (and only
  // then does it spend quota). Unknown (not error) when we can't tell.
  async checkAvailability(t) {
    var s, r;
    const e = this.cachedId(t);
    if (e) return "available";
    if (e === null || !this.searchConfigured()) return "unavailable";
    try {
      const n = await this.liveSearch(t), o = C(t);
      return n ? ((s = this.cache) == null || s.set(Y, o, n), "available") : ((r = this.cache) == null || r.setMiss(Y, o), "unavailable");
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
    const e = cs(t);
    e && this.stateCallback(e), t === we ? this.startTicker() : this.stopTicker();
  }
  // Playback failed. Stop progress ticks and emit the mapped state so the
  // controller can advance (unavailable → clean skip) or account for a
  // transient error (error → circuit breaker).
  handleYtError(t) {
    const e = hs(t);
    this.log("player error", t, "->", e), this.stopTicker(), this.stateCallback(e);
  }
  startTicker() {
    this.stopTicker(), this.progressCallback(this.engine.currentTimeMs(), this.engine.durationMs()), this.ticker = setInterval(() => {
      this.progressCallback(this.engine.currentTimeMs(), this.engine.durationMs());
    }, rs);
  }
  stopTicker() {
    this.ticker && (clearInterval(this.ticker), this.ticker = null);
  }
  log(...t) {
    this.cfg.debug && console.debug("[byom-player:youtube]", ...t);
  }
}
let ot = null;
function us() {
  return ot || (ot = new Promise((i) => {
    if (window.YT && window.YT.Player) {
      i();
      return;
    }
    const t = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      t == null || t(), i();
    };
    const e = document.createElement("script");
    e.src = "https://www.youtube.com/iframe_api", document.head.appendChild(e);
  }), ot);
}
class ps {
  constructor() {
    this.player = null, this.hiddenContainer = null, this.target = null, this.stateCallback = () => {
    }, this.errorCallback = () => {
    };
  }
  attach(t) {
    this.target = t;
  }
  async ready() {
    if (await us(), this.player) return;
    const t = document.createElement("div"), e = !!this.target;
    this.target ? (t.style.cssText = "width:100%;height:100%;", this.target.appendChild(t)) : (this.hiddenContainer = document.createElement("div"), this.hiddenContainer.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;", document.body.appendChild(this.hiddenContainer), this.hiddenContainer.appendChild(t)), await new Promise((s) => {
      this.player = new window.YT.Player(t, {
        width: e ? "100%" : "1",
        height: e ? "100%" : "1",
        events: {
          onReady: () => s(),
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
    var t, e, s;
    (e = (t = this.player) == null ? void 0 : t.destroy) == null || e.call(t), (s = this.hiddenContainer) == null || s.remove();
  }
}
class ke extends Error {
  constructor(t = "Spotify account is not Premium") {
    super(t), this.name = "NotPremiumError";
  }
}
const fs = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state"
  // required to control the SDK device via /me/player
], ms = "https://accounts.spotify.com/authorize", ne = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
function ys(i = 64) {
  const t = new Uint8Array(i);
  crypto.getRandomValues(t);
  let e = "";
  for (const s of t) e += ne[s % ne.length];
  return e;
}
async function gs(i) {
  const t = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(i));
  return vs(new Uint8Array(t));
}
function bs(i, t) {
  const e = new URL(ms);
  return e.search = new URLSearchParams({
    response_type: "code",
    client_id: i.clientId,
    redirect_uri: i.redirectUri,
    scope: (i.scopes ?? fs).join(" "),
    code_challenge_method: "S256",
    code_challenge: t
  }).toString(), e.toString();
}
function vs(i) {
  let t = "";
  for (const e of i) t += String.fromCharCode(e);
  return btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const _s = "https://accounts.spotify.com/api/token", ws = 6e4;
class ks {
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
async function $e(i, t, e) {
  const s = await fetch(_s, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: i
  });
  if (!s.ok) throw new Error(`Spotify token endpoint returned ${s.status}`);
  const r = await s.json();
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token ?? e ?? "",
    expiresAt: t() + r.expires_in * 1e3
  };
}
function $s(i, t, e, s = Date.now) {
  return $e(
    new URLSearchParams({
      grant_type: "authorization_code",
      code: t,
      redirect_uri: i.redirectUri,
      client_id: i.clientId,
      code_verifier: e
    }),
    s
  );
}
function Ss(i, t, e = Date.now) {
  return $e(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: t,
      client_id: i.clientId
    }),
    e,
    t
  );
}
class Cs {
  constructor(t, e = {}) {
    this.cfg = t, this.store = e.store ?? new ks(t.clientId), this.win = e.win ?? window, this.now = e.now ?? Date.now;
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
    if (t.expiresAt - ws > this.now()) return t.accessToken;
    const e = await Ss(this.cfg, t.refreshToken, this.now);
    return this.store.save(e), e.accessToken;
  }
  // Opens the authorize popup, awaits the code via postMessage, exchanges it.
  async login() {
    const t = ys(), e = await gs(t), s = this.win.open(
      bs(this.cfg, e),
      "spotify-login",
      "width=480,height=720"
    );
    if (!s) throw new Error("Spotify login popup was blocked");
    const r = await this.awaitCode(s), n = await $s(this.cfg, r, t, this.now);
    return this.store.save(n), n.accessToken;
  }
  awaitCode(t) {
    const e = new URL(this.cfg.redirectUri).origin;
    return new Promise((s, r) => {
      const n = (l) => {
        if (l.origin !== e || typeof l.data != "string") return;
        const h = new URLSearchParams(l.data), u = h.get("code"), c = h.get("error");
        !u && !c || (a(), c ? r(new Error(`Spotify authorization failed: ${c}`)) : s(u));
      }, o = setInterval(() => {
        t.closed && (a(), r(new Error("Spotify login popup was closed")));
      }, 500), a = () => {
        this.win.removeEventListener("message", n), clearInterval(o);
        try {
          t.close();
        } catch {
        }
      };
      this.win.addEventListener("message", n);
    });
  }
}
const Es = "https://sdk.scdn.co/spotify-player.js", As = "https://api.spotify.com/v1/me/player/play";
let at = null;
function xs() {
  return at || (at = new Promise((i) => {
    if (window.Spotify) {
      i();
      return;
    }
    const t = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      t == null || t(), i();
    };
    const e = document.createElement("script");
    e.src = Es, document.head.appendChild(e);
  }), at);
}
let Q = null, x = null;
function oe(i) {
  x = i;
}
function Ts(i) {
  return Q || (Q = (async () => {
    await xs();
    const t = new window.Spotify.Player({
      name: i,
      getOAuthToken: (e) => {
        x == null || x.token().then((s) => {
          s && e(s);
        });
      },
      volume: 1
    });
    t.addListener("player_state_changed", (e) => x == null ? void 0 : x.handleRawState(e));
    try {
      return await new Promise((e, s) => {
        t.addListener(
          "ready",
          ({ device_id: r }) => e({ player: t, deviceId: r })
        ), t.addListener(
          "account_error",
          ({ message: r }) => s(new ke(r))
        ), t.addListener(
          "authentication_error",
          ({ message: r }) => s(new Error(`Spotify auth error: ${r}`))
        ), t.addListener(
          "initialization_error",
          ({ message: r }) => s(new Error(`Spotify init error: ${r}`))
        ), t.connect();
      });
    } catch (e) {
      throw Q = null, e;
    }
  })(), Q);
}
class Ps {
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
    oe(this);
    const { player: t, deviceId: e } = await Ts(this.cfg.deviceName ?? "byom-player");
    this.player = t, this.deviceId = e;
  }
  async load(t) {
    const e = await this.getToken();
    if (!e || !this.deviceId) throw new Error("Spotify device not ready");
    const s = await fetch(`${As}?device_id=${encodeURIComponent(this.deviceId)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${e}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uris: [t] })
    });
    !s.ok && s.status !== 202 && s.status !== 204 && this.stateCb("error");
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
    (t = this.player) == null || t.pause(), x === this && oe(null), this.player = null;
  }
}
const Ms = "https://open.spotify.com/embed/iframe-api/v1", Is = 750;
let lt = null;
function Rs() {
  return lt || (lt = new Promise((i) => {
    window.onSpotifyIframeApiReady = (e) => i(e);
    const t = document.createElement("script");
    t.src = Ms, document.head.appendChild(t);
  }), lt);
}
class Ls {
  constructor() {
    this.controller = null, this.target = null, this.posMs = 0, this.durMs = 0, this.stateCb = () => {
    };
  }
  attach(t) {
    this.target = t;
  }
  async ready() {
    const t = await Rs(), e = this.target ?? document.body, s = document.createElement("div");
    e.appendChild(s), await new Promise((r) => {
      t.createController(s, { width: "100%", height: 152 }, (n) => {
        this.controller = n, n.addListener(
          "playback_update",
          (o) => {
            this.posMs = o.data.position, this.durMs = o.data.duration, this.durMs > 0 && this.posMs >= this.durMs - Is ? this.stateCb("ended") : this.stateCb(o.data.isPaused ? "paused" : "playing");
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
const Os = 250;
function ae(i) {
  if (!i) return null;
  const t = i.match(/^spotify:track:([A-Za-z0-9]+)/);
  if (t) return t[1];
  const e = i.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/);
  return e ? e[1] : null;
}
class Us {
  constructor(t) {
    this.name = "spotify", this.engine = null, this.target = null, this.disposed = !1, this.connected = !1, this.busy = !1, this.authCallback = () => {
    }, this.stateCallback = () => {
    }, this.progressCallback = () => {
    }, this.ticker = null, this.cfg = t, this.auth = this.cfg.auth ?? new Cs(this.cfg);
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
      if (t instanceof ke)
        this.log("account not premium — falling back to embed"), await this.useEngine("embed");
      else {
        this.log("sdk connect error", t), this.stateCallback("error");
        return;
      }
    }
    this.connected = !0, this.notifyAuth(), this.stateCallback("ready");
  }
  async load(t) {
    var s;
    const e = ae(t.spotifyUrl);
    if (!e) {
      this.log("no spotify url", t.artist, "-", t.title), this.stateCallback("unavailable");
      return;
    }
    await ((s = this.engine) == null ? void 0 : s.load(`spotify:track:${e}`));
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
    return ae(t.spotifyUrl) ? "available" : "unavailable";
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
    return t === "sdk" ? new Ps(this.cfg, e) : new Ls();
  }
  async useEngine(t) {
    var s;
    if (this.disposed) return;
    this.stopTicker(), (s = this.engine) == null || s.destroy(), this.engine = null, this.target && this.target.replaceChildren();
    const e = this.makeEngine(t);
    e.onState((r) => this.handleState(r)), this.target && e.attach(this.target), this.engine = e, await e.ready();
  }
  handleState(t) {
    this.stateCallback(t), t === "playing" ? this.startTicker() : this.stopTicker();
  }
  startTicker() {
    this.stopTicker(), this.tick(), this.ticker = setInterval(() => this.tick(), Os);
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
const zs = "byom-player", dt = "https://plex.tv/api/v2", Ns = "https://app.plex.tv/auth", le = "byom-plex:client-id", ht = "byom-plex:session";
function Ds(i = localStorage) {
  let t = i.getItem(le);
  if (!t) {
    const e = new Uint8Array(16);
    crypto.getRandomValues(e), t = Array.from(e, (s) => s.toString(16).padStart(2, "0")).join(""), i.setItem(le, t);
  }
  return t;
}
class js {
  constructor(t, e = {}) {
    this.fetch = e.fetch ?? fetch.bind(globalThis), this.win = e.win ?? window, this.storage = e.storage ?? localStorage, this.discover = e.discover ?? ((s) => this.defaultDiscover(s)), this.pollIntervalMs = e.pollIntervalMs ?? 1500, this.maxPolls = e.maxPolls ?? 120, this.product = t.product ?? zs, this.serverName = t.serverName, this.clientId = Ds(this.storage);
  }
  // Real discovery: resolve a single server to a session, or stash the account
  // token + server list so selectServer() can finish a multi-server pick.
  async defaultDiscover(t) {
    this.accountToken = t;
    const e = await Hs(
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
    const r = (await (await this.fetch(`${dt}/resources?includeHttps=1`, {
      headers: { ...this.headers(), "X-Plex-Token": this.accountToken }
    })).json()).find((a) => a.clientIdentifier === t);
    if (!r) throw new Error("Unknown Plex server");
    const o = { baseUrl: await Se(
      this.fetch,
      this.headers(),
      r.connections,
      r.accessToken
    ), token: r.accessToken };
    return this.persist(o), o;
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
    return this.storage.getItem(ht) !== null;
  }
  async getSession() {
    const t = this.storage.getItem(ht);
    if (!t) return null;
    try {
      return JSON.parse(t);
    } catch {
      return null;
    }
  }
  logout() {
    this.storage.removeItem(ht);
  }
  persist(t) {
    this.storage.setItem(ht, JSON.stringify(t));
  }
  async link() {
    const t = await this.createPin(), e = `${Ns}#?clientID=${encodeURIComponent(this.clientId)}&code=${encodeURIComponent(
      t.code
    )}&context%5Bdevice%5D%5Bproduct%5D=${encodeURIComponent(this.product)}`, s = this.win.open(e, "plex-link", "width=600,height=720"), r = await this.pollForToken(t.id, s), n = await this.discover(r);
    "servers" in n || this.persist(n);
    try {
      s == null || s.close();
    } catch {
    }
    return n;
  }
  async createPin() {
    const t = await this.fetch(`${dt}/pins?strong=true`, {
      method: "POST",
      headers: this.headers()
    });
    if (!t.ok) throw new Error(`Plex pin request failed: ${t.status}`);
    const e = await t.json();
    return { id: e.id, code: e.code };
  }
  async pollForToken(t, e) {
    for (let s = 0; s < this.maxPolls; s++) {
      if (e != null && e.closed) throw new Error("Plex login popup was closed");
      const n = await (await this.fetch(`${dt}/pins/${t}`, { headers: this.headers() })).json();
      if (n.authToken) return n.authToken;
      await new Promise((o) => setTimeout(o, this.pollIntervalMs));
    }
    throw new Error("Plex authorization timed out");
  }
}
async function Se(i, t, e, s) {
  const r = [...e].sort((n, o) => Number(o.local) - Number(n.local));
  for (const n of r) {
    const o = n.uri.replace(/\/$/, "");
    try {
      if ((await i(`${o}/identity`, {
        headers: { ...t, "X-Plex-Token": s }
      })).ok) return o;
    } catch {
    }
  }
  throw new Error("No reachable Plex connection");
}
async function Hs(i, t, e) {
  const s = await i.fetch(`${dt}/resources?includeHttps=1`, {
    headers: { ...i.headers, "X-Plex-Token": t }
  });
  if (!s.ok) throw new Error(`Plex resources request failed: ${s.status}`);
  const n = (await s.json()).filter((l) => {
    var h;
    return (h = l.provides) == null ? void 0 : h.split(",").includes("server");
  });
  if (n.length === 0) throw new Error("No Plex servers on this account");
  let o;
  return e.serverName ? o = n.find((l) => l.name === e.serverName) : n.length === 1 && (o = n[0]), o ? { session: { baseUrl: await Se(
    i.fetch,
    i.headers,
    o.connections,
    o.accessToken
  ), token: o.accessToken } } : { servers: n.map((l) => ({ id: l.clientIdentifier, name: l.name })) };
}
function Vs(i) {
  var r, n, o, a;
  const t = i == null ? void 0 : i.MediaContainer;
  if (!t) return null;
  const e = Array.isArray(t.SearchResult) ? t.SearchResult.map((l) => l == null ? void 0 : l.Metadata) : [], s = Array.isArray(t.Metadata) ? t.Metadata : [];
  for (const l of [...e, ...s].filter(Boolean)) {
    if (l.type && l.type !== "track") continue;
    const h = (a = (o = (n = (r = l == null ? void 0 : l.Media) == null ? void 0 : r[0]) == null ? void 0 : n.Part) == null ? void 0 : o[0]) == null ? void 0 : a.key;
    if (typeof h == "string") return h;
  }
  return null;
}
class Fs {
  constructor(t) {
    this.name = "plex", this.isCollection = !0, this.audio = new Audio(), this.listeners = new AbortController(), this.callback = () => {
    }, this.progressCallback = () => {
    }, this.base = "", this.token = "", this.resetCallback = () => {
    }, this.authStatus = "unlinked", this.pendingServers = [], this.busy = !1, this.authCallback = () => {
    }, this.currentTrack = null, this.currentKey = null, this.currentFromCache = !1, this.retriedStale = !1, this.hasPlayed = !1, this.cfg = t, this.base = (this.cfg.baseUrl ?? "").replace(/\/$/, ""), this.token = this.cfg.token ?? "", this.cache = this.cfg.cache === !1 ? null : this.cfg.resolutionCache ?? new kt(), this.auth = this.cfg.auth ?? (this.cfg.baseUrl && this.cfg.token ? void 0 : new js(this.cfg));
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
      } catch (s) {
        this.log("server select failed", s), this.callback("error");
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
    var s;
    this.currentTrack = t, this.currentKey = C(t), this.retriedStale = !1, this.hasPlayed = !1, this.currentFromCache = !!((s = this.cache) != null && s.get(this.scope, this.currentKey));
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
    var a, l, h;
    const e = C(t), s = (a = this.cache) == null ? void 0 : a.get(this.scope, e);
    if (s) return s;
    if (s === null) return null;
    const r = `${t.artist} ${t.title}`.trim(), n = await this.fetchJson(
      this.apiUrl("/library/search", { query: r, searchTypes: "music", limit: "5" })
    ), o = Vs(n);
    return o ? (l = this.cache) == null || l.set(this.scope, e, o) : (h = this.cache) == null || h.setMiss(this.scope, e), o;
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
    const s = new URL(this.base + t);
    s.searchParams.set("X-Plex-Token", this.token);
    for (const [r, n] of Object.entries(e)) s.searchParams.set(r, n);
    return s.toString();
  }
  async fetchJson(t) {
    const e = this.cfg.retries ?? 2, s = this.cfg.retryDelayMs ?? 400;
    for (let r = 0; ; r++)
      try {
        const n = await fetch(t, { headers: { Accept: "application/json" } });
        if (!n.ok) throw new Error(`HTTP ${n.status}`);
        return await n.json();
      } catch (n) {
        if (r >= e) throw n;
        await new Promise((o) => setTimeout(o, s * (r + 1)));
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
const Bs = "mp3,aac,m4a,ogg,oga,opus,webm,wav", Ks = "aac,mp3", he = "byom-player:jellyfin:deviceId";
function Ce(i) {
  return typeof i == "string" ? i.toLowerCase().replace(/\s+/g, " ").trim() : "";
}
function qs(i, t) {
  return t ? [
    ...Array.isArray(i.Artists) ? i.Artists : [],
    i.AlbumArtist
  ].map(Ce).some((s) => s && (s === t || s.includes(t) || t.includes(s))) : !1;
}
function Ws(i, t) {
  const e = i == null ? void 0 : i.Items;
  if (!Array.isArray(e)) return null;
  const s = e.filter(
    (o) => (!(o != null && o.Type) || o.Type === "Audio") && typeof (o == null ? void 0 : o.Id) == "string"
  );
  if (!s.length) return null;
  const r = Ce(t);
  return (s.find((o) => qs(o, r)) ?? s[0]).Id;
}
class Ys {
  constructor(t) {
    this.name = "jellyfin", this.isCollection = !0, this.audio = new Audio(), this.listeners = new AbortController(), this.callback = () => {
    }, this.progressCallback = () => {
    }, this.base = "", this.token = "", this.userId = "", this.currentTrack = null, this.currentKey = null, this.currentFromCache = !1, this.retriedStale = !1, this.hasPlayed = !1, this.cfg = t, this.base = (this.cfg.baseUrl ?? "").replace(/\/$/, ""), this.token = this.cfg.token ?? "", this.userId = this.cfg.userId ?? "", this.deviceId = this.cfg.deviceId ?? Qs(), this.cache = this.cfg.cache === !1 ? null : this.cfg.resolutionCache ?? new kt();
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
    const s = await fetch(this.apiUrl("/Users/AuthenticateByName"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: this.authHeader()
      },
      body: JSON.stringify({ Username: t, Pw: e })
    });
    if (!s.ok) throw new Error(`HTTP ${s.status}`);
    const r = await s.json();
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
    var s;
    this.currentTrack = t, this.currentKey = C(t), this.retriedStale = !1, this.hasPlayed = !1, this.currentFromCache = !!((s = this.cache) != null && s.get(this.scope, this.currentKey));
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
    var a, l, h;
    const e = C(t), s = (a = this.cache) == null ? void 0 : a.get(this.scope, e);
    if (s) return s;
    if (s === null) return null;
    const r = {
      searchTerm: t.title.trim(),
      includeItemTypes: "Audio",
      recursive: "true",
      limit: "10",
      fields: "Artists"
    };
    this.userId && (r.userId = this.userId);
    const n = await this.fetchJson(this.apiUrl("/Items", r)), o = Ws(n, t.artist);
    return o ? (l = this.cache) == null || l.set(this.scope, e, o) : (h = this.cache) == null || h.setMiss(this.scope, e), o;
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
    return e.searchParams.set("api_key", this.token), e.searchParams.set("deviceId", this.deviceId), this.userId && e.searchParams.set("userId", this.userId), e.searchParams.set("container", Bs), e.searchParams.set("audioCodec", Ks), e.toString();
  }
  // API URLs carry the token as an api_key query param (like streamUrl). This
  // keeps GETs as simple CORS requests — no Authorization header means no
  // preflight — matching how the Subsonic/Navidrome provider authenticates.
  apiUrl(t, e = {}) {
    const s = new URL(this.base + t);
    this.token && s.searchParams.set("api_key", this.token);
    for (const [r, n] of Object.entries(e)) s.searchParams.set(r, n);
    return s.toString();
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
function Qs() {
  try {
    const i = localStorage.getItem(he);
    if (i) return i;
    const t = ce();
    return localStorage.setItem(he, t), t;
  } catch {
    return ce();
  }
}
function ce() {
  const i = new Uint8Array(16);
  return crypto.getRandomValues(i), Array.from(i, (t) => t.toString(16).padStart(2, "0")).join("");
}
function Js(i, t) {
  switch (i) {
    case "mock":
      return new Ui();
    case "subsonic":
    case "direct":
      return new Gi(t);
    case "youtube":
      return new ds(t);
    case "spotify":
      return new Us(t);
    case "plex":
      return new Fs(t);
    case "jellyfin":
      return new Ys(t);
    default:
      throw new Error(`Unknown audio provider: ${i}`);
  }
}
const Xs = 31e3, Gs = 5e3;
function Zs(i, t, e) {
  return i !== "spotify" ? !1 : t > 0 && t <= Xs && e > t + Gs;
}
const tr = 300, er = 50;
class ir {
  // a full sweep is in flight; retain() must not prune it
  constructor(t, e, s, r = {}) {
    var n, o;
    this.tracks = e, this.onResult = s, this.pending = [], this.queued = /* @__PURE__ */ new Set(), this.done = /* @__PURE__ */ new Set(), this.inFlight = null, this.draining = !1, this.disposed = !1, this.sweeping = !1, this.check = (n = t.checkAvailability) == null ? void 0 : n.bind(t), this.isCached = (o = t.isResolutionCached) == null ? void 0 : o.bind(t), this.delayMs = r.delayMs ?? (t.isCollection ? er : tr);
  }
  request(t) {
    if (!this.check || this.disposed) return [];
    const e = [];
    for (const s of t)
      s < 0 || s >= this.tracks.length || this.done.has(s) || this.queued.has(s) || s === this.inFlight || (this.queued.add(s), this.pending.push(s), e.push(s));
    return e.length && this.drain(), e;
  }
  // Drop every queued-but-unstarted index that isn't in `keep`, returning the
  // dropped indices. Checked (`done`) indices and the one in-flight check are
  // untouched — the in-flight check finishes and caches its result. Dropped
  // indices become eligible again on a later request() (they were never checked).
  // requestAll queues every track, for an explicit full sweep. Unlike the
  // viewport-driven path this is never pruned by retain(), because the caller
  // wants the whole playlist checked rather than just what is on screen.
  //
  // Only ever called in response to a deliberate user action — a sweep is
  // expensive and must not start on its own.
  requestAll() {
    return this.sweeping = !0, this.request(this.tracks.map((t, e) => e));
  }
  // Stop adding work without discarding what has already been checked, so
  // closing the panel mid-sweep costs nothing and re-summoning resumes.
  stopSweep() {
    this.sweeping = !1, this.pending.length = 0, this.queued.clear();
  }
  // How many tracks have a settled result. The panel shows this as progress;
  // it counts checks, not links, so it rises even when everything is present.
  get checkedCount() {
    return this.done.size;
  }
  // True once every track has a result, so the panel can stop saying "scanning".
  get complete() {
    return this.done.size >= this.tracks.length;
  }
  retain(t) {
    if (this.sweeping) return [];
    const e = [];
    for (let s = this.pending.length - 1; s >= 0; s--) {
      const r = this.pending[s];
      t.has(r) || (this.pending.splice(s, 1), this.queued.delete(r), e.push(r));
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
          const s = ((t = this.isCached) == null ? void 0 : t.call(this, this.tracks[e])) ?? !1;
          let r;
          try {
            r = await this.check(this.tracks[e]);
          } catch {
            r = "unknown";
          }
          if (this.inFlight = null, this.disposed) return;
          this.done.add(e), this.onResult(e, r), this.delayMs > 0 && !s && this.pending.length && await new Promise((n) => setTimeout(n, this.delayMs));
        }
      } finally {
        this.draining = !1;
      }
    }
  }
}
const sr = { id: "bandcamp", label: "Bandcamp", glyph: "bc" }, rr = { id: "apple", label: "Apple Music", glyph: "⌥" }, xt = { id: "other", label: "the store", glyph: "↗" };
function Ee(i) {
  if (i)
    try {
      const t = new URL(i);
      return t.protocol === "https:" || t.protocol === "http:" ? i : void 0;
    } catch {
      return;
    }
}
function nr(i) {
  if (!i) return xt;
  let t;
  try {
    t = new URL(i).hostname.toLowerCase();
  } catch {
    return xt;
  }
  return t === "bandcamp.com" || t.endsWith(".bandcamp.com") ? sr : t === "music.apple.com" || t === "itunes.apple.com" ? rr : xt;
}
function or(i) {
  const t = Ee(i.purchaseUrl);
  if (!t) return p`<span class="buy buy-empty" aria-hidden="true"></span>`;
  const e = nr(t);
  return p`<a
    class="buy"
    part="track-buy"
    data-store=${e.id}
    href=${t}
    target="_blank"
    rel="noopener noreferrer"
    title=${`Buy on ${e.label}`}
    aria-label=${`Buy ${i.title} on ${e.label}`}
    @click=${(s) => s.stopPropagation()}
    ><span aria-hidden="true">${e.glyph}</span></a
  >`;
}
const N = (i) => i.trim().toLowerCase();
function ar(i, t) {
  const e = /* @__PURE__ */ new Map(), s = [];
  let r = 0, n = 0;
  i.forEach((a, l) => {
    const h = t.get(l);
    if (h === "unknown") {
      n++;
      return;
    }
    if (h !== "unavailable") return;
    r++;
    const u = N(a.artist) + "\0" + N(a.album ?? "");
    let c = e.get(u);
    c || (c = { artist: a.artist, album: a.album || void 0, tracks: [] }, e.set(u, c), s.push(u)), c.tracks.push(a), c.purchaseUrl || (c.purchaseUrl = Ee(a.purchaseUrl));
  });
  const o = s.map((a) => e.get(a));
  return o.sort((a, l) => {
    if (l.tracks.length !== a.tracks.length) return l.tracks.length - a.tracks.length;
    const h = N(a.artist).localeCompare(N(l.artist));
    return h !== 0 ? h : a.album ? l.album ? N(a.album).localeCompare(N(l.album)) : -1 : 1;
  }), { albums: o, missingCount: r, uncheckedCount: n };
}
function Ae(i) {
  const t = [i.artist, i.album ?? ""].filter(Boolean).join(" ");
  return `https://bandcamp.com/search?q=${encodeURIComponent(t)}&item_type=a`;
}
function de(i, t) {
  const e = [`# Missing from my collection — ${t}`, ""];
  i.albums.length === 0 && e.push("Nothing missing.", "");
  for (const r of i.albums) {
    const n = r.album ? `${r.artist} — ${r.album}` : r.artist, o = r.purchaseUrl ?? Ae(r);
    e.push(`## [${n}](${o})`, "");
    for (const a of r.tracks) e.push(`- ${a.title}`);
    e.push("");
  }
  const s = [`${i.missingCount} track(s) missing`];
  return i.uncheckedCount > 0 && s.push(`${i.uncheckedCount} could not be checked`), e.push("---", s.join(" · "), ""), e.join(`
`);
}
const xe = "byom-player:settings:v1";
function Te(i) {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
function lr(i) {
  const t = Te();
  if (!t) return { providers: {} };
  try {
    const e = t.getItem(xe);
    if (!e) return { providers: {} };
    const s = JSON.parse(e);
    return { ...s, providers: s.providers ?? {} };
  } catch {
    return { providers: {} };
  }
}
function hr(i, t) {
  const e = Te();
  if (e)
    try {
      e.setItem(xe, JSON.stringify(i));
    } catch {
    }
}
function cr(i, t, e) {
  return { ...t[i] ?? {}, ...e.providers[i] ?? {} };
}
const Tt = [
  "mock",
  "subsonic",
  "youtube",
  "spotify",
  "plex",
  "jellyfin"
];
function dr(i) {
  if (!i) return [...Tt];
  const t = i.split(",").map((e) => e.trim()).filter((e) => Tt.includes(e));
  return t.length ? t : [...Tt];
}
function ur(i) {
  const t = [];
  for (const e of Array.from(i.querySelectorAll("byom-playlist"))) {
    const s = e.getAttribute("src");
    s && t.push({ title: e.getAttribute("title") ?? s, src: s });
  }
  return t;
}
function pr(i, t, e) {
  const s = {};
  t && Object.keys(t).length && (s[e] = { ...t });
  const r = { ...s.spotify ?? {} };
  i.spotifyClientId && (r.clientId = i.spotifyClientId), i.spotifyRedirectUri && (r.redirectUri = i.spotifyRedirectUri), Object.keys(r).length && (s.spotify = r);
  const n = { ...s.youtube ?? {} };
  return i.youtubeApiKey && (n.apiKey = i.youtubeApiKey), i.youtubeSearchEndpoint && (n.searchEndpoint = i.youtubeSearchEndpoint), Object.keys(n).length && (s.youtube = n), s;
}
var fr = Object.defineProperty, mr = Object.getOwnPropertyDescriptor, m = (i, t, e, s) => {
  for (var r = s > 1 ? void 0 : s ? mr(t, e) : t, n = i.length - 1, o; n >= 0; n--)
    (o = i[n]) && (r = (s ? o(t, e, r) : o(r)) || r);
  return s && r && fr(t, e, r), r;
};
function yr(i, t, e, s) {
  const r = i - (e - t) / 2, n = s - e;
  return Math.max(0, Math.min(r, n));
}
function gr(i, t) {
  var s;
  const e = t.trim().toLowerCase();
  return e ? i.title.toLowerCase().includes(e) || i.artist.toLowerCase().includes(e) || (((s = i.album) == null ? void 0 : s.toLowerCase().includes(e)) ?? !1) : !0;
}
function br(i) {
  var t;
  return ((t = i.syncState) == null ? void 0 : t.spotifyPresent) === !1;
}
const vr = [
  { value: "", label: "Auto" },
  { value: "daylight", label: "Daylight" },
  { value: "midnight", label: "Midnight" },
  { value: "terminal", label: "Terminal" },
  { value: "sunset", label: "Sunset" },
  { value: "paper", label: "Paper" },
  { value: "dracula", label: "Dracula" }
], _r = {
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
let d = class extends j {
  constructor() {
    super(...arguments), this.src = "", this.provider = "mock", this.theme = "", this.providerConfig = {}, this.skipDelayMs = 400, this.debug = !1, this.prescan = !0, this.providers = "", this.noSettings = !1, this.spotifyClientId = "", this.spotifyRedirectUri = "", this.youtubeApiKey = "", this.youtubeSearchEndpoint = "", this.playlist = null, this.currentIndex = 0, this.playbackState = "uninitialized", this.failed = /* @__PURE__ */ new Set(), this.halted = !1, this.shuffle = !1, this.availability = /* @__PURE__ */ new Map(), this.checking = /* @__PURE__ */ new Set(), this.positionMs = 0, this.durationMs = 0, this.preview = !1, this.playlists = [], this.view = "list", this.copied = !1, this.videoExpanded = !1, this.descExpanded = !1, this.descOverflows = !1, this.draft = { providers: {} }, this.authState = null, this.filterQuery = "", this.settings = { providers: {} }, this.deployment = {}, this.controller = null, this.activeProvider = null, this.availQueue = null, this.seeking = !1, this.lastRange = null, this.centerToken = 0, this.commitTimer = null, this.commitDelayMs = 600, this.onGlobalKeydown = (i) => {
      var t;
      i.key !== "/" || i.metaKey || i.ctrlKey || i.altKey || this.view === "list" && (this.isEditable(this.deepActiveElement()) || (i.preventDefault(), (t = this.renderRoot.querySelector(".filter-input")) == null || t.focus()));
    }, this.onRangeChanged = (i) => {
      const { first: t, last: e } = i;
      typeof t != "number" || typeof e != "number" || t < 0 || (this.lastRange = { first: t, last: e }, this.syncAvailabilityChecks());
    };
  }
  async connectedCallback() {
    super.connectedCallback(), document.addEventListener("keydown", this.onGlobalKeydown), typeof ResizeObserver < "u" && !this.descResizeObserver && (this.descResizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => this.measureDescOverflow());
    }), this.descResizeObserver.observe(this)), this.settings = lr(), this.settings.theme && (this.theme = this.settings.theme), this.playlists = ur(this), this.playlists.length && !this.src && (this.src = this.playlists[0].src), this.settings.provider && (this.provider = this.settings.provider), this.deployment = pr(
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
    return dr(this.providers || null);
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
  // Only a collection you own can answer "what am I missing?" (see
  // AudioProvider.isCollection) — and only if a sweep is actually possible.
  //
  // The queue is armed only when prescan is on and the provider implements
  // checkAvailability. Without that second condition the button would render
  // for a collection provider with prescan disabled, open a panel, and sit at
  // 0/N forever: a control that looks live and does nothing.
  get canShop() {
    var i;
    return ((i = this.activeProvider) == null ? void 0 : i.isCollection) === !0 && this.availQueue !== null;
  }
  // Summoning the panel is what starts a full sweep. It never begins on its
  // own: scanning every track is expensive, and the viewport-driven prescan
  // stays exactly as it is while the panel is closed.
  openShopping() {
    var i;
    this.view = "shopping", (i = this.availQueue) == null || i.requestAll();
  }
  // Stop queueing new checks but keep what has been gathered, so closing
  // mid-sweep costs nothing and re-opening resumes.
  closeShopping() {
    var i;
    (i = this.availQueue) == null || i.stopSweep(), this.view = "list";
  }
  get shoppingList() {
    var i;
    return ar(((i = this.playlist) == null ? void 0 : i.tracks) ?? [], this.availability);
  }
  async copyShoppingList() {
    var t;
    const i = de(this.shoppingList, ((t = this.playlist) == null ? void 0 : t.title) || "playlist");
    try {
      await navigator.clipboard.writeText(i), this.copied = !0, setTimeout(() => this.copied = !1, 1500);
    } catch {
    }
  }
  downloadShoppingList() {
    var s;
    const i = de(this.shoppingList, ((s = this.playlist) == null ? void 0 : s.title) || "playlist"), t = URL.createObjectURL(new Blob([i], { type: "text/markdown" })), e = document.createElement("a");
    e.href = t, e.download = "shopping-list.md", e.style.display = "none", document.body.appendChild(e), e.click(), setTimeout(() => {
      e.remove(), URL.revokeObjectURL(t);
    }, 0);
  }
  async refreshAvailability() {
    try {
      localStorage.removeItem("byom-player:resolv:v1");
    } catch {
    }
    await this.initProvider();
  }
  onDraftDebug(i) {
    this.draft = { ...this.draft, debug: i.currentTarget.checked }, this.commitSettings();
  }
  onDraftTheme(i) {
    this.draft = { ...this.draft, theme: i.currentTarget.value }, this.commitSettings();
  }
  // Run an interactive-auth action on the active provider (Connect/Link/etc.).
  // The provider fires onAuthChange, which refreshes this.authState → re-render.
  async runAuth(i) {
    var t, e;
    await ((e = (t = this.activeProvider) == null ? void 0 : t.runAuthAction) == null ? void 0 : e.call(t, i));
  }
  // Selecting a provider commits immediately so its connection UI (Spotify
  // Connect, Plex Link) appears inline without waiting for a debounce.
  async onDraftProvider(i) {
    this.draft = { ...this.draft, provider: i.currentTarget.value }, await this.commitSettings();
  }
  // Credential edits auto-commit after a short debounce — there is no Apply
  // button; the settings apply live.
  onDraftField(i, t, e) {
    const s = e.currentTarget.value, r = {
      ...this.draft.providers,
      [i]: { ...this.draft.providers[i], [t]: s }
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
    }, hr(this.settings), this.debug = this.settings.debug ?? !1, this.theme = this.draft.theme ?? "", this.draft.provider && (this.provider = this.draft.provider), this.dispatchEvent(
      new CustomEvent("settingschange", { detail: this.settings, bubbles: !0, composed: !0 })
    ), await this.initProvider();
  }
  disconnectedCallback() {
    var i, t, e;
    super.disconnectedCallback(), document.removeEventListener("keydown", this.onGlobalKeydown), this.commitTimer && clearTimeout(this.commitTimer), this.commitTimer = null, (i = this.availQueue) == null || i.dispose(), this.availQueue = null, (t = this.controller) == null || t.dispose(), this.controller = null, (e = this.descResizeObserver) == null || e.disconnect(), this.descResizeObserver = void 0;
  }
  // On a provider session change (link/unlink), drop stale availability: un-mark
  // the controller's skip-set, clear the displayed marks, then re-scan against
  // the new session (unlinked → quick 'unknown's; relinked → fresh results).
  handleProviderReset() {
    var i;
    for (const [t, e] of this.availability)
      e === "unavailable" && ((i = this.controller) == null || i.markUnavailable(t, !1));
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
      const i = await fetch(this.src);
      return this.playlist = Pe(await i.json()), !0;
    } catch {
      return this.playbackState = "error", !1;
    }
  }
  // Effective provider config. Extended in later tasks to merge deployment
  // defaults + user settings; for now preserves the pre-panel behavior.
  buildEffectiveConfig() {
    const i = cr(this.provider, this.deployment, this.settings);
    return this.debug ? { ...i, debug: !0 } : i;
  }
  // Build + initialize the active provider, wire the controller, arm the
  // availability queue. Disposes any existing provider/controller first so this
  // is safe to call on a settings change (no element remount).
  async initProvider() {
    var e, s, r, n;
    if (!this.playlist) return;
    (e = this.controller) == null || e.dispose(), this.controller = null, this.availability = /* @__PURE__ */ new Map(), this.failed = /* @__PURE__ */ new Set(), await this.updateComplete, (s = this.renderRoot.querySelector(".video")) == null || s.replaceChildren(), this.activeProvider = null, this.authState = null;
    const i = this.providerFactory ?? Js;
    let t;
    try {
      t = i(this.provider, this.buildEffectiveConfig());
    } catch (o) {
      this.debug && console.debug("[byom-player] provider construction failed", o), this.playbackState = "error";
      return;
    }
    if (this.activeProvider = t, t.getAuthState ? ((r = t.onAuthChange) == null || r.call(t, () => {
      var o;
      this.activeProvider === t && (this.authState = ((o = t.getAuthState) == null ? void 0 : o.call(t)) ?? null);
    }), this.authState = t.getAuthState()) : this.authState = null, t.attach) {
      await this.updateComplete;
      const o = this.renderRoot.querySelector(".video");
      o && t.attach(o);
    }
    try {
      await t.initialize();
    } catch (o) {
      this.debug && console.debug("[byom-player] provider initialize failed", o), this.playbackState = "error";
    }
    t.getAuthState && (this.authState = t.getAuthState()), this.controller = new Oi(
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
    const i = this.activeProvider;
    !(i != null && i.checkAvailability) || !this.prescan || !this.playlist || (this.availQueue = new ir(
      i,
      this.playlist.tracks,
      (e, s) => this.onAvailabilityResult(e, s),
      // Undefined when the host hasn't specified a pace, which lets the queue
      // apply its collection-aware default. The property is deliberately
      // optional rather than defaulting to 300 here: a non-undefined fallback
      // would silently defeat that default for every provider.
      { delayMs: this.prescanDelayMs }
    ), this.syncAvailabilityChecks());
  }
  onAvailabilityResult(i, t) {
    var e;
    if (this.availability = new Map(this.availability).set(i, t), this.checking.has(i)) {
      const s = new Set(this.checking);
      s.delete(i), this.checking = s;
    }
    t === "unavailable" && ((e = this.controller) == null || e.markUnavailable(i, !0));
  }
  // Enqueue real track indices and reflect the newly-accepted ones as in-flight.
  enqueueChecks(i) {
    var s;
    const t = ((s = this.availQueue) == null ? void 0 : s.request(i)) ?? [];
    if (!t.length) return;
    const e = new Set(this.checking);
    for (const r of t) e.add(r);
    this.checking = e;
  }
  // The set of tracks worth checking right now: the visible range plus a small
  // forward lookahead around the playing track (playback advances forward, even
  // when scrolled away).
  relevantCheckWindow() {
    const i = /* @__PURE__ */ new Set();
    if (this.lastRange) {
      const t = this.filteredRows, e = Math.max(0, this.lastRange.first);
      for (let s = e; s <= this.lastRange.last && s < t.length; s++) i.add(t[s].i);
    }
    for (let t = this.currentIndex; t < this.currentIndex + d.AVAIL_LOOKAHEAD; t++)
      t >= 0 && i.add(t);
    return i;
  }
  // Focus the availability queue on the currently-relevant window: prune queued
  // checks that have scrolled out of view (so a fast scroll through a
  // search-backed playlist doesn't leave a long tail of live searches for rows
  // you've left), then enqueue the window. Called on init, on range change, and
  // on track change. Visible rows are added before the lookahead, so they're
  // checked first.
  syncAvailabilityChecks() {
    const i = this.availQueue;
    if (!i) return;
    const t = this.relevantCheckWindow(), e = i.retain(t);
    if (e.length) {
      const s = new Set(this.checking);
      for (const r of e) s.delete(r);
      this.checking = s;
    }
    this.enqueueChecks([...t]);
  }
  syncFromController() {
    var i, t;
    this.controller && (this.currentIndex = this.controller.index, this.playbackState = this.controller.state, this.failed = new Set(this.controller.failed), this.halted = this.controller.halted, this.shuffle = this.controller.shuffle, this.durationMs = this.controller.durationMs, this.preview = Zs(
      this.provider,
      this.durationMs,
      ((t = (i = this.playlist) == null ? void 0 : i.tracks[this.currentIndex]) == null ? void 0 : t.durationMs) ?? 0
    ), this.seeking || (this.positionMs = this.controller.positionMs));
  }
  updated(i) {
    i.has("currentIndex") && (this.centerActiveTrack(), this.syncAvailabilityChecks()), i.has("playlist") && (this.descExpanded = !1, this.updateComplete.then(() => this.measureDescOverflow()));
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
    const i = ++this.centerToken, t = this.filteredRows.length, e = this.filteredRows.findIndex((a) => a.i === this.currentIndex);
    if (e < 0 || t === 0) return;
    const s = this.renderRoot.querySelector(".tracklist");
    if (!s || s.scrollHeight <= 0) return;
    const r = (a) => {
      var b;
      const l = this.lastRange;
      if (!l || e < l.first || e > l.last) return !1;
      const h = s.querySelectorAll("li");
      if (h.length !== l.last - l.first + 1) return !1;
      const u = h[e - l.first];
      if (!u) return !1;
      const c = u.getBoundingClientRect(), y = c.top - s.getBoundingClientRect().top + s.scrollTop, f = yr(
        y,
        c.height,
        s.clientHeight,
        s.scrollHeight
      );
      return (b = s.scrollTo) == null || b.call(s, { top: f, behavior: a }), !0;
    };
    if (r("smooth")) return;
    s.scrollTop = Math.max(
      0,
      e * s.scrollHeight / t - s.clientHeight / 2
    );
    let n = 0;
    const o = () => {
      this.centerToken === i && (r("auto") || ++n > 20 || requestAnimationFrame(o));
    };
    requestAnimationFrame(o);
  }
  selectTrack(i) {
    var t;
    (t = this.controller) == null || t.start(i);
  }
  // The active row's number is the play/pause control, so clicking it toggles
  // playback instead of restarting; any other row selects + plays.
  onRowClick(i) {
    i === this.currentIndex ? this.togglePlay() : this.selectTrack(i);
  }
  // "{author} · {n} tracks · {total duration} · {created – updated}", each part
  // conditional. The author is a <span part="creator"> so skins can still target
  // it after the merge; its styling is uniform with the rest of the line.
  renderMetaLine(i) {
    const t = [`${i.tracks.length} ${i.tracks.length === 1 ? "track" : "tracks"}`], e = Mi(i.tracks);
    e != null && t.push(Ii(e));
    const s = Li(i.dateCreated, i.dateUpdated);
    s && t.push(s);
    const r = t.join(" · ");
    return p`<p class="meta-line" part="meta-line">
      ${i.creator ? p`<span class="author" part="creator">${i.creator}</span>${r ? " · " : ""}` : g}${r}
    </p>`;
  }
  async onPlaylistChange(i) {
    const t = i.currentTarget.value;
    t !== this.src && (this.src = t, await this.loadPlaylist() && await this.initProvider());
  }
  // Derived, filtered view — never mutates pl.tracks or playback indices. Each
  // row carries its real pl.tracks index so selection maps back correctly.
  get filteredRows() {
    const i = this.playlist;
    return i ? i.tracks.map((t, e) => ({ t, i: e })).filter(({ t }) => gr(t, this.filterQuery)) : [];
  }
  onFilterInput(i) {
    this.filterQuery = i.currentTarget.value;
  }
  clearFilter() {
    var i;
    this.filterQuery = "", (i = this.renderRoot.querySelector(".filter-input")) == null || i.focus();
  }
  onFilterKeydown(i) {
    i.key === "Escape" && (this.filterQuery = "", i.currentTarget.blur());
  }
  // The deepest focused element, piercing shadow roots — focus inside a shadow
  // tree surfaces as the host element in document.activeElement.
  deepActiveElement() {
    var t;
    let i = document.activeElement;
    for (; (t = i == null ? void 0 : i.shadowRoot) != null && t.activeElement; ) i = i.shadowRoot.activeElement;
    return i;
  }
  isEditable(i) {
    if (!i) return !1;
    const t = i.tagName;
    return t === "INPUT" || t === "TEXTAREA" || i.isContentEditable;
  }
  togglePlay() {
    var i, t;
    this.playbackState === "playing" ? (i = this.controller) == null || i.pause() : (t = this.controller) == null || t.play();
  }
  next() {
    var i;
    (i = this.controller) == null || i.next();
  }
  prev() {
    var i;
    (i = this.controller) == null || i.prev();
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
    const i = this.renderRoot.querySelector(".description");
    this.descOverflows = i ? i.scrollHeight > i.clientHeight + 1 : !1;
  }
  onSeekInput() {
    this.seeking = !0;
  }
  onSeekChange(i) {
    var e;
    const t = Number(i.currentTarget.value);
    this.seeking = !1, (e = this.controller) == null || e.seek(t);
  }
  static formatTime(i) {
    const t = Math.max(0, Math.floor(i / 1e3)), e = Math.floor(t / 60), s = String(t % 60).padStart(2, "0");
    return `${e}:${s}`;
  }
  trackClasses(i, t) {
    const e = this.failed.has(i) || this.availability.get(i) === "unavailable", s = this.checking.has(i);
    return [
      i === this.currentIndex ? "active" : "",
      t ? "orphan" : "",
      e ? "unavailable" : "",
      s ? "pending" : ""
    ].filter(Boolean).join(" ");
  }
  // The single dominant state for the track part's `data-state` attribute.
  // active dominates (a playing row reads as active even if orphaned), then
  // unavailable, orphan, pending — mirroring the visual precedence.
  trackState(i, t) {
    const e = this.failed.has(i) || this.availability.get(i) === "unavailable", s = this.checking.has(i);
    return i === this.currentIndex ? "active" : e ? "unavailable" : t ? "orphan" : s ? "pending" : "";
  }
  // The per-row template, rendered by the virtualizer for each visible item.
  renderRow(i, t, e) {
    const s = br(i), r = this.trackState(t, s), n = r === "active" && e ? "⏸︎" : "▶︎";
    return p`
      <li
        class=${this.trackClasses(t, s)}
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
          ${i.image ? p`<img src=${i.image} alt="" loading="lazy" />` : p`<span class="thumb-ph" aria-hidden="true">♪</span>`}
        </span>
        <span class="cell">
          <span class="t-title">${i.title}</span>
          <span class="t-artist">${i.artist}</span>
        </span>
        <span class="dur"
          >${r === "unavailable" ? "✕" : i.durationMs ? d.formatTime(i.durationMs) : ""}</span
        >
        ${or(i)}
      </li>
    `;
  }
  render() {
    var n;
    const i = this.playlist;
    if (!i) return p`<div class="loading">Loading…</div>`;
    const t = this.filterQuery.trim(), e = this.filteredRows, s = this.playbackState === "playing", r = ((n = this.playlists.find((o) => o.src === this.src)) == null ? void 0 : n.title) ?? i.title;
    return p`
      <div class="root" part="root">
        <div class="head" part="header">
          <div class="art" part="art">
            ${i.image ? p`<img class="art-img" src=${i.image} alt="" />` : p`<span class="art-ph" aria-hidden="true">🎵</span>`}
          </div>
          <div class="meta" part="meta">
            ${this.playlists.length > 1 ? p`<div class="title-wrap" part="title">
                    <h2 class="title title--switch">
                      ${r}<span class="caret" aria-hidden="true">▾</span>
                    </h2>
                    <select
                      class="title-select"
                      aria-label="Playlist"
                      @change=${this.onPlaylistChange}
                    >
                      ${this.playlists.map(
      (o) => p`<option value=${o.src} ?selected=${o.src === this.src}>
                            ${o.title}
                          </option>`
    )}
                    </select>
                  </div>` : p`<h2 class="title" part="title">${i.title}</h2>`}
            ${this.renderMetaLine(i)}
          </div>
          ${i.annotation ? p`<div class="desc-block" part="description-block">
                  <div
                    class="description ${this.descExpanded ? "" : "is-collapsed"}"
                    part="description"
                  >
                    ${li(Pi(i.annotation))}
                  </div>
                  ${this.descOverflows ? p`<button
                          class="desc-toggle"
                          part="control description-toggle"
                          @click=${this.toggleDescExpanded}
                          aria-expanded=${this.descExpanded ? "true" : "false"}
                        >
                          ${this.descExpanded ? "▴ less" : "▾ more"}
                        </button>` : g}
                </div>` : g}
          <div class="hdr-actions">
            ${this.canShop ? p`<button
                    class="shop-btn"
                    part="control shop"
                    @click=${this.openShopping}
                    aria-label="What's missing from my collection"
                    title="What's missing from my collection"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="22"
                      height="22"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="9" cy="20" r="1.4" />
                      <circle cx="18" cy="20" r="1.4" />
                      <path d="M2 3h3l2.4 12.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6" />
                    </svg>
                  </button>` : g}
            ${this.noSettings ? g : p`<button
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
              ${s ? "⏸︎" : "▶︎"}
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
          ${this.preview ? p`<span
                  class="preview-badge"
                  part="preview-badge"
                  title="If you're signed into Spotify Premium in this browser, press ▶ in the Spotify player below for the full track."
                  >Preview · 30s ⓘ</span
                >` : g}
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
          ${this.halted ? p`<span class="halted"
                  >Playback stopped after repeated errors — pick a track to retry.</span
                >` : g}
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
          ${this.filterQuery ? p`<button
                  class="filter-clear"
                  part="filter-clear"
                  @click=${this.clearFilter}
                  aria-label="Clear filter"
                >
                  ×
                </button>` : g}
        </div>
        <div class="stage ${this.videoExpanded ? "video-expanded" : ""}" part="stage">
          <div class="tracklist-empty">
            ${e.length === 0 && t ? p`<p class="no-matches">No tracks match "${t}"</p>` : g}
          </div>
          <div class="tracklist" part="tracklist">
            <lit-virtualizer
              role="list"
              .items=${e}
              .keyFunction=${(o) => o.i}
              .renderItem=${(o) => this.renderRow(o.t, o.i, s)}
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
      <div
        class="settings-overlay"
        ?hidden=${this.view !== "settings"}
        @click=${this.onOverlayClick}
      >
        ${this.renderSettings()}
      </div>
      <div
        class="settings-overlay shopping-overlay"
        ?hidden=${this.view !== "shopping"}
        @click=${this.onShoppingOverlayClick}
      >
        ${this.view === "shopping" ? this.renderShopping() : g}
      </div>
    `;
  }
  // Close when the backdrop (not the settings card) is clicked.
  onOverlayClick(i) {
    i.target.classList.contains("settings-overlay") && this.closeSettings();
  }
  onShoppingOverlayClick(i) {
    i.target.classList.contains("shopping-overlay") && this.closeShopping();
  }
  renderField(i, t) {
    var e;
    return p`<label class="field">
      <span>${t.label}</span>
      <input
        name=${t.key}
        type=${t.type ?? "text"}
        autocomplete="off"
        .value=${((e = this.draft.providers[i]) == null ? void 0 : e[t.key]) ?? ""}
        @input=${(s) => this.onDraftField(i, t.key, s)}
      />
    </label>`;
  }
  // The shopping list: what this collection doesn't have, grouped so it can be
  // acted on. Rendered from the same availability map the tracklist marks use,
  // so it reflects the sweep as it progresses rather than waiting for the end.
  renderShopping() {
    var r, n, o;
    const i = this.shoppingList, t = ((r = this.playlist) == null ? void 0 : r.tracks.length) ?? 0, e = ((n = this.availQueue) == null ? void 0 : n.checkedCount) ?? 0, s = ((o = this.availQueue) == null ? void 0 : o.complete) ?? !1;
    return p`<div
      class="settings shopping"
      part="shopping"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shopping-title"
      @click=${(a) => a.stopPropagation()}
    >
      <div class="settings-head">
        <h2 id="shopping-title">Missing from your collection</h2>
        <button class="close" @click=${this.closeShopping} aria-label="Close">×</button>
      </div>

      <p class="shop-progress" role="status">
        ${s ? p`Checked all ${t} track${t === 1 ? "" : "s"}.` : p`Checking… ${e} / ${t}`}
        ${i.uncheckedCount > 0 ? p`<span class="shop-warn"> ${i.uncheckedCount} couldn't be checked</span>` : g}
      </p>

      ${i.albums.length === 0 ? p`<p class="shop-empty">
              ${s ? "Nothing missing — your collection has all of it." : "Nothing missing yet."}
            </p>` : p`<ul class="shop-albums">
              ${i.albums.map(
      (a) => p`<li class="shop-album">
                    <a
                      class="shop-album-title"
                      href=${a.purchaseUrl ?? Ae(a)}
                      target="_blank"
                      rel="noopener noreferrer"
                      >${a.album ? p`${a.artist} — ${a.album}` : p`${a.artist}`}</a
                    >
                    <span class="shop-count"
                      >${a.tracks.length} track${a.tracks.length === 1 ? "" : "s"}</span
                    >
                    <ul class="shop-tracks">
                      ${a.tracks.map((l) => p`<li>${l.title}</li>`)}
                    </ul>
                  </li>`
    )}
            </ul>`}

      <div class="shop-actions">
        <button @click=${this.copyShoppingList} ?disabled=${i.albums.length === 0}>
          ${this.copied ? "Copied" : "Copy as Markdown"}
        </button>
        <button @click=${this.downloadShoppingList} ?disabled=${i.albums.length === 0}>
          Download
        </button>
      </div>

      <p class="shop-caveat">
        A miss can be a metadata mismatch rather than a gap — your collection may have the track
        under a different spelling. Worth a look before buying.
      </p>
    </div>`;
  }
  renderSettings() {
    const i = this.draft.provider ?? this.provider, t = _r[i] ?? [], e = t.filter((r) => !r.advanced), s = t.filter((r) => r.advanced);
    return p`
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
            ${vr.map(
      (r) => p`<option value=${r.value} ?selected=${r.value === (this.draft.theme ?? "")}>
                  ${r.label}
                </option>`
    )}
          </select>
        </label>
        <label class="field">
          <span>Provider</span>
          <select class="provider-select" .value=${i} @change=${this.onDraftProvider}>
            ${this.allowedProviders.map((r) => p`<option value=${r} ?selected=${r === i}>${r}</option>`)}
          </select>
        </label>
        ${e.length ? p`<div class="provider-fields">
                ${e.map((r) => this.renderField(i, r))}
              </div>` : g}
        ${this.authState && this.authState.actions.length ? p`<div class="settings-connection">
                <span class="settings-label">Connection</span>
                ${this.authState.status ? p`<span class="auth-status">${this.authState.status}</span>` : g}
                <div class="auth-actions">
                  ${this.authState.actions.map(
      (r) => {
        var n;
        return p`<button
                        class="auth-btn"
                        ?disabled=${(n = this.authState) == null ? void 0 : n.busy}
                        @click=${() => this.runAuth(r.id)}
                      >
                        ${r.label}
                      </button>`;
      }
    )}
                </div>
              </div>` : g}
        <div class="settings-actions">
          <button class="refresh" @click=${this.refreshAvailability}>Refresh availability</button>
        </div>
        <details class="advanced">
          <summary>Advanced</summary>
          ${s.map((r) => this.renderField(i, r))}
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
d.styles = De`
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
      grid-template-columns: 2.2rem var(--byom-track-art-size, 2rem) 1fr auto auto;
      align-items: center;
      gap: 0.6rem;
      padding: 0.3rem 0.5rem 0.3rem 0.4rem;
      border-left: 3px solid transparent; /* reserve the active bar's width */
      border-radius: calc(var(--byom-border-radius) / 2);
    }
    .tracklist li:hover {
      background: color-mix(in srgb, var(--byom-text) 8%, transparent);
    }

    /* Both the link and its empty placeholder occupy the same slot, so a row
       with no purchase link lines up with one that has it. */
    .buy,
    .buy-empty {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 1.6rem;
      height: 1.4rem;
      font-size: 0.7rem;
      line-height: 1;
      border-radius: calc(var(--byom-border-radius) / 3);
      text-decoration: none;
      /* Quiet by default: this appears on ~83% of rows, so it must not compete
         with the title. It gains contrast on hover/focus. */
      color: color-mix(in srgb, var(--byom-text) 45%, transparent);
      border: 1px solid color-mix(in srgb, var(--byom-text) 18%, transparent);
    }
    .buy-empty {
      border-color: transparent;
    }
    .buy:hover,
    .buy:focus-visible {
      color: var(--byom-text);
      border-color: color-mix(in srgb, var(--byom-text) 45%, transparent);
      background: color-mix(in srgb, var(--byom-text) 10%, transparent);
    }
    .buy:focus-visible {
      outline: 2px solid var(--byom-accent, currentColor);
      outline-offset: 1px;
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
    /* Both header buttons share the one 'gear' grid cell. Giving the shopping
       shopping button .gear directly made it inherit grid-area and stack
       invisibly underneath the settings gear. */
    .hdr-actions {
      grid-area: gear;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .gear,
    .shop-btn {
      flex: 0 0 auto;
      display: block;
      background: transparent;
      border: none;
      color: var(--byom-text-muted);
      padding: 0;
      margin-top: 0.15rem; /* nudge the icon down to the title's cap height */
      cursor: pointer;
    }
    .gear svg,
    .shop-btn svg {
      display: block;
      width: 1.5rem;
      height: 1.5rem;
    }
    .gear:hover,
    .shop-btn:hover {
      color: var(--byom-text);
    }
    /* Modal overlay: covers the player + blocks interaction with it while open. */
    /* Shopping list panel. Reuses the settings overlay/card so it inherits the
       existing backdrop, sizing and theming rather than inventing a second
       modal treatment. */
    .shopping {
      max-height: 80vh;
      overflow: auto;
    }
    .shop-progress {
      margin: 0 0 0.5rem;
      font-size: 0.85rem;
      opacity: 0.8;
    }
    .shop-warn {
      margin-left: 0.5rem;
      opacity: 0.75;
    }
    .shop-empty {
      opacity: 0.75;
    }
    .shop-albums {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .shop-album {
      padding: 0.5rem 0;
      border-top: 1px solid color-mix(in srgb, var(--byom-text) 12%, transparent);
    }
    .shop-album-title {
      font-weight: 600;
      color: inherit;
      text-decoration: none;
      border-bottom: 1px solid color-mix(in srgb, var(--byom-text) 35%, transparent);
    }
    .shop-album-title:hover,
    .shop-album-title:focus-visible {
      border-bottom-color: currentColor;
    }
    .shop-count {
      margin-left: 0.5rem;
      font-size: 0.8rem;
      opacity: 0.6;
    }
    .shop-tracks {
      margin: 0.25rem 0 0 1rem;
      padding: 0;
      list-style: none;
      font-size: 0.85rem;
      opacity: 0.85;
    }
    .shop-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }
    .shop-caveat {
      margin: 0.75rem 0 0;
      font-size: 0.78rem;
      opacity: 0.65;
    }

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
m([
  v()
], d.prototype, "src", 2);
m([
  v()
], d.prototype, "provider", 2);
m([
  v({ reflect: !0 })
], d.prototype, "theme", 2);
m([
  v({ attribute: !1 })
], d.prototype, "providerConfig", 2);
m([
  v({ attribute: !1 })
], d.prototype, "providerFactory", 2);
m([
  v({ type: Number })
], d.prototype, "skipDelayMs", 2);
m([
  v({ type: Boolean })
], d.prototype, "debug", 2);
m([
  v({ type: Boolean })
], d.prototype, "prescan", 2);
m([
  v({ type: Number })
], d.prototype, "prescanDelayMs", 2);
m([
  v()
], d.prototype, "providers", 2);
m([
  v({ type: Boolean, attribute: "no-settings" })
], d.prototype, "noSettings", 2);
m([
  v({ attribute: "spotify-client-id" })
], d.prototype, "spotifyClientId", 2);
m([
  v({ attribute: "spotify-redirect-uri" })
], d.prototype, "spotifyRedirectUri", 2);
m([
  v({ attribute: "youtube-api-key" })
], d.prototype, "youtubeApiKey", 2);
m([
  v({ attribute: "youtube-search-endpoint" })
], d.prototype, "youtubeSearchEndpoint", 2);
m([
  _()
], d.prototype, "playlist", 2);
m([
  _()
], d.prototype, "currentIndex", 2);
m([
  _()
], d.prototype, "playbackState", 2);
m([
  _()
], d.prototype, "failed", 2);
m([
  _()
], d.prototype, "halted", 2);
m([
  _()
], d.prototype, "shuffle", 2);
m([
  _()
], d.prototype, "availability", 2);
m([
  _()
], d.prototype, "checking", 2);
m([
  _()
], d.prototype, "positionMs", 2);
m([
  _()
], d.prototype, "durationMs", 2);
m([
  _()
], d.prototype, "preview", 2);
m([
  _()
], d.prototype, "playlists", 2);
m([
  _()
], d.prototype, "view", 2);
m([
  _()
], d.prototype, "copied", 2);
m([
  _()
], d.prototype, "videoExpanded", 2);
m([
  _()
], d.prototype, "descExpanded", 2);
m([
  _()
], d.prototype, "descOverflows", 2);
m([
  _()
], d.prototype, "draft", 2);
m([
  _()
], d.prototype, "authState", 2);
m([
  _()
], d.prototype, "filterQuery", 2);
d = m([
  ni("byom-player")
], d);
export {
  mt as BYOM_EXT_NS,
  d as ByomPlayer,
  Pe as loadManifest
};
