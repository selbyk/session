# koa-session-async

 Simple cookie-based session middleware for Koa 2. Forked from For Koa 2, use [koa-session](https://github.com/koajs/session) to use ES6 and ES7 async/await keywords.

## Installation

```js
$ npm i --save koa-session-async
```

## Example

  View counter example:

```js
'using strict';
/*
    Import required dependencies
 */
const session = require('koa-session-async');
const Koa = require('koa');

/*
    Instantiate the koa app
 */
const app = new Koa();

/*
    Setup secrets
 */
app.keys = ['secret'];

/*
    Attach middleware
 */
app.use(session(app));

/*
    Hopefully this works...
 */
app.use(async (ctx) => {
  if ('/favicon.ico' === ctx.path){
    return;
  }
  let n = ctx.session.views || 0;
  ctx.session.views = ++n;
  ctx.body = n + ' views';
});

/*
    Turn it on
 */
app.listen(3000);
console.log('listening on port 3000');
```

## Semantics

  This module provides "guest" sessions, meaning any visitor will have a session,
  authenticated or not. If a session is _new_ a Set-Cookie will be produced regardless
  of populating the session.

## API

### Options

  The cookie name is controlled by the `key` option, which defaults
  to "koa:sess". All other options are passed to `ctx.cookies.get()` and
  `ctx.cookies.set()` allowing you to control security, domain, path,
  and signing among other settings.

#### Custom `encode/decode` Support

  Use `options.encode` and `options.decode` to customize your own encode/decode methods.

### Hooks

  - `valid()`: valid session value before use it
  - `beforeSave()`: hook before save session

### Session#isNew

  Returns __true__ if the session is new.

### Session#maxAge

  Get cookie's maxAge.

### Session#maxAge=

  Set cookie's maxAge.

### Destroying a session

  To destroy a session simply set it to `null`:

```js
this.session = null;
```

## Session Stores

  This module only supports cookie sessions. There are many other modules listed in [koa's wiki](https://github.com/koajs/koa/wiki#wiki-sessions) for sessions that use database storage. Unlike Connect 2.x's session middleware, there is no main "session" middleware that you plugin different stores - each store is a completely different module.

  If you're interested in creating your own koa session store, feel free to fork/extend this repository and add additional tests. At a minimum, it __should__ pass this repositories' tests that apply. Ideally, there would be a central repository with specifications and tests for all koa sessions, which would allow interoperability and consistency between session modules. If you're interested in working on such a project, let us know!

## License

  MIT
