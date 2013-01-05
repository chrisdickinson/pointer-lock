module.exports = pointer

pointer.available = available

var EE = require('events').EventEmitter
  , Stream = require('stream').Stream

function available() {
  return !!shim(document.body)
}

function pointer(el) {
  var ael = el.addEventListener || el.attachEvent
    , doc = el.ownerDocument
    , body = doc.body
    , rpl = shim(el) 
    , out = {dx: 0, dy: 0}
    , ee = new EE
    , stream = null
    , lastPageX, lastPageY
    , needsFullscreen = false
    , mouseDownMS

  ael.call(el, 'mousedown', onmousedown, false)
  ael.call(el, 'mouseup', onmouseup, false)
  ael.call(body, 'mousemove', onmove, false)

  var vendors = ['', 'webkit', 'moz', 'ms', 'o']

  for(var i = 0, len = vendors.length; i < len; ++i) {
    ael.call(doc, vendors[i]+'pointerlockchange', onpointerlockchange)
    ael.call(doc, vendors[i]+'pointerlockerror', onpointerlockerror)
  }

  ee.release = release
  ee.target = pointerlockelement
  ee.request = onmousedown

  if(!shim) {
    setTimeout(function() {
      ee.emit('error', new Error('pointer lock is not supported'))
    }, 0)
  }
  return ee

  function onmousedown(ev) {
    if(pointerlockelement()) {
      return
    }
    mouseDownMS = +new Date
    rpl.call(el)
  }

  function onmouseup(ev) {
    if(!needsFullscreen) {
      return
    }

    ee.emit('needs-fullscreen')
    needsFullscreen = false
  }

  function onpointerlockchange(ev) {
    if(!pointerlockelement()) {
      if(stream) release()
      return
    }

    stream = new Stream
    stream.readable = true
    stream.initial = {x: lastPageX, y: lastPageY}

    ee.emit('attain', stream)
  }

  function onpointerlockerror(ev) {
    var dt = +(new Date) - mouseDownMS
    if(dt < 100) {
      // we errored immediately, we need to do fullscreen first.
      needsFullscreen = true
      return
    }

    if(stream) {
      stream.emit('error', ev)
      stream = null
    }
  }

  function release() {
    ee.emit('release')

    if(stream) {
      stream.emit('end')
      stream.readable = false
      stream.emit('close')
      stream = null
    }

    var pel = pointerlockelement()
    if(!pel) {
      return
    }

    (doc.exitPointerLock ||
    doc.mozExitPointerLock ||
    doc.webkitExitPointerLock ||
    doc.msExitPointerLock ||
    doc.oExitPointerLock).call(doc)
  }

  function onmove(ev) {
    lastPageX = ev.pageX
    lastPageY = ev.pageY

    if(!stream) return

    // we're reusing a single object
    // because I'd like to avoid piling up
    // a ton of objects for the garbage
    // collector.
    out.dx =
      ev.movementX || ev.webkitMovementX ||
      ev.mozMovementX || ev.msMovementX ||
      ev.oMovementX || 0

    out.dy = 
      ev.movementY || ev.webkitMovementY ||
      ev.mozMovementY || ev.msMovementY ||
      ev.oMovementY || 0

    ee.emit('data', out)
    stream.emit('data', out)
  }

  function pointerlockelement() {
    return 0 ||
      doc.pointerLockElement ||
      doc.mozPointerLockElement ||
      doc.webkitPointerLockElement ||
      doc.msPointerLockElement ||
      doc.oPointerLockElement ||
      null
  }
}

function shim(el) {
  return el.requestPointerLock ||
    el.webkitRequestPointerLock ||
    el.mozRequestPointerLock ||
    el.msRequestPointerLock ||
    el.oRequestPointerLock ||
    null
}
