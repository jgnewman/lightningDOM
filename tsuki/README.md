![Tsuki](https://raw.githubusercontent.com/jgnewman/lightningDOM/master/tsuki/tsuki.png)

![Travis Build](https://travis-ci.org/jgnewman/lightningDOM.svg?branch=master)

Tsuki is a composable component framework built on top of LightningDOM. Currently it's more of an experiment than a ready-for-use tool, but it serves to give a little more credence to LightningDOM's benchmarks.

When trying to show how virtual DOMs stack up against each other, it can be tough to get your hands on raw copies of the core virtual DOM implementations that live _inside_ larger frameworks like React and Vue. Plus, in real life, people aren't using those raw implementations, they're using the larger frameworks.

Tsuki is meant to achieve core feature parity with some of these frameworks while leveraging LightningDOM for the heavy lifting. For the purposes of these benchmarks, "core feature parity" means composable components, state management, and reactive re-rendering as a response to stage changes. With that in mind, here are the results of the latest test (smaller is better):

```
lightningDOM (raw) v0.0.10   0.2531 seconds   ■■■■■■
Tsuki v0.0.1                 0.2704 seconds   ■■■■■■
vue v2.5.17                  0.8629 seconds   ■■■■■■■■■■■■■■■■■■
react v16.5.2                1.4046 seconds   ■■■■■■■■■■■■■■■■■■■■■■■■■■■■
preact v8.3.1                1.3000 seconds   ■■■■■■■■■■■■■■■■■■■■■■■■■■

(Tests performed on Chromium 69, Ubuntu 18.04, Lenovo ThinkPad X1 Carbon 5th generation, 2.7GHz Intel Core i7, 16 GB RAM)
```

Keep in mind, these are _informal_ benchmarks, but they require each framework to perform the following task upon each iteration: spin up a new application, render 10,000 items, remove half of them and re-sort the list, then add them back in and re-sort the list again. The times listed above indicate the mean average time it took each framework to perform a single iteration of that task over multiple iterations.

Tsuki did pretty well!

## Interested in Tsuki?

Tsuki means "moon" in Japanese. The inspiration for the name came after my youngest child was listening to a Kyary Pamyu Pamyu song that contains the catchy little phrase "Kanpeki! Good job, Otsuki san!", which means basically, "It's perfect! Good job, Mr. Moon!" After solving a little bug in the code and seeing the framework perform as expected, I said to my code, "Kanpeki! Good job, Otsuki san!" And the name stuck.

### How does it work?

Like this:

```javascript
new Tsuki({
  el: '#my-app-container',
  view: () => T.div`class=app` ("Hello, world!")
})
```

**This is a fully-functional Tsuki app.**

As you can see, there's a little UX inspiration in there from Vue.js. But functionally it's actually a lot more like React. Here's an example using composable components:

```javascript
const component = text => {
  return text
}

const appContainer = () => {
  return T.div`class=app` (
    component({ text: "Hello, world!" })
  )
}

new Tsuki({
  el: '#my-app-container',
  view: appContainer
})
```

### Syntax

As you probably noticed, there's a brand new DSL in here for building the DOM. We'll call it "Crescent". This was added for 2 reasons:

1. I didn't want to transpile JSX but I also wanted to avoid having to write `lightningDOM.create` a million times.
2. In complete honesty, I wanted to add some extra runtime processing to the framework since everything was so minimal otherwise and the most popular frameworks are doing a bunch more stuff outside of the core feature set.

Anyway, here's how it works: Crescent is just an ES6 template rendering system. It supports all tag names supported by HTML5 that can go inside a `body` tag.

The `T` variable is just a shortcut for `Tsuki`, so the Crescent functions are all static methods on that class.

Basically you call the function named by whichever tag you want to build and pass your attributes into the template string using a very HTML-like syntax. Doing this returns a function that takes children.

Here's how you'd build an `a` tag:

```javascript
T.a`class=myclass href=https://www.google.com`
```

Here's how you'd build that same tag with some text inside it:

```javascript
T.a`class=myclass href=https://www.google.com` ("Click me!")
```

Here's how you'd build it with multiple child nodes:

```javascript
T.a`class=myclass href=https://www.google.com` (
  T.span`` ("Click"),
  T.span`` ("me!"),
)
```

It's pretty much that simple. Note that you don't surround your attribute values with quotation marks because they can't include spaces. If you need spaces (for example, if you want many classes), you can just pass in what you need as a template variable:

```javascript
T.a`class=${"class1 class2 class3"} href=https://www.google.com` ("Click me!")
```

If you want to drop one of your components into Crescent syntax, just call it like a function and pass in the props you want it to take:

```javascript
const component = name => {
  return `Hello ${name}!`
}

const appContainer = () => {
  return T.span`class=greeter` (
    component({ name: "John" })
  )
}

const myApp = new Tsuki({
  el: '#my-app',
  view: appContainer
})
```

## API

Tsuki's API is designed to be _tsuper_ simple. Every app starts with a `new Tsuki` and is built from components. All components are just functions that return Crescent syntax (i.e. LightningDom virtual trees).

When you create a `new Tsuki`, you pass in an options object with at least two properties: `el` and `view`.

The `el` property can either be a real DOM node or a CSS selector identifying a real DOM node. It tells Tsuki where to render your app. The `view` property is a component – a function that spits out some Crescent syntax. It must return a single element but that element can contain as many nested children as you like.


```javascript
const myApp = new Tsuki({
  el: '#my-app',

  view: () => {
    return T.div`class=app-container` (
      "Hello world!"
    )
  }
})
```

### Managing State

Every Tsuki app implicitly holds a single store of truth. It takes the form of an object representing the state of your application (much like Redux). The values in your state will be passed as an object to your app's `view` function. You then have the responsibility of passing the appropriate portions of your state down to smaller components. Whenever the state changes, your app is automatically re-rendered with the new values.

You can pre-populate your state by giving your app an `init` object. When your app spins up for the first time, it will call the `view` function and hand it your pre-populated state as an object we usually call `props`.

```javascript
const myApp = new Tsuki({
  el: '#my-app',

  init: {
    greeting: "Hello, world!"
  },

  view: props => {
    return T.div`class=app-container` ( props.greeting )
  }
})
```

To change state, you'll write rules. Each rule is a function that takes in data and returns _a new copy_ of the state.

> Note: Always return a new copy of the state. Never modify the existing one.

Rules should be written in a `rules` option passed to your app.

```javascript
const myApp = new Tsuki({
  el: '#my-app',

  init: {
    greeting: "Hello, world!"
  },

  rules: {
    updateGreeting: newGreeting => state => {
      return { ...state, greeting: newGreeting }
    }
  },

  view: props => {
    return T.div`class=app-container` ( props.greeting )
  }
})
```

Once you've created rules, they will be passed to your `view` function along with your props. This way, you can run them whenever you'd like or pass them down to smaller components.

```javascript
const myApp = new Tsuki({
  el: '#my-app',

  init: {
    greeting: "Hello, world!"
  },

  rules: {
    updateGreeting: newGreeting => state => {
      return { ...state, greeting: newGreeting }
    }
  },

  view: (props, rules) => {
    return T.div`class=app-container` (
      props.greeting,
      T.button`onclick=${() => rules.updateGreeting("It worked!")}` ('Change greeting'),
    )
  }
})
```

In this example we added a button to the view. When it gets clicked, the `onclick` function runs and executes the `updateGreeting` rule. This rule updates the state and the app gets re-rendered as a result.

One thing to note, your rules can also be asynchronous!

```javascript
rules: {
  updateData: async (url) => {
    const data = await getSomeData(url)
    return state => ({ ...state, data: data })
  }
}

// or...

rules: {
  updateData: url => {
    return fetchSomeDataWithPromise(url).then(data => {
      return state => ({ ...state, data: data })
    })
  }
}

// or if you're worried about errors...

rules: {
  updateData: url => {
    return fetchSomeDataWithPromise(url)
      .then(data => {
        return state => ({ ...state, data: data })
      })
      .catch(err => {
        return state => ({ ...state, errMsg: err.message })
      })
  }
}
```

### Working With Conditions

Sometimes you may want to render a node only if a certain condition is truthy. The ugly way to do that looks like this:

```javascript
T.div`class=app` (
  T.h1`` ("Hello, user!"),
  (() => {
    if (shouldShowMoreText) {
      return T.p`class=more-text` ("Here's some more text for you!")
    }
  })()
)
```

This is a little annoying and hard to read. Fortunately, Tsuki contains a few convenience utils for dealing with conditions. The first one is `T.when`. This function takes a condition and allows you to do a couple different things with it. For the most basic usage, you'll want to render a node if some condition is true. You'd do that like this:

```javascript
T.div`class=app` (
  T.h1`` ("Hello, user!"),
  T.when(shouldShowMoreText).use(() =>
    T.p`class=more-text` ("Here's some more text for you!")
  )
)
```

The other thing you'll want to do is pick which node to render based on a few possible conditions. For that, you can use `pick` and `choose`:

```javascript
T.div`class=app` (
  T.h1`` ("Hello, user!"),
  T.pick(
    T.when(location.path === 'foo').choose(fooComponent),
    T.when(location.path === 'bar').choose(barComponent),
    T.choose(defaultComponent) // else case
  )
)
```

In this example, we pass a few instances of `T.when ... choose` to `T.pick`. It will take a look at each of their conditions and execute the `choose` function for the first truthy value. You can also use `T.choose(x)` as a shortcut for `T.when(true).choose(x)` in order to specify an else case.

### Referencing Real Nodes

One other thing you might want to do occasionally is grab a reference to a real DOM node. Sometimes there's just no way around this, especially if you want to do something like manually trigger a focus on a form field. To help you out here, Tsuki allows you to capture references to the nodes built from Crescent syntax:

```javascript
const onclick = (rules, ref) => {
  rules.updateGreeting("It worked!")
  console.log(ref.get('myDiv'))
}

const myApp = new Tsuki({
  el: '#my-app',

  init: {
    greeting: "Hello, world!"
  },

  rules: {
    updateGreeting: newGreeting => state => {
      return { ...state, greeting: newGreeting }
    }
  },

  view: (props, rules) => {
    const ref = new T.Ref()

    return T.div`class=app-container` (
      props.greeting,
      ref.capture('myDiv', T.div`I'm a div!`),
      T.button`onclick=${() => onclick(rules, ref)}` ('Change greeting'),
    )
  }
})
```

In this example, we created a new `Ref` object and wrapped a div in a call to `ref.capture`. We also gave it a name (`myDiv`). This provided a way for us to grab the real DOM node associated with our Crescent div by calling `ref.get` and passing in the name of the reference.

**One last trick:**

In the last example we passed an arrow function to our button's `onclick` attribute because, normally, `onclick` is called with an event object but we really only cared about our `rules` and `ref` data. Tsuki gives you a convenient way to generate a function in a case like this that takes all the arguments you want:

```javascript
const onclick = (evt, greeting) => {
  console.log('I was called with', evt, greeting)
}

const myApp = new Tsuki({
  el: '#my-app',

  init: {
    greeting: 'Hello, world!'
  },

  view: ({ greeting }) => {
    return T.div`class=app-container` (
      T.button`onclick=${T.inject(onclick, greeting)}` ('Click me!'),
    )
  }
})
```

Here we use `T.inject` to inject `greeting` into the `onclick` function as an argument. This method inserts any number of arguments you specify _after_ any native arguments that function would normally take.

And that's all there is to it!
