var json = require('./json');
var split = require('split');
var through = require('through');

// parse hq messages from serial verbose output

module.exports = function(){
  //TODO
  var s = split();
  var t = through(function(data){
    return s.write(data);
  });

  var state;

  s.on('data',function(line){

    //console.log('got data event in verbose parser----- ',line)

    if(line.indexOf('Hello from Pinoccio!') > -1){
      t.emit('reboot');
    }

    var i = line.indexOf('[hq-bridge]');
    if(i > -1){
      line = line.substr(i);// line may not begin with [hq-... may be bitlash prompt ">" etc
      var o = json(line.substr(line.indexOf('{')))
      t.queue(o);
    }
  });

  return t
}




