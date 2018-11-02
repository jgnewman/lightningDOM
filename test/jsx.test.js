const babelCore = require('@babel/core')
const pluginReact = require('@babel/plugin-transform-react-jsx')
const assert = require('assert')

function transpile(code) {
  return babelCore.transform(code, {
    plugins: [
      [pluginReact, {
        "pragma": "Tsuki.fromJSX" // default pragma is React.createElement
      }]
    ]
  }).code.replace(/\n+\s*/g, ' ')
}

describe('JSX Transpilation', function () {
  it('receives expected code from a normal tag', function () {
    const compiled = transpile('<div></div>')
    const expected = 'Tsuki.fromJSX("div", null);'
    assert.equal(compiled, expected)
  })

  it('receives expected code from a self-closing tag', function () {
    const compiled = transpile('<img/>')
    const expected = 'Tsuki.fromJSX("img", null);'
    assert.equal(compiled, expected)
  })

  it('receives expected code from a tag with attributes', function () {
    const compiled = transpile('<div id="foo" className="bar"></div>')
    const expected = 'Tsuki.fromJSX("div", { id: "foo", className: "bar" });'
    assert.equal(compiled, expected)
  })

  it('receives expected code from a tag with children', function () {
    const compiled = transpile('<div><a></a><span></span></div>')
    const expected = 'Tsuki.fromJSX("div", null, Tsuki.fromJSX("a", null), Tsuki.fromJSX("span", null));'
    assert.equal(compiled, expected)
  })

  it('receives expected code from a tag with keyed children', function () {
    const compiled = transpile('<div>{[<a key="foo"></a>]}</div>')
    const expected = 'Tsuki.fromJSX("div", null, [Tsuki.fromJSX("a", { key: "foo" })]);'
    assert.equal(compiled, expected)
  })
})
