# Tsuki

Tsuki is a composable component framework built on top of LightningDOM. Currently it's more of an experiment than a ready-for-use tool, but it serves to give a little more credence to LightningDOM's benchmarks.

When trying to show how virtual DOMs stack up against each other, it can be tough to get your hands on raw copies of the core virtual DOM implementations that live _inside_ larger frameworks like React and Vue. Plus, in real life, people aren't using those raw implementations, they're using the larger frameworks.

Tsuki is meant to achieve core feature parity with some of these frameworks, while leveraging LightningDOM at its core. Specifically, it provides a composable components, redux-like management, and reactive re-rendering as a response to stage changes. With that in mind, here are the results of the latest test (smaller is better):

```
lightningDOM (raw) v0.0.1   0.5969 seconds   ■■■■■■
Tsuki v0.0.1                0.6761 seconds   ■■■■■■■
vue v2.5.17                 1.2807 seconds   ■■■■■■■■■■■■■
react v16.5.2               2.0562 seconds   ■■■■■■■■■■■■■■■■■■■■■
preact v8.3.1               1.8245 seconds   ■■■■■■■■■■■■■■■■■■

(Tests performed on Chrome 69, macOS 10.14, 2.7GHz Intel Core i5, 16 GB RAM)
```

Keep in mind, these are _informal_ benchmarks, but they require each framework to perform the following tasks upon each iteration: spin up a new application, render 10,000 items, remove half of them and re-sort the list, then add them back in and re-sort the list again.

## Interested in Tsuki?

Tsuki means "moon" in Japanese. The inspiration for calling the framework Tsuki came after my youngest child was listening to a Kyary Pamyu Pamyu song that contains the catchy little phrase "Kanpeki! Good job, Otsuki san!", which means basically, "It's perfect! Good job, Mr. Moon!" There was a moment when I was struggling with a little bug while putting Tsuki together and, when I finally solved it and watched the code perform as expected, I said, "Kanpeki! Good job, Otsuki san!" And the name stuck.

### How does it work?

Like this:

```javascript
new Tsuki({

  el: '#my-app-container',

  view() {
    return T.div`class=app` ('Hello, world!')
  }

})
```

As you can see, there's a little UX inspiration in there from Vue.js. But functionally it's actually a lot more like React. Here's an example using composable components:

```javascript
const myComponent = new Tsuki({

  view(props) {
    return props.text
  }

})

const app = new Tsuki({

  el: '#my-app-container',

  view() {
    return T.div`class=app` (
      myComponent.use`text=${'Hello, world!'}`
    )
  }

})
```

### Syntax

As you probably noticed, there's a brand new DSL in here for building the DOM. We'll call it "Crescent". This was added for 2 reasons:

1. I wanted to avoid having to write `lightningDOM.create` a million times (since I didn't want to have to transpile JSX).
2. Plus, in complete honesty, I wanted to add some extra runtime processing to the framework since everything was so minimal otherwise and the most popular frameworks are doing a bunch more stuff outside of the core feature set.

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

If you want to drop one of your components into Crescent syntax, you can call that component's native `use` method. This method is also meant for tagging templates and it allows you to pass props to that component's `view` function by writing them in the template string:

```javascript
const myComponent = new Tsuki({
  view(props) {
    return `Hello, ${props.name}!`
  }
})

const myApp = new Tsuki({
  el: '#my-app',
  view() {
    return T.span`class=greeter` (
      myComponent.use`name=John`
    )
  }
})
```

## API

Tsuki's API is designed to be super simple. All apps are built from components and all components are made by calling `new Tsuki({ ...options })`. Most importantly, your component needs to render a view and that is done by making sure your options object contains a `view` function. You can put just about anything else you want into the options object, but there are a couple of reserved options we'll get to in a second.

```javascript
new Tsuki({

  getGreeting() {
    return "Hello, world!"
  },

  view() {
    return this.getGreeting()
  }
})
```

Every Tsuki app needs a top level component with an option called `el`. This option should be a CSS selector that will be used to identify the node in which the app will be rendered. _Only the top level component in your application should take the `el` option._ By virtue of specifying this option, your component will be automatically rendered.

> Note that your top level component's view function can not return a simple string. It must return a single call to `T.<something>`, in which you can nest as many strings or node children as you like.

```javascript
new Tsuki({

  el: '#my-app',

  view() {
    return T.div`class=app-container` (
      "Hello world!"
    )
  }

})
```

### Managing State

Your top level component can contain a few other options to help you manage the state of your app.

Every Tsuki app implicitly holds a single store of truth. It takes the form of an object representing the state of your application (much like Redux). The values in your state will be passed as props to your top level component's `view` function. You then have the responsibility of passing the appropriate portions of your state down to smaller components. Whenever the state changes, your app is re-rendered.

You can pre-populate your state by giving your top level component an `init` function. It will be called when your app spins up and whatever it returns will be fed to the `view` function as props.

```javascript
new Tsuki({

  el: '#my-app',

  init() {
    return {
      greeting: "Hello, world!"
    }
  },

  view(props) {
    return T.div`class=app-container` ( props.greeting )
  }

})
```

To change state, you'll write rules. Each rule is a function that takes in data and returns _a new copy_ of the state.

> Note: Always return a new copy of the state. Never modify the existing one.

Rules should be generated by a `rules` function in your top level component.

```javascript
new Tsuki({

  el: '#my-app',

  init() {
    return {
      greeting: "Hello, world!"
    }
  },

  rules() {
    return {
      UPDATE_GREETING: newGreeting => state => {
        return { ...state, greeting: newGreeting }
      }
    }
  },

  view(props) {
    return T.div`class=app-container` ( props.greeting )
  }

})
```

When you make rules, you get an extra prop called `run` that allows you to run them.

```javascript
new Tsuki({

  el: '#my-app',

  init() {
    return {
      greeting: "Hello, world!"
    }
  },

  rules() {
    return {
      UPDATE_GREETING: newGreeting => state => {
        return { ...state, greeting: newGreeting }
      }
    }
  },

  view(props) {
    const runner = () => props.run('UPDATE_GREETING', 'It worked!')

    return T.div`class=app-container` (
      props.greeting,
      T.button`onclick=${runner}` ('Change greeting'),
    )
  }

})
```

In this example we add a button to the view. When it gets clicked, the runner uses `props.run` to execute the `UPDATE_GREETING` rule. This rule updates the state and the app gets re-rendered as a result.

Of course, you won't always want to define everything that uses props inside the view function. In that case, Tsuki includes a utility to pass props to any function you define:

```javascript
new Tsuki({

  el: '#my-app',

  init() {
    return {
      greeting: "Hello, world!"
    }
  },

  rules() {
    return {
      UPDATE_GREETING: newGreeting => state => {
        return { ...state, greeting: newGreeting }
      }
    }
  },

  handleClick(evt, run) {
    evt.preventDefault()
    run('UPDATE_GREETING', 'It worked!')
  },

  view({ greeting, run }) {
    return T.div`class=app-container` (
      greeting,
      T.button`onclick=${T.inject(run)(this.handleClick)}` ('Change greeting'),
    )
  }

})
```

And that's all there is to it!
