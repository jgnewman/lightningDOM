(function () {

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

  function buildAttrsFromTemplate(strings, vars) {
    const output = {}
    strings.forEach((str, idx) => {
      if (!str) return;
      const attrs = str.trim().replace(/\s{2,}/g, ' ').split(' ')
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

  class Store {

    constructor(observer) {
      this.rules = {}
      this.state = {}
      this.observer = observer
    }

    addRule(name, rule) {
      this.rules[name] = rule
      return rule
    }

    run(ruleName, data) {
      setTimeout(() => {
        const transformer = this.rules[ruleName](data)
        const newState = transformer(this.state)
        this.state = newState
        this.observer(newState)
        //console.log('Ran', ruleName, 'with', data, 'and got', newState)
      }, 0)
    }

    get() {
      return { ...this.state }
    }
  }

  class Tsuki {

    constructor(options) {
      this.options = options

      if (options.el) {
        const app = lightningDOM.app()
        const target = document.querySelector(options.el)
        let hasRendered = false

        this.rules = options.rules && options.rules()

        const runner = (ruleName, data) => this.store.run(ruleName, data)
        this.store = new Store(newState => {

          if (this.rules) {
            newState.run = runner
          }

          const newTree = options.view(newState || {})

          if (hasRendered) {
            app.migrate(this.tree, newTree)
          } else {
            app.render(newTree, target)
            hasRendered = true
          }

          this.tree = newTree
        })

        this.store.addRule('_INIT', initialData => _ => initialData)
        this.rules && Object.keys(this.rules).forEach(name => this.store.addRule(name, this.rules[name]))
        options.init && this.store.run('_INIT', options.init())
      }
    }


    use(strings, ...vars) {
      const props = buildAttrsFromTemplate(strings, vars)
      return this.options.view(props)
    }

    static inject(...toInject) {
      return (fn) => (...args) => fn(...args.concat(toInject))
    }

    static _(tag, strings, vars) {
      return (...children) => {
        const attrs = buildAttrsFromTemplate(strings || [], vars)
        return lightningDOM.create(tag, attrs, children.map(child => typeof child === 'function' ? child() : child))
      }
    }

  }

  RECOGNIZED_NODES.forEach(node => Tsuki[node] = (strings, ...vars) => Tsuki._(node, strings, vars))

  // Create module.exports if they exist
  if (typeof module !== 'undefined') {
    module.exports = Tsuki;
  }

  // Inject a global into window if it exists.
  else if (typeof window !== 'undefined') {
    window.Tsuki = window.T = Tsuki;
  }

}())
