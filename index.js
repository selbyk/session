/**
 * Module dependencies.
 */

var debug = require('debug')('koa-session');
var deepEqual = require('deep-equal');

var ONE_DAY = 24 * 60 * 60 * 1000;

/**
 * Initialize session middleware with `opts`:
 *
 * - `key` session cookie name ["koa:sess"]
 * - all other options are passed as cookie options
 *
 * @param {Object} [opts]
 * @param {Application} app, koa application instance
 * @api public
 */

module.exports = function(opts){
  opts = opts || {};
  // key
  opts.key = opts.key || 'koa:sess';

  // back-compat maxage
  if (!('maxAge' in opts)) opts.maxAge = opts.maxage;

  // defaults
  if (null === opts.overwrite) opts.overwrite = true;
  if (null === opts.httpOnly) opts.httpOnly = true;
  if (null === opts.signed) opts.signed = true;

  debug('session options %j', opts);

  // setup encoding/decoding
  if (typeof opts.encode !== 'function') {
    opts.encode = encode;
  }
  if (typeof opts.decode !== 'function') {
    opts.decode = decode;
  }
  return async (ctx, next) => {

  // to pass to Session()
  ctx.sessionKey = opts.key;

ctx.__defineGetter__('session', function(){
    let sess = ctx._sess;
    // already retrieved
    if (sess) return sess;

    // unset
    if (false === sess) return null;

    var json = ctx.cookies.get(opts.key, opts);

    if (json) {
      debug('parse %s', json);
      try {
        // make sure sessionOptions exists
        initSessionOptions(ctx, opts);
        var obj = opts.decode(json);
        if (typeof opts.valid === 'function' && !opts.valid(ctx, obj)) {
          // valid session value fail, ignore this session
          sess = new Session(ctx);
          json = obj;
          debug('invalid %j', obj);
        } else {
          sess = new Session(ctx, obj);
          // make prev a different object from sess
          json = opts.decode(json);
        }
      } catch (err) {
        // backwards compatibility:
        // create a new session if parsing fails.
        // new Buffer(string, 'base64') does not seem to crash
        // when `string` is not base64-encoded.
        // but `JSON.parse(string)` will crash.
        debug('decode %j error: %s', json, err);
        if (!(err instanceof SyntaxError)) throw err;
        sess = new Session(ctx);
        json = null;
      }
    } else {
      debug('new session');
      sess = new Session(ctx);
    }

    ctx._sess = sess;
    ctx._prevjson = json;
    return sess;
  });

  ctx.__defineSetter__('session', function(val){
    if (null === val) {
      ctx._sess = false;
      return ctx._sess;
    }
    if ('object' === typeof val) {
      ctx._sess = new Session(ctx, val);
      return ctx._sess;
    }
    throw new Error('this.session can only be set as null or an object.');
  });


    // make sessionOptions independent in each request
    initSessionOptions(ctx, opts);
    try {
      await next();
    } catch (err) {
      throw err;
    } finally {
      commit(ctx, ctx._prevjson, ctx._sess, opts);
    }
  };
};

function initSessionOptions(ctx, opts) {
  if (ctx.sessionOptions) {
    return;
  }
  ctx.sessionOptions = {};
  for (var key in opts) {
    ctx.sessionOptions[key] = opts[key];
  }
}

/**
 * Commit the session changes or removal.
 *
 * @param {Context} ctx
 * @param {Object} prevjson
 * @param {Object} sess
 * @param {Object} opts
 * @api private
 */

function commit(ctx, prevjson, sess, opts) {
  // not accessed
  if (undefined === sess) return;

  // removed
  if (false === sess) {
    ctx.cookies.set(opts.key, '', opts);
    return;
  }

  // do nothing if new and not populated
  if (!prevjson && !sess.length) return;

  // save
  if (sess.changed(prevjson)) {
    if (typeof opts.beforeSave === 'function') {
      opts.beforeSave(ctx, sess);
    }
    sess.save();
  }
}

/**
 * Session model.
 *
 * @param {Context} ctx
 * @param {Object} obj
 * @api private
 */

function Session(ctx, obj) {
  this._ctx = ctx;
  if (!obj) {
    this.isNew = true;
  }
  else {
    for (var k in obj) {
      // change session options
      if ('_maxAge' === k) this._ctx.sessionOptions.maxAge = obj._maxAge;
      else this[k] = obj[k];
    }
  }
}

/**
 * JSON representation of the session.
 *
 * @return {Object}
 * @api public
 */

Session.prototype.inspect =
Session.prototype.toJSON = function(){
  var self = this;
  var obj = {};

  Object.keys(this).forEach(function(key){
    if ('isNew' === key) return;
    if ('_' === key[0]) return;
    obj[key] = self[key];
  });

  return obj;
};

/**
 * Check if the session has changed relative to the `prev`
 * JSON value from the request.
 *
 * @param {Object} [prev]
 * @return {Boolean}
 * @api private
 */

Session.prototype.changed = function(prev){
  if (!prev) return true;
  delete prev._expire;
  delete prev._maxAge;
  return !deepEqual(prev, this.toJSON());
};

/**
 * Return how many values there are in the session object.
 * Used to see if it's "populated".
 *
 * @return {Number}
 * @api public
 */

Session.prototype.__defineGetter__('length', function(){
  return Object.keys(this.toJSON()).length;
});

/**
 * populated flag, which is just a boolean alias of .length.
 *
 * @return {Boolean}
 * @api public
 */

Session.prototype.__defineGetter__('populated', function(){
  return !!this.length;
});

/**
 * get session maxAge
 *
 * @return {Number}
 * @api public
 */

Session.prototype.__defineGetter__('maxAge', function(){
  return this._ctx.sessionOptions.maxAge;
});

/**
 * set session maxAge
 *
 * @param {Number}
 * @api public
 */

Session.prototype.__defineSetter__('maxAge', function(val){
  this._ctx.sessionOptions.maxAge = val;
});

/**
 * Save session changes by
 * performing a Set-Cookie.
 *
 * @api private
 */

Session.prototype.save = function(){
  var ctx = this._ctx;
  var json = this.toJSON();
  var opts = ctx.sessionOptions;
  var key = ctx.sessionKey;

  // set expire into cookie value
  var maxAge = opts.maxAge || ONE_DAY;
  json._expire = maxAge + Date.now();
  json._maxAge = maxAge;

  try {
    json = opts.encode(json);
    debug('save %s', json);
  } catch (e) {
    debug('encode %j error: %s', json, e);
    json = '';
  }
  ctx.cookies.set(key, json, opts);
};

/**
 * Decode the base64 cookie value to an object.
 *
 * @param {String} string
 * @return {Object}
 * @api private
 */

function decode(string) {
  var body = new Buffer(string, 'base64').toString('utf8');
  var json = JSON.parse(body);

  // check if the cookie is expired
  if (!json._expire) return null;
  if (json._expire < Date.now()) return null;
  return json;
}

/**
 * Encode an object into a base64-encoded JSON string.
 *
 * @param {Object} body
 * @return {String}
 * @api private
 */

function encode(body) {
  body = JSON.stringify(body);
  return new Buffer(body).toString('base64');
}
