# lightningDOM

_Aspiring to be the world's smallest, fastest, full-featured virtual DOM._

> Current Size: 4.4kb min | 3.0kb min + gzip

## What is this thing and how do I use it?

LightningDom provides an extremely simple API consisting of only three functions: `create`, `render`, and `update`. It allows you to build a tree of virtual nodes, render that tree into real DOM nodes, diff your tree against another virtual tree, and apply the changes, thus automatically updating the real DOM. It's exactly what you'd expect!

Here's a quick example app:

```javascript
import lightningDOM from 'lightningDOM';

const { create, render, update } = lightningDOM();

// Generate a virtual DOM structure
const vdom =
  create('div', { style: 'background: #eaeaea' }, [
    create('h1', { class: 'title' }, [ 'Hello, world!' ]),
    create('span', {}, [ 'This is a lightningDOM app.' ]),

    // When someone clicks this button, we'll call the rerender function
    create('button', { onclick: rerender }, [ 'Change me' ])
  ]);

// Render the virtual DOM into the real DOM
render(vdom, document.body);

function rerender() {

  // Generate a new version of the virtual DOMrundown
  const vdom2 =
    create('div', { style: 'background: #eaeaea' }, [
      create('h1', { class: 'title' }, [ 'I have changed!' ]),
      create('span', {}, [ 'This is now a re-rendered lightningDOM app.' ])
    ]);

  // Find the differences between both versions and apply
  // those differences to the real DOM.
  update(vdom, vdom2);
}
```

**But why do I have to call lightningDOM as a function first?**

Because every instance of `lightningDOM()` gives you an independent lightningDOM "app". This way you can have many simultaneous apps running on the same page.

Now let's talk about each function.

#### `create(String tag [, Object attributes, Array children])`

This function builds a virtual DOM node which represents an HTML element. Your arguments tell it what kind of element it represents, what the attributes are for that element, and what its child nodes should be.

Attributes are named _exactly_ as they would be in real HTML. For example, you must use "class" instead of "className" (as opposed to other libraries like React DOM), and "data-foo" instead of "dataFoo". Part of the reason lightningDOM is so fast and small is that it doesn't waste time translating your attributes for you.

```javascript
create("div", {"class": "my-class", "data-foo": "bar"});
```

You also have the option of adding event handlers exactly as you would in real HTML. Because your nodes will be dynamically added and removed by lightningDOM, it is not a good idea for us to worry about multiple handlers attached to a single event on a given node. Therefore we can be faster and more efficient by using core properties like `onclick` rather than using functions like `addEventListener`.

```javascript
create('a', {onclick: () => doSomething()}, [ 'Click me!' ]);
```

In addition to standard DOM events, lightningDOM provides two more event attributes for your convenience in the spirit of being "full-featured". They are `onmount` and `onunmount`. Neither one is called with any arguments. An `onmount` function runs only when the HTML element is injected into the DOM. An `onunmount` function runs only when the HTML element is removed from the DOM.

```javascript
create('div', {onmount: () => console.log('div was injected')});
```

If you include an array of children, you have three options for what you are allowed to put into that array. First, you can use more virtual nodes.

```javascript
create('div', {}, [
  create(span, {}, [ "Hello, world!" ]);
])
```

Second, you are allowed to use strings.

```javascript
create('div', {} [ "A text node inside a div" ]);
```

Lastly, you are allowed to use arrays. If you pass an array in as a child, each node in that array _must_ be given a unique `key` attribute (unique to the iteration, not globally unique). If keys aren't there, errors shall be thrown. This allows lightningDOM to work much more efficiently when diffing this array against a future version.

```javascript
create('ul', {}, [
  create('li', {}, [ "The first li is special and hard-coded." ]),
  someList.map(item => create('li', {key: item.id}, [ item.text ]))
])
```

#### `render(Node vdom, HtmlElement container)`

This function takes a virtual tree you have built and renders it into the real DOM in a target of your choosing.

```javascript
render(
  create('div', {}, [ 'Hello, world!' ]),
  document.querySelector('#app-container')
);
```

Note that you can not "unrender" an app. Once it's bound to the DOM, it's there to stay. Also, you should call the `render` function once and only once per lightningDOM app. Think of it as the function you use to bind your app to the DOM and then, for the foreseeable future, you will use `update` to make all of your changes.

Also note that manipulating the real DOM is an expensive operation. As such, render is asynchronous and will not block other scripts on your page, _or other actions you take within your lightningDOM app_.

#### `update(Node prev, Node next)`

This function migrates a previous version of the DOM to a new version. It does this by comparing the old virtual tree to a new virtual tree, gathering up a list of changes, and then applying those changes to the real DOM automatically for you.

```javascript
function buildTree(msg) {
  return
    create('div', {}, [
      create('span'¸ {}, [ msg ])
    ]);
}

const v1 = buildTree('Hello, world!');

render(v1, document.body);

const v2 = buildTree('Goodbye, world!');

update(v1, v2);

const v3 = buildTree('Who wants pizza?');

update(v2, v3);
```

Note that `update` is also asynchronous. Apart from making things non-blocking, this serves an important purpose. In the example above, no time passes between creating and updating each subsequent version of the app. When it loads in the browser, it'll run so fast that the user won't even see our first two versions; they'll only see the last one. In a case like this, there is no reason to diff each of these versions against each other and apply changes to the DOM every time. That would be a waste. Rather, what we should _really_ do, is just render `v3` right off the bat and skip everything else!

Part of what makes lightningDOM fast and efficient is that it does this for you.

Of course, when you create your own apps, you probably won't do anything as weird as what's shown in the example. However it is possible that you could do things that trigger multiple changes within a single run loop, which would produce essentially the same effect. If that happens, we'll still have to build new versions of the virtual DOM for every update, so you don't have to worry about things not getting done that you expected to get done. But we don't have to diff and update the DOM for every one. LightningDom will jump right to the end of that chain without wasting time in between.

There is one caveat to all of this. If you create an `onmount` function for a node that is added and then removed within the same run loop, that function will never run. Why? Because it's a waste of time to immediately add and then remove a node from the DOM without giving the user a chance to even see it, much less do anything with it. The same goes for `onunmount`, so make sure to keep this in mind when working with these events.

## So how does it measure up against other virtual DOMs?

As of today, I'm not sure. We can tell it's small and it certainly _feels_ fast but official benchmarks are still to come.
