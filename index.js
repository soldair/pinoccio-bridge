

var through = require('through');

var serial = require('pinoccio/lib/serial');

var bridge = require('pinoccio-server/bridge');

module.exports = function(com,options){
  var b = bridge(options);

  b.on('data',function(command){
    
  })

  var s = through(function(data){
    // data from bridge    
  });

  serial.connect(function(err,scoutScript){
    if(err) 
    scoutScript.on('verbose',function(data){
      console.log('v>',data+'');
    });
    

  })

}
