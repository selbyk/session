
'using strict';
/*
    Import required dependencies
 */
const session = require('./');
const Koa = require('koa');

/*
    Instantiate the koa app
 */
const app = new Koa();

/*
    Setup secrets
 */
app.keys = ['some secret hurr'];

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
