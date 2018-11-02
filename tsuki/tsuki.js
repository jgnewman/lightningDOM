(function () {
  let lightningDOM

  if (typeof module !== 'undefined' && typeof require === 'function') {
    lightningDOM = require('lightning-dom')
  }

  else if (typeof window !== 'undefined') {
    lightningDOM = window.lightningDOM
  }

  // All the tags you can build with `T.<tag>` syntax
  const RECOGNIZED_NODES = [
    'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio',
    'b', 'base', 'bdi', 'bdo', 'blockquote', 'br', 'button', 'canvas',
    'caption', 'cite', 'code', 'col', 'colgroup',
    'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt',
    'em', 'embed', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr',
    'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'label', 'legend', 'li', 'link',
    'main', 'map', 'mark', 'meta', 'meter', 'nav', 'noscript',
    'object', 'ol', 'optgroup', 'option', 'output',
    'p', 'param', 'picture', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby',
    's', 'samp', 'script', 'section', 'select', 'small', 'source', 'span',
    'strong', 'style', 'sub', 'summary', 'sup',
    'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track',
    'u', 'ul', 'video', 'wbr'
  ].concat(lightningDOM.meta.svgSupport)

  // All the attributes we might receive from JSX that will need to be lower cased.
  const JSX_ATTRS_TO_LOWER = {};
  [
    "accessKey", "allowFullScreen", "autoCapitalize", "autoComplete", "autoFocus", "autoPlay",
    "bgColor", "cellPadding", "cellSpacing", "charSet", "classID", "codeBase",
    "colSpan", "contentEditable", "contextMenu", "controlsList",
    "crossOrigin", "dateTime", "dropZone", "encType", "formAction", "formEncType",
    "formMethod", "formNoValidate", "formTarget", "frameBorder", "hrefLang",
    "inputMode", "itemProp", "keyParams", "keyType", "lazyLoad", "marginHeight", "marginWidth",
    "maxLength", "mediaGroup", "minLength", "noValidate", "radioGroup",
    "readOnly", "rowSpan", "spellCheck", "srcDoc", "srcLang", "srcSet",
    "tabIndex", "useMap"
  ].forEach(item => JSX_ATTRS_TO_LOWER[item] = item)

  // All the attributes we might receive from JSX that will need to remain untouched
  const JSX_ATTRS_TO_LEAVE_UNTOUCHED = {};
  [
    "allowReorder", "attributeName", "attributeType", "autoReverse",
    "baseFrequency", "baseProfile", "calcMode", "clipPathUnits",
    "contentScriptType", "contentStyleType", "diffuseConstant", "edgeMode",
    "externalResourcesRequired", "filterRes", "filterUnits", "glyphRef",
    "gradientTransform", "gradientUnits", "kernelMatrix", "kernelUnitLength",
    "keyPoints", "keySplines", "keyTimes", "lengthAdjust", "limitingConeAngle",
    "markerHeight", "markerUnits", "markerWidth", "maskContentUnits", "maskUnits",
    "numOctaves", "pathLength", "patternContentUnits", "patternTransform",
    "patternUnits", "pointsAtX", "pointsAtY", "pointsAtZ", "preserveAlpha",
    "preserveAspectRatio", "primitiveUnits", "referrerPolicy", "repeatCount",
    "repeatDur", "requiredExtensions", "requiredFeatures", "specularConstant",
    "specularExponent", "spreadMethod", "startOffset", "stdDeviation",
    "stitchTiles", "surfaceScale", "systemLanguage", "tableValues", "targetX",
    "targetY", "viewBox", "viewTarget", "xChannelSelector", "yChannelSelector",
    "zoomAndPan"
  ].forEach(item => JSX_ATTRS_TO_LEAVE_UNTOUCHED[item] = item)

  // Parses strings and vars from a template into an attributes object
  function buildAttrsFromTemplate(strings, vars) {
    const output = {}

    strings.forEach((str, idx) => {
      str = str.trim();
      if (!str) return;

      const attrs = str.replace(/\s{2,}/g, ' ').split(' ')
      attrs.forEach(attr => {
        const keyVal = attr.split('=')

        if (attr[attr.length - 1] === '=') {
          keyVal[1] = vars[idx]
        }

        output[keyVal[0]] = keyVal[1]
      })
    })

    return output
  }

  // Builds a lightningDOM virtual node from the strings and vars in a template
  function buildNode(tag, strings, vars) {
    return (...children) => {
      const attrs = buildAttrsFromTemplate(strings || [], vars)
      return lightningDOM.create(tag, attrs, children.map(child => typeof child === 'function' ? child() : child))
    }
  }

  // Determines whether an object matches a group of options
  function isMatch(obj, options, keys) {
    let objMatches = true;
    keys.some(key => {
      if (obj[key] !== options[key]) {
        objMatches = false;
        return true;
      }
    });
    return objMatches;
  }

  // Finds the first object in an array matching a group of options
  function findMatchFor(options, inArray) {
    let match;
    const keys = Object.keys(options);
    inArray.some((item, index) => {
      if (isMatch(item, options, keys)) {
        match = {item: item, index: index};
        return true;
      }
    })
    return match || {item: undefined, index: -1};
  }

  // T.when(path === 'foo').use(() => { ... })
  // T.pick( T.when(path).choose(() => { ... }), T.choose(() => { ... }) )
  class Condition {

    constructor(bool) {
      this.bool = bool
      this.pickOption = null
    }

    // Executes the provided function if the condition was truthy
    use(fn) {
      if (this.bool) return fn()
      return null
    }

    // To be used with `T.pick`. Registers a function to run if the condition passes.
    choose(fn) {
      this.pickOption = fn
      return this
    }
  }

  // Every app begins with a `new Tsuki`
  class Tsuki {
    constructor({ el, view, init, rules, middleware }) {
      this.el = typeof el === 'string' ? document.querySelector(el) : el;
      this.state = new State({ init: init || {}, rules: rules || {} });
      this.view = view;
      this.app = lightningDOM.app();
      this.isRendered = false;
      this.tree = null;

      // Register state transformers
      if (Array.isArray(middleware)) {
        middleware.forEach(ware => this.state.createTransformer(ware))
      }

      // Whenever we observe a change to the state, re-render the app
      this.state.addObserver(newState => this.phase(newState))
      this.state.createRule('TSUKI_INIT', _ => state => state)()
    }

    // Do the initial render if we haven't done it yet. Migrate if we have.
    phase(newState) {
      let newTree = this.view(newState, this.state.getRules())

      // Allow a view function that doesn't contain nested children like...
      // view: () => T.div`class=foo`
      if (typeof newTree === 'function') {
        newTree = newTree()
      }

      if (!this.isRendered) {
        this.app.render(newTree, this.el)
        this.tree = newTree
        this.isRendered = true
      } else {
        this.app.migrate(this.tree, newTree)
        this.tree = newTree
      }
    }

    // Builds a function that takes extra arguments as specified by `toInject`
    static inject(fn, ...toInject) {
      return (...nativeArgs) => fn(...nativeArgs.concat(toInject))
    }

    // To be used with T.when().choose()
    // T.pick( T.when(false).choose(x), T.when(true).choose(y) )
    static pick(...conditions) {
      for (let i = 0; i < conditions.length; i += 1) {
        let cond = conditions[i]
        if (cond.bool) return cond.use(cond.pickOption)
      }
      return null
    }

    // A shortcut for `T.when(true).choose(() => { ... })`
    static choose(fn) {
      const cond = new Condition(true)
      return cond.choose(fn)
    }

    // After this point, conditional tools for Crescent syntax
    static when(bool) {
      return new Condition(bool)
    }

    // After this point, a bunch of static utils for handling arrays and
    // especially arrays of objects. Super useful for making state updates

    static firstItem(arr) {
      return arr[0]
    }

    static lastItem(arr) {
      return arr[arr.length - 1]
    }

    static leadItems(arr) {
      return arr.slice(0, arr.length - 1)
    }

    static tailItems(arr) {
      return arr.slice(1)
    }

    static randomItem(arr) {
      return arr[Math.floor(Math.random() * arr.length)]
    }

    static getFirstItemWhere(arr, options) {
      return findMatchFor(options, arr).item
    }

    static getFirstIndexWhere(arr, options) {
      return findMatchFor(options, arr).index
    }

    static getItemsWhere(arr, options) {
      const keys = Object.keys(options)
      return arr.filter(item => isMatch(item, options, keys))
    }

    static updateFirstItemWhere(arr, options, updates) {
      const match = findMatchFor(options, arr)
      const copy = arr.slice()
      if (match.index === -1) return copy
      copy[match.index] = { ...match.item, ...updates }
      return copy
    }

    static updateItemsWhere(arr, options, updates) {
      const optionKeys = Object.keys(options)
      return arr.map(originalItem => {
        if (isMatch(originalItem, options, optionKeys)) return { ...originalItem, ...updates }
        return originalItem
      })
    }

    static updateAllItems(arr, updates) {
      return arr.map(obj => ({ ...obj, ...updates }))
    }

    // JSX attribute gotchas: https://reactjs.org/docs/dom-elements.html
    static fromJSX(tag, attrs, ...children) {
      attrs = attrs || {}

      if (typeof tag === 'function') {
        return tag(attrs, children)
      }

      const newAttrs = {}

      Object.keys(attrs).forEach(key => {
        const val = attrs[key]

        // Special attr name manipulations
        if (key === 'className') {
          key = 'class'
        } else if (key === 'htmlFor') {
          key = 'for'

        // Lowercase the keyname if it's in our group to lowercase or if it's an event handler prop
        } else if (JSX_ATTRS_TO_LOWER[key] || /^on[A-Z]/.test(key)) {
          key = key.toLowerCase()

        // Dasherize the keyname if it has a dash in it and isn't in our group of attributes to leave alone
        } else if (!JSX_ATTRS_TO_LEAVE_UNTOUCHED[key] && /[A-Z]/.test(key)) {
          key = key.replace(/([A-Z])/g, '-$1').toLowerCase()
        }

        newAttrs[key] = val
      })

      return lightningDOM.create(tag, newAttrs, children)
    }

  }

  // Allows you to capture references to real DOM nodes built from vnodes
  class RefCapture {
    constructor() {
      this.refs = {}
    }

    // Capture a vnode and name the reference
    capture(name, vnode) {
      this.refs[name] = vnode
      return vnode
    }

    // Get the real node from the name of a reference
    get(name) {
      const ref = this.refs[name] && this.refs[name].node
      return ref || null
    }
  }

  // Add RefCapture to Tsuki as a "static method"
  Tsuki.Ref = RefCapture;

  function runAsyncFunctionArray(arr, newState, prevState, ruleName, callback) {
    if (!arr.length) {
      return callback(newState);
    } else {
      const item = arr[0];
      const next = (transformedState=newState) => {
        return runAsyncFunctionArray(arr.slice(1), transformedState, prevState, ruleName, callback);
      }
      item({ newState, prevState, ruleName, next })
    }
  }

  // Every app gets a `new State`
  class State {
    constructor({ init, rules }) {
      this.rules = {};
      this.state = init  || {};
      this.observers = [];
      this.transformers = [];

      // Create usable rules from the raw rules passed in
      rules && Object.keys(rules).forEach(key => {
        this.addRule(key, rules[key])
      })
    }

    // Used to transform the state after the firing of any rule, before
    // triggering the observers
    createTransformer(transformer) {
      this.transformers.push(transformer)
    }

    // A _real_ rule generates a new state, runs middleware on the new state, and passes it to observers
    createRule(ruleName, rule) {
      const migrateState = (newState, prevState) => {
        runAsyncFunctionArray(this.transformers, newState, prevState, ruleName, (transformedState) => {
          this.state = transformedState
          this.observers.forEach(observer => observer(transformedState, ruleName))
        })
      }

      return data => {
        const stateStage1 = rule(data)
        const prevState = this.state
        if (stateStage1 instanceof Promise) {
          // We deliberately don't catch errors here because, if this wasn't a
          // promise it would have already errored, and if it was, we want to put
          // the onus on the user to handle their own promise errors and return
          // a new state when an error occurs.
          stateStage1.then(stateStage2 => migrateState(stateStage2(this.state), prevState))
        } else {
          migrateState(stateStage1(this.state), prevState)
        }
      }
    }

    // Register a new rule manually
    addRule(name, rule) {
      this.rules[name] = this.createRule(name, rule)
    }

    // Register a function to run on state change
    addObserver(fn) {
      this.observers.push(fn)
    }

    // Access all the rules
    getRules() {
      return this.rules
    }
  }

  // Run through all the recognized tag names and add static methods for each one to Tsuki
  RECOGNIZED_NODES.forEach(node => {
    Tsuki[node] = (strings, ...vars) => buildNode(node, strings, vars)
  })

  // Make exporting a little nicer
  Tsuki.Tsuki = Tsuki.T = Tsuki

  // Create module.exports if they exist
  if (typeof module !== 'undefined') {
    module.exports = Tsuki
  }

  // Inject a global into window if it exists.
  else if (typeof window !== 'undefined') {
    window.Tsuki = window.T = Tsuki
  }

  return Tsuki

}())
