const assert = require('assert')
const path = require('path')
const fs = require('fs')
const Chromatica = require('chromatica')

const SERVER_PORT = 3000
const SERVER_ROUTES = [
  {
    test: /lightning-dom\.js/,
    file: fs.readFileSync(path.resolve(`${__dirname}/../lightning-dom.js`))
  },
  {
    test: /tsuki\.js/,
    file: fs.readFileSync(path.resolve(`${__dirname}/../tsuki/tsuki.js`))
  },
  {
    test: null,
    file: fs.readFileSync(path.resolve(__dirname, './templates/test-tsuki.html'))
  },
]

describe('Tsuki', function () {

  before(async function () {
    this.browser = new Chromatica({
      port: SERVER_PORT,
      routes: SERVER_ROUTES
    })

    const page = await this.browser.getPage()
    this.page = page

  })

  after(async function () {
    await this.page.close()
    await this.browser.closeBrowser()
  })

  describe('exports', function () {
    it('creates a Tsuki global', async function () {
      const result = await this.page.evaluate(() => Object.keys(window))
      assert.ok(result)
    })

    it('creates a global Tsuki alias called T', async function () {
      const result = await this.page.evaluate(() => typeof window.T === 'function' && window.T === window.Tsuki)
      assert.ok(result)
    })

    it('adds Ref to Tsuki', async function () {
      const result = await this.page.evaluate(() => typeof window.Tsuki.Ref === 'function')
      assert.ok(result)
    })

    it('adds node builder functions to Tsuki', async function () {
      const result = await this.page.evaluate(() => typeof window.Tsuki.div === 'function')
      assert.ok(result)
    })
  })

  describe('conditional utils', function () {
    describe('#when ... use', function () {
      it('runs a function when the condition is truthy', async function () {
        const result = await this.page.evaluate(() => Tsuki.when(true).use(() => {
          return 'OK'
        }))
        assert.equal(result, 'OK')
      })

      it('returns null when the condition is falsy', async function () {
        const result = await this.page.evaluate(() => Tsuki.when(false).use(() => {
          return 'OK'
        }))
        assert.equal(result, null)
      })
    })

    describe('#pick & #choose', function () {
      it('executes only the first truthy when...choose statement', async function () {
        const result = await this.page.evaluate(() => {
          const out = [];
          Tsuki.pick(
            Tsuki.when(false).choose(() => out.push(1)),
            Tsuki.when(true).choose(() => out.push(2)),
            Tsuki.when(true).choose(() => out.push(3))
          )
          return out
        })
        assert.equal(result.length, 1)
        assert.equal(result[0], 2)
      })

      it('converts Tsuki.choose to a when(true)...choose statement', async function () {
        const result = await this.page.evaluate(() => {
          const out = [];
          Tsuki.pick(
            Tsuki.when(false).choose(() => out.push(1)),
            Tsuki.when(false).choose(() => out.push(2)),
            Tsuki.choose(() => out.push(3))
          )
          return out
        })
        assert.equal(result.length, 1)
        assert.equal(result[0], 3)
      })
    })
  })

  describe('array utils', function () {

    describe('#firstItem', function () {
      it('retrieves the first item in an array', async function () {
        const result = await this.page.evaluate(() => Tsuki.firstItem([1, 2, 3]))
        assert.equal(result, 1)
      })
    })

    describe('#lastItem', function () {
      it('retrieves the last item in an array', async function () {
        const result = await this.page.evaluate(() => Tsuki.lastItem([1, 2, 3]))
        assert.equal(result, 3)
      })
    })

    describe('#leadItems', function () {
      it('retrieves all but the last item in an array', async function () {
        const result = await this.page.evaluate(() => Tsuki.leadItems([1, 2, 3]))
        assert.deepEqual(result, [1, 2])
      })
    })

    describe('#tailItems', function () {
      it('retrieves all but the first item in an array', async function () {
        const result = await this.page.evaluate(() => Tsuki.tailItems([1, 2, 3]))
        assert.deepEqual(result, [2, 3])
      })
    })

    describe('#randomItem', function () {
      it('retrieves a random item in an array', async function () {
        const result = await this.page.evaluate(() => Tsuki.randomItem([1, 2, 3]))
        assert.ok(result === 1 || result === 2 || result === 3, result)
      })
    })

    describe('#getFirstItemWhere', function () {
      it('retrieves the first matching item in an array', async function () {
        const result = await this.page.evaluate(() => {
          const objects = [{a: 1, b: 2, name: 'foo'}, {a: 1, b: 3, name: 'bar'}, {a: 2, b: 3, name: 'baz'}, {a: 2, b: 4, name: 'quux'}]
          return Tsuki.getFirstItemWhere(objects, {a: 1, b: 3})
        })
        assert.deepEqual(result, {a: 1, b: 3, name: 'bar'})
      })
    })

    describe('#getFirstIndexWhere', function () {
      it('retrieves the first matching index in an array', async function () {
        const result = await this.page.evaluate(() => {
          const objects = [{a: 1, b: 2, name: 'foo'}, {a: 1, b: 3, name: 'bar'}, {a: 2, b: 3, name: 'baz'}, {a: 2, b: 4, name: 'quux'}]
          return Tsuki.getFirstIndexWhere(objects, {a: 1, b: 3})
        })
        assert.equal(result, 1)
      })
    })

    describe('#getItemsWhere', function () {
      it('retrieves all matching items in an array', async function () {
        const result = await this.page.evaluate(() => {
          const objects = [{a: 1, b: 2, name: 'foo'}, {a: 1, b: 3, name: 'bar'}, {a: 2, b: 3, name: 'baz'}, {a: 2, b: 4, name: 'quux'}]
          return Tsuki.getItemsWhere(objects, {a: 2})
        })
        assert.equal(result.length, 2)
        assert.equal(result[0].name, 'baz')
        assert.equal(result[1].name, 'quux')
      })
    })

    describe('#updateFirstItemWhere', function () {
      it('updates the first matching item in an array', async function () {
        const result = await this.page.evaluate(() => {
          const objects = [{a: 1, b: 2, name: 'foo'}, {a: 1, b: 3, name: 'bar'}, {a: 2, b: 3, name: 'baz'}, {a: 2, b: 4, name: 'quux'}]
          return Tsuki.updateFirstItemWhere(objects, {a: 2}, {b: 10})[2]
        })
        assert.deepEqual(result, {a: 2, b: 10, name: 'baz'})
      })
    })

    describe('#updateItemsWhere', function () {
      it('updates all matching items in an array', async function () {
        const result = await this.page.evaluate(() => {
          const objects = [{a: 1, b: 2, name: 'foo'}, {a: 1, b: 3, name: 'bar'}, {a: 2, b: 3, name: 'baz'}, {a: 2, b: 4, name: 'quux'}]
          return Tsuki.updateItemsWhere(objects, {a: 2}, {b: 10})
        })
        assert.equal(result.length, 4)
        assert.equal(result[0].b, 2)
        assert.equal(result[1].b, 3)
        assert.equal(result[2].b, 10)
        assert.equal(result[3].b, 10)
      })
    })

    describe('#updateAllItems', function () {
      it('updates all items in an array', async function () {
        const result = await this.page.evaluate(() => {
          const objects = [{a: 1, b: 2, name: 'foo'}, {a: 1, b: 3, name: 'bar'}]
          return Tsuki.updateAllItems(objects, {b: 10})
        })
        assert.equal(result.length, 2)
        assert.equal(result[0].b, 10)
        assert.equal(result[1].b, 10)
      })
    })

  })

  describe('#inject', function () {
    it('generates a new function that takes extra arguments', async function () {
      const result = await this.page.evaluate(() => {
        const expected = (foo, bar) => [foo, bar]
        const wrapped = Tsuki.inject(expected, 'bar')
        return wrapped('foo')
      })
      assert.deepEqual(result, ['foo', 'bar'])
    })
  })

  describe('crescent syntax', function () {
    it('generates a vnode', async function () {
      const result = await this.page.evaluate(() => {
        return T.div``()
      })
      assert.equal(result.tag, 'div')
    })

    it('generates attributes from the template string', async function () {
      const result = await this.page.evaluate(() => {
        return T.div`class=foo data-bar=${'baz'}`()
      })
      assert.deepEqual(result.attrs, {"class": "foo", "data-bar": "baz"})
    })

    it('generates nested children', async function () {
      const result = await this.page.evaluate(() => {
        return T.div`class=foo`(
          T.a``,
          T.a``(),
        )
      })
      assert.equal(result.children.length, 2)
      assert.equal(result.children[0].tag, 'a')
      assert.equal(result.children[1].tag, 'a')
    })
  })

  describe('app setup', function () {
    it('renders an application', async function () {
      const result = await this.page.evaluate(() => {
        const app = new Tsuki({
          el: 'body',
          view: () => T.div`id=app-container`
        })
        return new Promise(resolve => {
          setTimeout(() => resolve(!!document.querySelector('#app-container')), 10)
        })
      })
      assert.equal(result, true)
    })

    it('creates a state object', async function () {
      const result = await this.page.evaluate(() => {
        const app = new Tsuki({
          el: 'body',
          view: () => T.div`id=app-container`
        })
        return app.state
      })
      assert.equal(typeof result, 'object')
    })

    it('populates a state object', async function () {
      const result = await this.page.evaluate(() => {
        const app = new Tsuki({
          el: 'body',
          init: { foo: 'bar' },
          view: () => T.div`id=app-container`
        })
        return new Promise(resolve => {
          setTimeout(() => resolve(app.state), 10)
        })
      })
      assert.equal(result.state.foo, 'bar')
    })

    it('renders with initial props', async function () {
      const result = await this.page.evaluate(() => {
        const app = new Tsuki({
          el: 'body',
          init: { foo: 'bar' },
          view: ({ foo }) => T.div`id=app-container`(foo)
        })
        return new Promise(resolve => {
          setTimeout(() => resolve(document.querySelector('#app-container').innerHTML.trim()), 10)
        })
      })
      assert.equal(result, 'bar')
    })
  })

  describe('state manipulation', function () {
    it('re-renders when rules are triggered', async function () {
      const result = await this.page.evaluate(() => {
        let trackedValue = null;
        let changed = false;
        const app = new Tsuki({
          el: 'body',
          init: { foo: 'bar' },
          rules: { update: data => state => ({ ...state, foo: data }) },
          view: ({ foo }, { update }) => {
            trackedValue = foo
            if (!changed) {
              changed = true
              update('baz')
            }
            return T.div`id=app-container`(foo)
          }
        })
        return new Promise(resolve => {
          setTimeout(() => resolve(trackedValue), 10)
        })
      })
      assert.equal(result, 'baz')
    })

    it('allows middleware inspecting the state', async function () {
      const result = await this.page.evaluate(() => {
        const tracker = {
          middlewareCount: 0,
          rulesTriggered: [],
          newState: {}
        };
        let changed = false;
        const app = new Tsuki({
          el: 'body',
          init: { foo: 'bar' },
          rules: { update: data => state => ({ ...state, foo: data }) },
          view: ({ foo }, { update }) => {
            if (!changed) {
              changed = true
              update('baz')
            }
            return T.div`id=app-container`(foo)
          },
          middleware: [
            ({ ruleName, newState, next }) => {
              tracker.middlewareCount += 1
              next()
            },
            ({ ruleName, newState, next }) => {
              tracker.middlewareCount += 1
              tracker.rulesTriggered.push(ruleName)
              tracker.newState = newState
              next()
            }
          ]
        })
        return new Promise(resolve => {
          setTimeout(() => resolve(tracker), 10)
        })
      })
      assert.deepEqual(result, {
        middlewareCount: 4,
        rulesTriggered: ['TSUKI_INIT', 'update'],
        newState: { foo: 'baz' }
      }, result)
    })

    it('allows async middleware inspecting the state', async function () {
      const result = await this.page.evaluate(() => {
        const tracker = {
          middlewareCount: 0,
          rulesTriggered: [],
          newState: {}
        };
        let changed = false;
        const app = new Tsuki({
          el: 'body',
          init: { foo: 'bar' },
          rules: { update: data => state => ({ ...state, foo: data }) },
          view: ({ foo }, { update }) => {
            if (!changed) {
              changed = true
              update('baz')
            }
            return T.div`id=app-container`(foo)
          },
          middleware: [
            ({ ruleName, newState, prevState, next }) => {
              tracker.middlewareCount += 1
              tracker.rulesTriggered.push(ruleName)
              tracker.newState = newState
              tracker.prevState = prevState
              return new Promise(resolve => resolve(next()))
            }
          ]
        })
        return new Promise(resolve => {
          setTimeout(() => resolve(tracker), 10)
        })
      })
      assert.deepEqual(result, {
        middlewareCount: 2,
        rulesTriggered: ['TSUKI_INIT', 'update'],
        newState: { foo: 'baz' },
        prevState: { foo: 'bar' }
      }, result)
    })

    it('allows middleware transforming the state', async function () {
      const result = await this.page.evaluate(() => {
        const tracker = {
          middlewareCount: 0,
          rulesTriggered: [],
          newState: {}
        };
        let changed = false;
        const app = new Tsuki({
          el: 'body',
          init: { foo: 'bar' },
          rules: { update: data => state => ({ ...state, foo: data }) },
          view: ({ foo }, { update }) => {
            if (!changed) {
              changed = true
              update('baz')
            }
            return T.div`id=app-container`(foo)
          },
          middleware: [
            ({ ruleName, newState, next }) => {
              tracker.middlewareCount += 1
              next({ ...newState, color: 'red' })
            },
            ({ ruleName, newState, next }) => {
              tracker.middlewareCount += 1
              tracker.rulesTriggered.push(ruleName)
              tracker.newState = newState
              next()
            }
          ]
        })
        return new Promise(resolve => {
          setTimeout(() => resolve(tracker), 10)
        })
      })
      assert.deepEqual(result, {
        middlewareCount: 4,
        rulesTriggered: ['TSUKI_INIT', 'update'],
        newState: { foo: 'baz', color: 'red' }
      }, result)
    })

    it('allows promise-based rules', async function () {
      const result = await this.page.evaluate(() => {
        let changed = false;
        const app = new Tsuki({
          el: 'body',
          init: { foo: 'bar' },
          rules: { update: async (data) => Promise.resolve(state => ({ ...state, foo: data })) },
          view: ({ foo }, { update }) => {
            if (!changed) {
              changed = true
              update('baz')
            }
            return T.div`id=app-container`(foo)
          }
        })
        return new Promise(resolve => {
          setTimeout(() => resolve(document.querySelector('#app-container').innerHTML.trim()), 10)
        })
      })
      assert.equal(result, 'baz')
    })
  })

  describe('ref capture', function () {
    it('captures and retrieves a reference to a real node from a vnode', async function () {
      const result = await this.page.evaluate(() => {
        const app = new Tsuki({
          el: 'body',
          init: { foo: 'bar' },
          view: ({ foo }) => {
            const ref = new T.Ref()
            window.tsukiRef = ref
            return ref.capture('mycapture', T.div`id=app-container`(foo))
          }
        })
        return new Promise(resolve => {
          setTimeout(() => {
            const div = document.querySelector('#app-container')
            resolve(window.tsukiRef.get('mycapture') === div)
          }, 10)
        })
      })
      assert.ok(result)
    })

  })

})
