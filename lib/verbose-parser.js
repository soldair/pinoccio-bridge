var json = require('./json');
var keyMap = require('./keys.js')
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
    //48879 === 0xBEEF
    if(line.indexOf('mesh announcing to 48879') === 0){
      var o = json(line.substr(line.indexOf('[')))
      if(o) {
        // unkey seems super broken right now.
        o = unkey(o);
        //console.log('VP> ',o);
        t.queue(o);
      }
    }
  });


  

  return t
}


function unkey(o){
  var data = {};
  var name = keyMap[o[0]];
  var keys = o[1]||false;
  var values = o[2]||false;

  if(keys && keys.forEach){
    keys.forEach(function(v,i){
      if(keyMap[v]) v = keyMap[v];
      data[v] = values[i];
    })
  } else {
    return {name:'key-error',data:o};
  }

  //console.log('-------> ',o);

  // ADD TO/FROM?
  data.type = name;
  data._t = Date.now();
  return data;
}

