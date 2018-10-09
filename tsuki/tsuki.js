(function () {

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
    'strong', 'style', 'sub', 'summary', 'sup', 'svg',
    'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track',
    'u', 'ul', 'video', 'wbr'
  ]

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

  // Every app begins with a `new Tsuki`
  class Tsuki {
    constructor({ el, view, init, rules }) {
      this.el = typeof el === 'string' ? document.querySelector(el) : el;
      this.state = new State({ init: init || {}, rules: rules || {} });
      this.view = view;
      this.app = lightningDOM.app();
      this.isRendered = false;
      this.tree = null;

      // Whenever we observe a change to the state, re-render the app
      this.state.addObserver(newState => this.phase(newState))
      this.state.tick()
    }

    // Do the initial render if we haven't done it yet. Migrate if we have.
    phase(newState) {
      const newTree = this.view(newState, this.state.getRules())
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

  // Every app gets a `new State`
  class State {
    constructor({ init, rules }) {
      this.rules = rules || {};
      this.state = init  || {};
      this.observers = [];

      // Create usable rules from the raw rules passed in
      Object.keys(this.rules).forEach(key => {
        this.addRule(key, this.rules[key])
      })
    }

    // A _real_ rule generates a new state and passes it to observers
    createRule(rule) {
      return data => {
        const stateThunk = rule(data)
        const statePromise = stateThunk instanceof Promise ? stateThunk : Promise.resolve(stateThunk)

        // We deliberately don't catch errors here because, if this wasn't a
        // promise it would have already errored, and if it was, we want to put
        // the onus on the user to handle their own promise errors and return
        // a new state when an error occurs.
        statePromise.then(stateBuilder => {
          const newState = stateBuilder(this.state)
          this.state = newState
          this.observers.forEach(observer => observer(newState))
        })
      }
    }

    // Register a new rule manually
    addRule(name, rule) {
      this.rules[name] = this.createRule(rule)
    }

    // Register a function to run on state change
    addObserver(fn) {
      this.observers.push(fn)
    }

    // Access all the rules
    getRules() {
      return this.rules
    }

    // Manually cycle the state by passing its values to all observers
    tick() {
      this.createRule(_ => state => state)()
    }
  }

  // Run through all the recognized tag names and add static methods for each one to Tsuki
  RECOGNIZED_NODES.forEach(node => {
    Tsuki[node] = (strings, ...vars) => buildNode(node, strings, vars)
  })

  // Create module.exports if they exist
  if (typeof module !== 'undefined') {
    module.exports = Tsuki
  }

  // Inject a global into window if it exists.
  else if (typeof window !== 'undefined') {
    window.Tsuki = window.T = Tsuki
  }

}())
