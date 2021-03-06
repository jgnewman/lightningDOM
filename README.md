![lightningDOM](https://raw.githubusercontent.com/jgnewman/lightningDOM/master/lightningdom.png)
BETA

_Aspiring to be the world's smallest, fastest, full-featured virtual DOM._

> Current Size: ~6kb min | ~2.5kb min + gzip

![Travis Build](https://travis-ci.org/jgnewman/lightningDOM.svg?branch=master)

## Table of Contents

- [What is this thing and how do I use it?](#what-is-this-thing-and-how-do-i-use-it)
- [A note on speed and efficiency](#a-note-on-speed-and-efficiency)
- [API](#api)
- [Possible Gotchas](#possible-gotchas)

## What is this thing and how do I use it?

LightningDOM provides an extremely simple API consisting of three primary functions: `create`, `render`, and `migrate`. It allows you to build a tree of virtual nodes, render that tree into the real DOM, then diff your tree against another virtual tree and apply the changes, thus automatically updating the real DOM. It's exactly what you'd expect!

Here's a quick example app:

```javascript
import { create, app } from 'lightningDOM';
const myApp = app();

// Generate a virtual DOM structure
const vdomVersion1 =
  create('div', { style: 'background: #eaeaea' }, [
    create('h1', { class: 'title' }, [ 'Hello, world!' ]),
    create('span', {}, [ 'This is a lightningDOM app.' ]),

    // When someone clicks this button, we'll call the rerender function
    create('button', { onclick: rerender }, [ 'Change me' ])
  ]);

// Render the virtual DOM into the real DOM
myApp.render(vdomVersion1, document.body);

function rerender() {

  // Generate a new version of the virtual DOM
  const vdomVersion2 =
    create('div', { style: 'background: #eaeaea' }, [
      create('h1', { class: 'title' }, [ 'I have changed!' ]),
      create('span', {}, [ 'This is now a re-rendered lightningDOM app.' ])
    ]);

  // Find the differences between both versions and apply
  // those differences to the real DOM.
  myApp.migrate(vdomVersion1, vdomVersion2);
}
```

Because it's nice to be able to have multiple lightningDOM apps on one page if you need them, rendering and migrating are actions that happen at the app level. But since creating a virtual node is app-agnostic, the `create` function lives at the top level.

## A Note on Speed and Efficiency

If you would like to see how lightningDOM measures up to some popular frameworks and alternatives, you can spin up this repo in a simple web server and view the `benchmark.html` file. It's an informal benchmark, but it's insightful nonetheless.

The place where DOM manipulation really gets tricky is when you are dealing with lots of elements, and especially long lists of elements. Adding or removing list items, or performing trickier manipulations like reordering them will require a lot of DOM crawling and live node analyzing if you don't use a virtual DOM, and will likely end up doing a LOT of unnecessary rendering if you don't have smart algorithms. Since this is kind of the heart of DOM diffing, the benchmark goes through a bunch of iterations of the following: 1) spinning up an app from scratch, 2) rendering an initial list of 10,000 items, 3) removing half of them and re-sorting the list, then 4) adding the removed items back in and re-sorting again.

Again, these are _informal_ benchmarks, but here are the average times it took for some common libraries to perform this task (smaller is better):

```
lightningDOM v0.0.22   0.2428 seconds   ■■■■■■
vue v2.5.17            0.8629 seconds   ■■■■■■■■■■■■■■■■■■
react v16.5.2          1.4046 seconds   ■■■■■■■■■■■■■■■■■■■■■■■■■■■■
preact v8.3.1          1.3000 seconds   ■■■■■■■■■■■■■■■■■■■■■■■■■■
virtual-dom v2.1.1     1.5254 seconds   ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■

(Tests performed on Chromium 69, Ubuntu 18.04, Lenovo ThinkPad X1 Carbon 5th generation, 2.7GHz Intel Core i7, 16 GB RAM)
```

> If you would like see how lightningDOM performs with a more feature-rich framework wrapped around it, check out **[Tsuki](https://github.com/jgnewman/lightningDOM/tree/master/tsuki)** in this repo.

LightningDOM achieves its (theoretically) unmatched speed and efficiency by adhering to the following tenets. Some of these optimizations are micro and some are a little more macro:

- Keeping the code base as small as possible
- Using only ES3/4 features to avoid transpilation bloat and slower-but-convenient language features
- Making wise decisions about when to use arrays vs objects based on what kind of iterations are needed and keeping in mind native runtime optimizations
- Minimizing the amount of function calls made in a given run loop
- Minimizing the amount of conditional statements used
- Keeping virtual node instances as light as possibile
- Avoiding real DOM crawling and node selection at all costs
- Avoiding regex at all costs
- Avoiding unnecessary transformations (such as translating "className" on the vnode to "class" on the real node)
- Batching expensive operations
- Making expensive operations asynchronous (non-blocking)

# API

#### `create(tag: String [, attributes: Ojbect, children: Array])`

Builds a virtual DOM node which represents an HTML element.

Your arguments tell it what kind of element it represents, what the attributes are for that element, and what its child nodes should be.

> **Note:** Currently, lightningDOM provides only basic SVG support. To see a full list of all supported svg-related tags, log `lightningDOM.meta.svgSupport`.

Attributes are named _exactly_ as they would be in real HTML. For example, you must use "class" instead of "className" (as opposed to other libraries like React DOM). Part of the reason lightningDOM is fast and small is that it doesn't waste time translating your attributes for you.

```javascript
create("div", { "class": "my-class", "data-foo": "bar" });
```

You also have the option of adding event handlers exactly as you would in real HTML. Because your nodes will be dynamically added and removed by lightningDOM, it is not a good idea for us to worry about multiple handlers attached to a single event on a given node. Therefore we can be faster and more efficient by using core properties like `onclick` as opposed to more robust functions like `addEventListener` which are slower and require additional cleanup.

```javascript
create('a', { onclick: () => doSomething() }, [ 'Click me!' ]);
```

In addition to standard DOM events, lightningDOM provides two more event attributes for your convenience in the spirit of being "full-featured". They are `onmount` and `onunmount`. Neither one is called with any arguments. An `onmount` function runs only when the HTML element is injected into the DOM. An `onunmount` function runs only when the HTML element is removed from the DOM. See [Potential Gotchas](#potential-gotchas) for additional information on these particular hooks.

```javascript
create('div', { onmount: () => console.log('div was injected') });
```

If you include an array of children, you have four options for what you are allowed to put into that array. First, you can use more virtual nodes.

```javascript
create('div', {}, [
  create(span, {}, [ "Hello, world!" ]);
])
```

Second, can use strings.

```javascript
create('div', {}, [ "A text node inside a div" ]);
```

Third, you can use the value `null` (in which case, the null node will be ignored).

```javascript
create('div', {}, [ null ]);
```

Lastly, you can use arrays. If you pass an array in as a child, each node in that array _must_ be given a unique `key` attribute (unique to the iteration, not globally unique). If keys aren't there, errors shall be thrown. This allows lightningDOM to work much more efficiently when diffing this array against a future version. Key attributes are not rendered to the real DOM.

```javascript
create('ul', {}, [
  create('li', {}, [ "The first li is special and hard-coded." ]),
  someList.map(item => create('li', { key: item.id }, [ item.text ]))
])
```

#### `render(vdom: VNode, container: HTMLElement)`

This function takes a virtual tree you have built and renders it into the real DOM in a target of your choosing.

```javascript
app.render(
  create('div', {}, [ 'Hello, world!' ]),
  document.querySelector('#app-container')
);
```

Note that you can not "unrender" an app. Once it's bound to the DOM, it's there to stay. Also, you should call the `render` function once and only once per lightningDOM app. Think of it as the function you use to bind your app to the DOM and then, for the foreseeable future, you will use `migrate` to make all of your changes.

Also note that manipulating the real DOM is an expensive operation. As such, render is asynchronous and will not block other scripts on your page _or other actions you take within your lightningDOM app_.

#### `migrate(prev: VNode, next: VNode)`

This function migrates a previous version of the DOM to a new version. It does this by comparing the old virtual tree to a new virtual tree, gathering up a list of changes, and then applying those changes to the real DOM automatically for you.

```javascript
function buildTree(msg) {
  return create('div', {}, [
           create('span'¸ {}, [ msg ])
         ]);
}

const v1 = buildTree('Hello, world!');

app.render(v1, document.body);

const v2 = buildTree('Goodbye, world!');

app.migrate(v1, v2);

const v3 = buildTree('Who wants pizza?');

app.migrate(v2, v3);
```

## Possible Gotchas

### Why didn't my `onmount` function run?

Tl;dr; probably because the node was mounted and removed within the same run loop. For the longer explanation, read on:

The `migrate` function is asynchronous. This serves the purpose of allowing us to batch multiple updates that happen in the same run loop. Batching updates is important because it lets us avoid a bunch of unnecessary diffing and DOM painting. To illustrate, here's a diagram showing a bad technique and good technique for handling 3 virtual trees generated in the same run loop:

```
// This is slow and wasteful!
[create v1] ---> [initial render] ---> [update v2] ---> [update v3]
                        |                   |                |
                       \|/                 \|/              \|/
                  [paint dom]          [diff 1-2]        [diff 2-3]
                                            |                |
                                           \|/              \|/
                                       [paint dom]      [paint dom]

// This is much better!
[create v1] ---> [initial render] ---> [update v2] ---> [update v3]
                                                             |
                                                            \|/
                                                        [diff 1-3]
                                                             |
                                                            \|/
                                                        [paint dom]
```

Part of what makes lightningDOM fast and efficient is that it does this for you.

So the ultimate caveat is this: If you create an `onmount` function for a node that is added and then removed within the same run loop, that function will never run. Why? Because it's a waste of time to actually add and then immediately remove a node from the DOM without giving the user a chance to interact with it. The same goes for `onunmount`, so make sure to keep this in mind when working with these events.

### Why is my text field losing characters as I type?

Tl;dr; probably because you chose the wrong input event to handle. My recommendation is to use `oninput`. For the longer explanation, read on:

Here's a raw implementation for managing the value on a text field. **Spoiler alert** — it has one small problem:

```javascript
function buildTree(inputval="", oldTree) {

  console.log('Input field state:', inputval)

  const newTree = create('input', {
    id: 'myinput',
    type: 'text',
    value: inputval,
    onkeyup: evt => buildTree(evt.target.value, tree)
  }, [])

  if (oldTree) {
    return migrate(oldTree, newTree)
  } else {
    return render(newTree, document.body)
  }
}

buildTree()
```

In this example, the `buildTree` function creates a virtual DOM consisting of nothing but an input field. If we pass it a string value, it uses that string for the value on the field. Whenever the `onkeyup` event is fired, we recursively run `buildTree` and hand it the new value that was typed into the field. All the while we log out the current state of the text field as we type.

The problem is, if we type quickly, our input field will lose characters. The reason is that lightningDOM leverages native DOM events and we can't reliably count on `onkeyup` to be fired synchronously every time we type a new character into the field. That's just the nature of the browser and of the fact that sometimes you might be pressing down on a key before having lifted your finger all the way off the previous key. Combine that with asynchronous, batched updates courtesy of lightningDOM and you start to run into problems. The way we fix this is by using a more reliable input event:

```javascript
oninput: evt => buildTree(evt.target.value, tree)
```

The `oninput` event is synchronously fired every time the field value changes, which is what we want. Having converted to `onkeyup` to `oninput`, we no longer lose characters in the field.
