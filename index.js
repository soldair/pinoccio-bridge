// combine bridge and serial event stream
var bridge = require('pinoccio-server/bridge');
var serial = require('./serial.js');

module.exports = function(com,options,readycb){
  if(typeof options == 'function'){
    readcb = options;
    options = {};
  }

  var s = serial(com,function(err){
    if(err) return readycb(err);
    var b = bridge(options)
    s.bridge = b;

    s.pipe(b).pipe(s);
    if(readycb) readycb(false,s);
  });

  return s;
}
