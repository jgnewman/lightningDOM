const assert = require('assert')
const path = require('path')
const fs = require('fs')
const Browser = require('./utils/spawn-browser')

const SERVER_PORT = 3000
const SERVER_ROUTES = [
  {
    test: /lightning-dom\.js/,
    file: fs.readFileSync(path.resolve(`${__dirname}/../lightning-dom.js`))
  },
  {
    test: null,
    file: fs.readFileSync(path.resolve(__dirname, './templates/test-lightningdom.html'))
  },
]

describe('lightningDOM', function () {

  before(function () {
    this.browser = new Browser({
      port: SERVER_PORT,
      routes: SERVER_ROUTES
    })
  })

  after(async function () {
    await this.browser.closeBrowser()
  })

  beforeEach(async function () {
    const page = await this.browser.getPage()
    this.page = page
  })

  afterEach(async function () {
    await this.page.close()
  })

  describe('exports', function () {
    it('creates a lightningDOM global', async function () {
      const result = await this.page.evaluate(() => typeof window.lightningDOM === 'object')
      assert.ok(result)
    })

    it('exposes #app', async function () {
      const result = await this.page.evaluate(() => {
        if (typeof window.lightningDOM !== 'object') return false
        return typeof window.lightningDOM.app === 'function'
      })
      assert.ok(result)
    })

    it('exposes #create', async function () {
      const result = await this.page.evaluate(() => {
        if (typeof window.lightningDOM !== 'object') return false
        return typeof window.lightningDOM.create === 'function'
      })
      assert.ok(result)
    })
  })

  describe('#app', function () {
    beforeEach(async function () {
      await this.page.evaluate(() => {
        window.app = window.lightningDOM.app()
        window.render = app.render
        window.migrate = app.migrate
      })
    })

    it('exposes an object containing #migrate and #render', async function () {
      const result = await this.page.evaluate(() => {
        return typeof app === 'object'
            && typeof migrate === 'function'
            && typeof render === 'function'
      })
      assert.ok(result)
    })
  })

  describe('#create', function () {
    beforeEach(async function () {
      await this.page.evaluate(() => {
        window.app = window.lightningDOM.app()
        window.create = window.lightningDOM.create
        window.render = app.render
        window.migrate = app.migrate
      })
    })

    it('generates an instance of Node', async function () {
      const result = await this.page.evaluate(() => {
        const node = create('div', {}, [])
        return typeof node.build === 'function'
      })
      assert.ok(result)
    })

    it('allows optional attributes', async function () {
      const result = await this.page.evaluate(() => {
        const node = create('div', null, [])
        return typeof node.attrs === 'object'
      })
      assert.ok(result)
    })

    it('allows optional children', async function () {
      const result = await this.page.evaluate(() => {
        const node = create('div')
        return Array.isArray(node.children)
      })
      assert.ok(result)
    })

    it('creates a text Node from a text child', async function () {
      const result = await this.page.evaluate(() => {
        const node = create('div', null, ["hello"])
        return node.children[0].tag === 'text'
      })
      assert.ok(result)
    })

    it('creates a keylist Node from an array child', async function () {
      const result = await this.page.evaluate(() => {
        const node = create('div', null, [[create('a')]])
        return node.children[0].tag === 'keylist'
      })
      assert.ok(result)
    })

    it('passes data to the top of the tree', async function () {
      const result = await this.page.evaluate(() => {
        const node = create('div', null, [
          "foo",
          create('div', null, [
            "bar",
            create('input', { value: 'baz' }, []),
            create('input', null, []),
            create('input', { value: 'quux' }, []),
          ])
        ])
        return node.valueChanges
      })
      assert.deepEqual(result, ['baz', 'quux'])
    })
  })

  describe('#render', function () {
    beforeEach(async function () {
      await this.page.evaluate(() => {
        window.app = window.lightningDOM.app()
        window.create = window.lightningDOM.create
        window.render = app.render
        window.migrate = app.migrate
      })
    })

    it('renders an app into an element', async function () {
      const result = await this.page.evaluate(() => {
        render(create('div', { id: 'foo' }), document.body)
        return new Promise(resolve => setTimeout(() => resolve(!!document.querySelector('#foo')), 10))
      })
      assert.ok(result)
    })

    it('renders normal attributes correctly', async function () {
      const result = await this.page.evaluate(() => {
        render(create('div', {
          'id': 'foo',
          'key': 'should not show up',
          'class': 'bar',
          'onclick': function () {},
        }), document.body)

        return new Promise(resolve => setTimeout(() => {
          const node = document.querySelector('#foo')
          resolve(!node.getAttribute('key') && node.className === 'bar' && typeof node.onclick === 'function')
        }, 10))
      })
      assert.ok(result)
    })

    it('renders value correctly', async function () {
      const result = await this.page.evaluate(() => {
        const tree1 = create('input', {
          'id': 'foo',
          'type': 'text',
          'value': 'foo',
        })

        const tree2 = create('input', {
          'id': 'foo',
          'type': 'text',
        })

        render(tree1, document.body)

        return new Promise(resolve => {
          const out = {}
          setTimeout(() => {
            out.tree1Value = document.querySelector('#foo').value
            migrate(tree1, tree2)
            setTimeout(() => {
              out.tree2Value = document.querySelector('#foo').value
              resolve(out)
            }, 10)
          }, 10)
        })
      })
      assert.equal(result.tree1Value, 'foo')
      assert.equal(result.tree2Value, '')
    })

    it('renders checked correctly', async function () {
      const result = await this.page.evaluate(() => {
        const tree1 = create('input', {
          'id': 'foo',
          'type': 'checkbox',
          'checked': true,
        })

        const tree2 = create('input', {
          'id': 'foo',
          'type': 'checkbox',
        })

        render(tree1, document.body)

        return new Promise(resolve => {
          const out = {}
          setTimeout(() => {
            out.tree1Value = document.querySelector('#foo').checked
            migrate(tree1, tree2)
            setTimeout(() => {
              out.tree2Value = document.querySelector('#foo').checked
              resolve(out)
            }, 10)
          }, 10)
        })
      })
      assert.equal(result.tree1Value, true)
      assert.equal(result.tree2Value, false)
    })

    it('recursively renders children', async function () {
      const result = await this.page.evaluate(() => {
        render(create('div', { id: 'foo' }, [create('a')]), document.body)

        return new Promise(resolve => setTimeout(() => {
          const node = document.querySelector('#foo')
          resolve(node.children.length === 1 && node.children[0].nodeName.toLowerCase() === 'a')
        }, 10))
      })
      assert.ok(result)
    })

    it('renders text children', async function () {
      const result = await this.page.evaluate(() => {
        render(create('div', { id: 'foo' }, ["hello"]), document.body)

        return new Promise(resolve => setTimeout(() => {
          const node = document.querySelector('#foo')
          resolve(node.innerHTML.trim() === 'hello')
        }, 10))
      })
      assert.ok(result)
    })

    it('ignores null children', async function () {
      const result = await this.page.evaluate(() => {
        render(create('div', { id: 'foo' }, [null]), document.body)

        return new Promise(resolve => setTimeout(() => {
          const node = document.querySelector('#foo')
          resolve(node.innerHTML.trim() === '')
        }, 10))
      })
      assert.ok(result)
    })

    it('ignores undefined children', async function () {
      const result = await this.page.evaluate(() => {
        render(create('div', { id: 'foo' }, [undefined]), document.body)

        return new Promise(resolve => setTimeout(() => {
          const node = document.querySelector('#foo')
          resolve(node.innerHTML.trim() === '')
        }, 10))
      })
      assert.ok(result)
    })

    it('renders keylist children', async function () {
      const result = await this.page.evaluate(() => {
        render(create('div', { id: 'foo' }, [[
          create('a', { key: '1' }),
          create('a', { key: '2' })
        ]]), document.body)

        return new Promise(resolve => setTimeout(() => {
          const node = document.querySelector('#foo')
          resolve(node.children.length === 2)
        }, 10))
      })
      assert.ok(result)
    })

    it('requires keylist children to have a key attribute', async function () {
      let error = null
      this.page.on('pageerror', err => error = err)

      const result = await this.page.evaluate(() => {
        render(create('div', { id: 'foo' }, [[
          create('a'),
          create('a')
        ]]), document.body)
      })

      return new Promise(resolve => {
        setTimeout(() => {
          assert.ok(error instanceof Error, 'Got an error')
          assert.ok(/iteration.+key/.test(error.message), 'Error complains about key')
          resolve()
        }, 100)
      })
    })

    it('requires the key attribute to be a string', async function () {
      let error = null
      this.page.on('pageerror', err => error = err)

      const result = await this.page.evaluate(() => {
        render(create('div', { id: 'foo' }, [[
          create('a', { key: 1 }),
          create('a', { key: 2 })
        ]]), document.body)
      })

      return new Promise(resolve => {
        setTimeout(() => {
          assert.ok(error instanceof Error)
          assert.ok(/iteration.+key/.test(error.message))
          resolve()
        }, 20)
      })
    })

    it('renders svg', async function () {
      const result = await this.page.evaluate(() => {
        render(create('svg', {
          "id": "my-svg",
          "xmlns": "http://www.w3.org/2000/svg",
          "xmlns:xlink": "http://www.w3.org/1999/xlink",
          "viewBox": "553 230 70 70",
          "width": "70",
          "height": "70"
        }, [
          create('rect', {
            x: "553",
            y: "230",
            width: "70",
            height: "70",
            transform: "matrix(1,0,0,1,0,0)",
            "fill": "rgb(235,235,235)"
          })
        ]), document.body)

        return new Promise(resolve => setTimeout(() => {
          const node = document.querySelector('#my-svg')
          resolve(JSON.parse(JSON.stringify(getComputedStyle(node))))
        }, 10))
      })
      assert.equal(result.width, '70px')
      assert.equal(result.height, '70px')
    })
  })

  describe('#migrate', function () {

    beforeEach(async function () {
      await this.page.evaluate(() => {
        window.app = window.lightningDOM.app()
        window.create = window.lightningDOM.create
        window.render = app.render
        window.migrate = app.migrate
      })
    })

    it('should add a node attribute', async function () {
      const result = await this.page.evaluate(() => {
        const tree1 = create('div', { id: 'foo' })
        const tree2 = create('div', { id: 'foo', 'class': 'bar' })

        render(tree1, document.body)
        migrate(tree1, tree2)

        return new Promise(resolve => setTimeout(() => {
          const nodes = document.querySelectorAll('#foo')
          resolve(nodes.length === 1 && nodes[0].className === 'bar')
        }, 10))
      })
      assert.ok(result)
    })

    it('should remove a node attribute', async function () {
      const result = await this.page.evaluate(() => {
        const tree1 = create('div', { id: 'foo', 'class': 'bar' })
        const tree2 = create('div', { id: 'foo' })

        render(tree1, document.body)
        migrate(tree1, tree2)

        return new Promise(resolve => setTimeout(() => {
          const nodes = document.querySelectorAll('#foo')
          resolve(nodes.length === 1 && nodes[0].className === '')
        }, 10))
      })
      assert.ok(result)
    })

    it('should modify a node attribute', async function () {
      const result = await this.page.evaluate(() => {
        const tree1 = create('div', { id: 'foo', 'class': 'bar' })
        const tree2 = create('div', { id: 'foo', 'class': 'baz' })

        render(tree1, document.body)
        migrate(tree1, tree2)

        return new Promise(resolve => setTimeout(() => {
          const nodes = document.querySelectorAll('#foo')
          resolve(nodes.length === 1 && nodes[0].className === 'baz')
        }, 10))
      })
      assert.ok(result)
    })

    it('should replace a node', async function () {
      const result = await this.page.evaluate(() => {
        const tree1 = create('div', { id: 'foo' })
        const tree2 = create('a', { id: 'bar' })

        render(tree1, document.body)
        migrate(tree1, tree2)

        return new Promise(resolve => setTimeout(() => {
          const foo = document.querySelector('#foo')
          const bar = document.querySelector('#bar')
          resolve(!foo && bar && bar.nodeName.toLowerCase() === 'a')
        }, 10))
      })
      assert.ok(result)
    })

    it('should add a child node', async function () {
      const result = await this.page.evaluate(() => {
        const tree1 = create('div', null, [
          create('span', { id: 'one' })
        ])
        const tree2 = create('div', null, [
          create('span', { id: 'one' }),
          create('span', { id: 'two' })
        ])

        render(tree1, document.body)
        migrate(tree1, tree2)

        return new Promise(resolve => setTimeout(() => {
          const one = document.querySelector('#one')
          const two = document.querySelector('#two')
          resolve(one && two)
        }, 10))
      })
      assert.ok(result)
    })

    it('should remove a child node', async function () {
      const result = await this.page.evaluate(() => {
        const tree1 = create('div', null, [
          create('span', { id: 'one' }),
          create('span', { id: 'two' })
        ])
        const tree2 = create('div', null, [
          create('span', { id: 'one' })
        ])

        render(tree1, document.body)
        migrate(tree1, tree2)

        return new Promise(resolve => setTimeout(() => {
          const one = document.querySelector('#one')
          const two = document.querySelector('#two')
          resolve(one && !two)
        }, 10))
      })
      assert.ok(result)
    })

    it('should replace a child node and remove its children', async function () {
      const result = await this.page.evaluate(() => {
        const tree1 = create('div', null, [
          create('span', { id: 'one' }),
          create('span', { id: 'two' }, [ create('a', { id: 'three' }) ])
        ])
        const tree2 = create('div', null, [
          create('span', { id: 'one' }),
          create('a', { id: 'two' })
        ])

        render(tree1, document.body)
        migrate(tree1, tree2)

        return new Promise(resolve => setTimeout(() => {
          const one = document.querySelector('#one')
          const two = document.querySelector('#two')
          const three = document.querySelector('#three')
          resolve(one && two && !three && two.nodeName.toLowerCase() === 'a')
        }, 10))
      })
      assert.ok(result)
    })

    it('should add a keylist child node in the right place', async function () {
      const result = await this.page.evaluate(() => {
        const tree1 = create('div', null, [[
          create('span', { id: 'one', key: 'one' }),
          create('span', { id: 'three', key: 'three' })
        ]])
        const tree2 = create('div', null, [[
          create('span', { id: 'one', key: 'one' }),
          create('span', { id: 'two', key: 'two' }),
          create('span', { id: 'three', key: 'three' })
        ]])

        render(tree1, document.body)
        migrate(tree1, tree2)

        return new Promise(resolve => setTimeout(() => {
          const one = document.querySelector('#one')
          const two = document.querySelector('#two')
          const three = document.querySelector('#three')
          resolve(two.previousSibling === one && two.nextSibling === three)
        }, 10))
      })
      assert.ok(result)
    })

    it('should re-sort keylist children', async function () {
      const result = await this.page.evaluate(() => {
        const tree1 = create('div', null, [[
          create('span', { id: 'one', key: 'one' }),
          create('span', { id: 'two', key: 'two' }),
          create('span', { id: 'three', key: 'three' })
        ]])
        const tree2 = create('div', null, [[
          create('span', { id: 'two', key: 'two' }),
          create('span', { id: 'three', key: 'three' }),
          create('span', { id: 'one', key: 'one' })
        ]])

        render(tree1, document.body)
        migrate(tree1, tree2)

        return new Promise(resolve => setTimeout(() => {
          const one = document.querySelector('#one')
          const two = document.querySelector('#two')
          const three = document.querySelector('#three')
          resolve(three.previousSibling === two && three.nextSibling === one)
        }, 10))
      })
      assert.ok(result)
    })

    it('should modify the correct keylist child node when changing child positions', async function () {
      const result = await this.page.evaluate(() => {
        const tree1 = create('div', null, [[
          create('span', { key: 'one', 'class': 'one' }),
          create('span', { key: 'two', 'class': 'two' }),
          create('span', { key: 'three', 'class': 'three' })
        ]])
        const tree2 = create('div', null, [[
          create('span', { key: 'one', 'class': 'one' }),
          create('span', { key: 'three', 'class': 'three' }),
          create('span', { key: 'two', 'class': 'two foo' })
        ]])

        render(tree1, document.body)
        migrate(tree1, tree2)

        return new Promise(resolve => setTimeout(() => {
          const two = document.querySelectorAll('.two')[0]
          resolve(/foo/.test(two.className))
        }, 10))
      })
      assert.ok(result)
    })

  })
})
