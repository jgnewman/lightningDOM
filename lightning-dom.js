// **lightningDOM**
//
// Tenets for speed:
//
// - Use ES3/4 to avoid transpilation bloat and convenient-but-slower features (ex: addEventListener)
// - Use `for` loops for iterations instead of array methods or recursion
// - Keep efficiency in mind when choosing to use objects or arrays
// - Minimize the amount of functions being called in a process
// - Minimize the amount of conditional statements used
// - Keep virtual nodes as light as possible
// - Avoid real DOM selection at all costs
// - Don't translate attribute names (ex: use `class` not `className` for the class attr)
// - Avoid having expensive operations be blocking
// - Minimize expensive operations by batching where possible


// Open up an old-school module function.
(function () {
  var NO_BROWSER_ERROR = "You can't use lightningDOM in a non-browser environment."
  var NO_KEY_ERROR = "All nodes in an iteration must have a unique `key` attribute."

  // Constants we can use to reference all of the possibilities
  // for node changes resulting from a diff.
  var ADD_NODE = {};
  var REMOVE_NODE = {};
  var REPLACE_NODE = {};
  var ADD_ATTR = {};
  var REMOVE_ATTR = {};
  var REPLACE_ATTR = {};
  var TRANSFER = {};
  var SORT = {};

  function app() {

    // Ensure we can use window then grab a reference to the document.
    if (typeof window === "undefined") {
      throw new Error(NO_BROWSER_ERROR);
    }
    var doc = window.document;

    // Here we'll collect any "*mount" tasks that need to run when
    // nodes are built or removed. Once a render or update completes, these
    // tasks will be run as necessary and cleared out. This means updates should
    // only occur after the first render.
    var tasks = {
      onmount: [],
      onunmount: []
    };

    // Runs all "onmount" functions that have been registered
    // and then clears them out so that they will not be
    // run again accidentally.
    function runTasks(which) {
      var len = tasks[which].length;
      for (var i = 0; i < len; i += 1) {
        tasks[which][i]();
      }
      tasks[which] = [];
    }

    // Where type is one of our available constants,
    // prev is the Node to be changed, next is the Node
    // we're migrating to, and data is any extra data needed
    // in order to perform the migration.
    function Change(type, prev, next, data) {
      this.type = type;
      this.prev = prev;
      this.next = next;
      this.data = data;
    }

    // Where tag is the name of the node to build,
    // attrs is an object of all attributes and element data,
    // and children is an array of Nodes. If the tag is "text",
    // text will contain the actual text for the node.
    //
    // Note that the top level of a virtual dom tree will be
    // a single instance of Node.
    function Node(tag, attrs, children, text, parentNode) {
      this.tag = tag;
      this.text = text;
      this.attrs = attrs;
      this.children = children;
      this.parentNode = parentNode;

      // Capture a quick reference to a key if the Node has one.
      this.key = attrs.key;

      // Once the virtual node is built into a real node, we'll
      // store a reference to that node here so we never have to
      // find it again.
      this.node = null;
    }

    // Define methods for a Node.
    Node.prototype = {

      // A Node is built when the render function is called.
      // Here, we'll build a real node out of our virtual Node,
      // then loop over the children building their nodes as well.
      // We return the tree of real nodes.
      build: function (realParent) {
        var childLength = this.children.length;
        var elem;

        // Create a text node instead of an element if this is
        // supposed to be a text node.
        if (this.tag === 'text') {
          elem = doc.createTextNode(this.text);

        // We'll use the parent as the element to append children to
        // if we have a keylist as opposed to a single node.
        } else if (this.tag === 'keylist') {
          elem = realParent;

        } else {
          elem = doc.createElement(this.tag);
        }

        // Set attributes on the node for every key in the attrs
        // object. If the value is a function, set it as a normal
        // property on the node object rather than as an attribute.
        for (var i in this.attrs) {
          if (i !== 'key') {
            typeof this.attrs[i] === 'function'
              ? elem[i] = this.attrs[i]
              : elem.setAttribute(i, this.attrs[i]); // TODO: translate attribute names?
          }
        }

        // Loop over all the children, build them, and append them
        // to this node.
        for (var j = 0; j < childLength; j += 1) {
          var built = this.children[j].build(elem);
          built && elem.appendChild(built);
        }

        // Store our reference to the real node.
        this.node = elem;

        // Register an onmount function to run after the node gets
        // injected into the DOM. Nodes should only ever be built if
        // they are going to subsequently be injected into the DOM.
        if (typeof this.attrs.onmount === 'function') {
          tasks.onmount.push(elem.onmount);
        }

        return this.tag !== 'keylist' ? elem : null;
      },

      // A function for comparing attributes of this node to the attributes
      // of another node where next is the node we are migrating to.
      // Returns an array of Changes.
      compareAttrsTo: function (next) {
        var changes = [];
        var matchingAttrs = {};

        // Loop over all of our previous attrs and note that we have not
        // yet found the same attribute in the new attrs.
        for (var prevAttr in this.attrs) {
          var isFound = false;

          // Subloop over each new attr.
          for (var nextAttr in next.attrs) {

            // If we find a match, mark this attribute as found, meaning
            // it exists in both attribute collections. Also collect it into a
            // set of attributes that we know are matching between both groups.
            if (nextAttr === prevAttr) {
              isFound = true;
              matchingAttrs[prevAttr] = true;

              // If the value of the two versions is not equal, collect
              // a REPLACE_ATTR Change because it needs to be updated.
              if (next.attrs[nextAttr] !== this.attrs[prevAttr]) {
                changes.push(new Change(REPLACE_ATTR, this, next, [nextAttr, next.attrs[nextAttr]]))
              }

              // End the subloop when we find a match.
              break;
            }
          }

          // If we never found a match within our subloop, it means the attribute
          // doesn't exist in the new attr group and we need to collect a
          // REMOVE_ATTR Change so that it can be deleted.
          if (!isFound) {
            changes.push(new Change(REMOVE_ATTR, this, next, [prevAttr, this.attrs[prevAttr]]));
          }
        }

        // In case there were attributes in the new group that didn't exist in
        // the previous group, we now need to loop over the new group. If the attr
        // is not found in our set of matching attrs, we know it needs to be
        // added so we collect an ADD_ATTR Change.
        for (var nextAttr in next.attrs) {
          if (!matchingAttrs.hasOwnProperty(nextAttr)) {
            changes.push(new Change(ADD_ATTR, this, next, [nextAttr, next.attrs[nextAttr]]));
          }
        }

        // Finally, return the list of all changes.
        return changes;
      },

      // A function comparing lists of children between this node and another node
      // where next is the node we want to migrate to.
      compareChildrenTo: function (next) {
        var changes = [];

        // Start by simplifying references to the old child list
        // and the new child list...
        var prevChildren = this.children;
        var nextChildren = next.children;

        // ...as well as the lengths of each.
        var prevlen = prevChildren.length;
        var nextlen = nextChildren.length;

        // These variables will be useful for tracking some list differences
        // later on.
        var eqlset;
        var eqlsetlen;
        var remainer;
        var remainderlen;

        // If there are few children in the original child list...
        if (prevlen < nextlen) {

          // The equal set is a slice of the new list that is the same length
          // as our original list. The remainder is a slice containing the
          // rest of them..
          eqlset = nextChildren.slice(0, prevlen);
          remainder = nextChildren.slice(prevlen);
          remainderlen = remainder.length;

          // Loop over the original list and recursively compare each child to its
          // counterpart in the equal set. Collect Changes that are returned.
          for (var i = 0; i < prevlen; i += 1) {
            changes = changes.concat(prevChildren[i].compareTo(eqlset[i]));
          }

          // Loop over each child in the remainder. Because they didn't exist
          // in the original list, we know we need to collect an ADD_NODE
          // Change for each one. In this case, the data parameter for the Change
          // object will be the real parent node containing all of the children.
          for (var i = 0; i < remainderlen; i += 1) {
            changes.push(new Change(ADD_NODE, null, remainder[i], prevChildren[0].node.parentNode));
          }

        // If there are fewer children in the new child list...
        } else if (prevlen > nextlen) {

          // The equal set will be a slice of the original list that is the
          // same length as the new list. The remainder will be the slice of
          // everything remaining.
          eqlset = prevChildren.slice(0, nextlen);
          eqlsetlen = eqlset.length;
          remainder = prevChildren.slice(nextlen);
          remainderlen = remainder.length;

          // Loop over the equal set of the original list and recursively
          // compare each child to its counterpart in the new list.
          // Collect changes returned.
          for (var i = 0; i < eqlsetlen; i += 1) {
            changes = changes.concat(eqlset[i].compareTo(nextChildren[i]));
          }

          // Because none of the remainder items exist in the new child list,
          // we will collect a REMOVE_NODE change for each one. Note that we do
          // not need to dig into their children because all of those children
          // will be leaving the DOM together.
          for (var i = 0; i < remainderlen; i += 1) {
            changes.push(new Change(REMOVE_NODE, remainder[i]));
          }

        // If there exist the same amount of children in both lists, loop
        // over the first list recursively comparing each child to its
        // counterpart in the new list and collecting the resulting changes.
        } else {
          for (var i = 0; i < prevlen; i += 1) {
            changes = changes.concat(prevChildren[i].compareTo(nextChildren[i]));
          }
        }

        // Finally, return the changes.
        return changes;
      },

      // A function comparing this node to another node where next represents
      // the node we would like to migrate to.
      compareTo: function (next) {
        var changes = [];

        // If the tags are not the same, we'll automatically decide
        // that the original node should be fully replaced by the new node.
        // Notice we don't care about comparing children here. All children of
        // the old node will be leaving the DOM.
        if (this.tag !== next.tag) {
          changes.push(new Change(REPLACE_NODE, this, next));

        // If both are text nodes, we'll check to see if their values are
        // equal. If so, we'll simply set up a transfer of the real node
        // from the old vnode to the new one. If they're unequal, we'll
        // queue up a REPLACE_NODE change.
        } else if (this.tag === 'text' && next.tag === 'text') {
          if (this.text === next.text) {
            changes.push(new Change(TRANSFER, this, next));
          } else {
            changes.push(new Change(REPLACE_NODE, this, next));
          }

        } else if (this.tag === 'keylist' && next.tag === 'keylist') {
          var keylistDiff = compareKeylistNodes(this, next);
          if (keylistDiff.length) {
            changes = changes.concat(keylistDiff);
          }

        // In any other case, we need to figure out how the new node is
        // different from the old one.
        } else {

          // First we'll compare their attribute groups to find changes there.
          var attrDiff = this.compareAttrsTo(next);
          if (attrDiff.length) {
            changes = changes.concat(attrDiff);
          }

          // Next we'll compare their child lists to find changes there.
          var childDiff = this.compareChildrenTo(next);
          if (childDiff.length) {
            changes = changes.concat(childDiff);
          }

          // If there are no changes to the attribute group, then this
          // node itself is not changing and we need to manually queue up
          // a transfer of the real node from the old vnode to the new one.
          !attrDiff.length && changes.push(new Change(TRANSFER, this, next));
        }

        // Finally, return the changes.
        return changes;
      }

    };

    // Where prev is is the a current keylist Node and next is a keylist
    // Node we want to migrate to. These objects do not represent single
    // nodes but rather lists of Nodes where each Node is identifiable by
    // a unique key. In fact, we'll error if no key is present.
    //
    // This function uses unique keys to determine which Node in a list
    // should be compared against which Node in another list. Anything
    // in the prev list that doesn't match the next list can be removed.
    // Anything from the next list that doesn't match the prev list can be added.
    function compareKeylistNodes(prev, next) {

      // We'll prepare to collect a list of Changes and an object
      // that will store matching items between both lists.
      var changes = [];
      var matches = {};

      // Grab list lengths for efficiency.
      var prevlen = prev.children.length;
      var nextlen = next.children.length;

      // Loop over each item in the previous list and start by
      // stating that we have not found a match in the next list.
      for (var i = 0; i < prevlen; i += 1) {

        var found = false;

        // Subloop over the next list looking for a match.
        for (var j = 0; j < nextlen; j += 1) {
          var prevChild = prev.children[i];
          var nextChild = next.children[j];

          if (typeof prevChild.key !== 'string') {
            throw new Error(NO_KEY_ERROR);
          }

          // IF we find two Nodes with matching keys, we will mark that we
          // found a match both locally and at function scope. We will also
          // compare our matching nodes and add the result to the changes array.
          // Lastly, we break out of the subloop.
          if (nextChild.key === prevChild.key) {
            matches[prevChild.key] = found = true;
            changes = changes.concat(prevChild.compareTo(nextChild));
            break;
          }
        }

        // If we didn't find a matching item in the sublist, we know this
        // Node can be removed.
        if (!found) {
          changes.push(new Change(REMOVE_NODE, prevChild));
        }
      }

      // Now that we've already looped over the entire prev list looking
      // for matches and stored all the ones we found, we don't need to go
      // through that whole process for the next list. Instead, we can just
      // loop over each item and check whether its key exist in our matches
      // collection. If so, we can skip it. If not, we know that Node should
      // be added.
      for (var i = 0; i < nextlen; i += 1) {
        var nextChild = next.children[i];

        if (typeof nextChild.key !== 'string') {
          throw new Error(NO_KEY_ERROR);
        }

        if (!matches.hasOwnProperty(nextChild.key)) {
          changes.push(new Change(ADD_NODE, null, nextChild, prev.parentNode.node));
        }
      }

      // Since we compared keylists, we know that a sort will have to
      // happen when the DOM updates.
      changes.push(new Change(SORT, prev, next));

      return changes;
    }

    // Where node is a virtual Node that might want to run a function
    // when it is removed from the DOM. This function collects that task
    // and recursively collects similar tasks from all nested children
    // since they will all be leaving the DOM as well.
    function collectUnmountTasks(node) {
      var childLen = node.children.length;
      if (typeof node.attrs.onunmount === 'function') {
        tasks.onunmount.push(node.attrs.onunmount);
      }
      for (var i = 0; i < childLen; i += 1) {
        collectUnmountTasks(node.children[i]);
      }
    }

    // To execute ADD_NODE, build the new Node and append it to the
    // real parent node we collected as data in the Change.
    function addNode(change) {
      change.data.appendChild(change.next.build());
    }

    // To execute REMOVE_NODE, get the real parent node of the old
    // Node and remove the real node from it. Collect any unmount
    // tasks to be run at the end of the full update cycle.
    function removeNode(change) {
      change.prev.node.parentNode.removeChild(change.prev.node);
      collectUnmountTasks(change.prev);
    }

    // To execute REPLACE_NODE, get the real parent node from the old
    // Node and replace the real node with the result of building the new Node.
    // Collect any unmount tasks from the old Node to be run at the
    // end of the full update cycle.
    function replaceNode(change) {
      change.prev.node.parentNode.replaceChild(change.next.build(), change.prev.node);
      collectUnmountTasks(change.prev);
    }

    // To execute ADD_ATTR, check to see if the new attr value is
    // a function. If so, add it as a property on the real node.
    // If not, set it as an attribute on the real node.
    // Then queue up a transfer of the real node from the old Node
    // to the new one.
    function addAttr(change) {
      if (typeof change.data[1] === 'function') {
        change.prev.node[change.data[0]] = change.data[1];
      } else {
        change.prev.node.setAttribute(change.data[0], change.data[1]);
      }
      transferNode(change);
    }

    // To execute REMOVE_ATTR, check to see if the new attr value is
    // a function. If so, set the property on the real node to undefined.
    // If not, call removeAttribute. Then queue up a transfer of the
    // real node over to the new Node.
    function removeAttr(change) {
      if (typeof change.data[1] === 'function') {
        change.prev.node[change.data[0]] = undefined;
      } else {
        change.prev.node.removeAttribute(change.data);
      }
      transferNode(change);
    }

    // To execute REPLACE_ATTR, we need to do exactly the same
    // thing we do when we add a new one.
    function replaceAttr(change) {
      addAttr(change);
    }

    // To execute TRANSFER, just move the real node from the
    // old virtual Node to the new one.
    function transferNode(change) {
      change.next.node = change.prev.node;
    }

    // To execute SORT, we just need to make the DOM elements move to
    // the correct order. We have to assume that our "next" Node is a
    // keylist Node, otherwise we shouldn't be sorting. Grab a reference to
    // the real parent node of all of the real child nodes in the list.
    // Loop through the child Nodes and insert the previous real node
    // just before the current real node, to get the order correct.
    function sortNodes(change) {
      var items = change.next.children;
      var loopLen = items.length - 1;
      var parent = items[0] && items[0].node.parentNode;
      for (var i = loopLen; i >= 0; i -= 1) {
        if (i > 0) {
          parent.insertBefore(items[i-1].node, items[i].node);
        }
      }
    }

    // Where prevTree represents a current tree of Nodes and
    // nextTree represents the state we want to migrate to.
    // This function finds all the changes and then performs
    // the migration. It assumes the prevTree has a current
    // representation in the real DOM and will update the
    // real DOM to match nextTree.
    //
    // Returns the nextTree so that you can store a reference to it
    // whenever you want to do future updates.
    function updateProcess(prevTree, nextTree) {

      // Grab a list of all the changes we need to make.
      var diff = prevTree.compareTo(nextTree);
      var difflen = diff.length;
      var change;

      // Loop over all the changes and execute each one.
      for (var i = 0; i < difflen; i += 1) {
        change = diff[i];
        switch (change.type) {
          case ADD_NODE: addNode(change); break;
          case REMOVE_NODE: removeNode(change); break;
          case REPLACE_NODE: replaceNode(change); break;
          case ADD_ATTR: addAttr(change); break;
          case REMOVE_ATTR: removeAttr(change); break;
          case REPLACE_ATTR: replaceAttr(change); break;
          case SORT: sortNodes(change); break;
          case TRANSFER: transferNode(change); break;
        }
      }

      // Run any collected unmount tasks first, then run
      // any mount tasks.
      runTasks('onunmount');
      runTasks('onmount');

      return nextTree;
    }

    // This is the function you use to render your initial Node tree
    // into the real DOM, where tree is a Node tree and `into` is a
    // real DOM node. It biulds the tree, appends it to the node,
    // and runs any onmount tasks it collected.
    function renderProcess(tree, into) {
      into.innerHTML = "";
      into.appendChild(tree.build());
      runTasks('onmount');
    }

    // This is the function you use to create your virtual Node trees.
    // Where tag is something like "div", or "text" for text nodes,
    // attrs is an object of attributes or the actual text if you're creating
    // a text node, and children is an array of child Nodes or nothing if
    // you're creating a text node.
    //
    // create('div', {class: "my-class"}, [
    //   create('span', {class: "my-class-span"}, [
    //     "some text here"
    //   ])
    // ])
    function create(tag, attrs, children) {
      attrs = attrs || {};
      children = children || [];

      var node = new Node(tag, attrs, children);
      var len = children.length;

      for (var i = 0; i < len; i += 1) {
        var child = children[i];

        if (child instanceof Array) {
          children[i] = new Node('keylist', {}, child, null, node); // where node is the keylist parent

        } else if (!(child instanceof Node)) {
          children[i] = new Node('text', {}, [], String(child));
        }

      }

      return node;
    }


    // We want to avoid making a bunch of unnecessary DOM updates.
    // To do that, we'll track a 2-item array indicating the current
    // reflection of the real dom, and what the final state should look like.
    var migration = [];
    var updateTimer = null;

    // This should be completely separated from all other JS on
    // the page. We don't want the initial render to block things.
    // As such, we'll make the initial render process asynchronous.
    var hasRendered = false;
    var renderTimer = null;
    var renderInto = null;
    function render(tree, into) {
      renderInto = into;
      renderTimer = setTimeout(function () {

        // If migrations have been queued up before this
        // run loop began, there is no sense in rending the
        // initial DOM state since it is no longer accurate.
        // Instead, we'll let the defer function take care of it.
        if (migration.length < 2) {
          hasRendered = true;
          renderProcess(tree, into);
        }
      }, 0);
    }

    // This function will handle migrating from the current
    // state of the DOM to the next.
    function defer(prev, next) {

      // If the migration is empty, then we don't know the current
      // state of the DOM. It must be our prev virtual tree.
      // Also, we can safely overwrite whatever might have been in the
      // "next state" position of the migration, because it is no longer
      // accurate.
      !migration.length && migration.push(prev);
      migration[1] = next;

      // If we don't already have a run loop ready to go, start one up.
      // If we do, stop here because the following timer function will
      // take care of everything we need when the next run loop begins.
      if (!updateTimer) {
        updateTimer = setTimeout(function () {
          updateTimer = null;

          // There's a possibility updates were triggered before the app
          // rendered. If not, run the update process moving between
          // our two migration states.
          if (hasRendered) {
            updateProcess(migration[0], migration[1]);

          // If updates were queued up before the initial render
          // happened, then the initial render did not occur. It would
          // have been a waste. Instead, we'll run the initial render
          // now using the most current DOM state.
          } else {
            clearTimeout(renderTimer);
            renderProcess(migration[1], renderInto);
          }

          // Reset our migration, tracking the current reflection of the DOM.
          migration = [migration[1]];
        }, 0);
      }

    }

    // All updates are deferred until the next run loop. This way,
    // if there are multiple DOM migrations queued before the next
    // run loop, we can skip most of them and migrate straight from
    // the current state to the latest state, skipping all steps
    // in between.
    function update(prevTree, nextTree) {
      defer(prevTree, nextTree);
      return nextTree;
    }

    // Package up everything public.
    return {
      create: create,
      render: render,
      update: update
    };

  } // end app function

  // Make sure this can be imported as a package in various
  // build systems or is attached to the window object.
  if (typeof module !== 'undefined') {
    module.exports = app;
  } else {
    window.lightningDOM = app;
  }

  // Close out our old-school module function
}());
