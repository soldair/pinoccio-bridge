var dongle = require('./');


dongle('/dev/ttyACM0',{host:'localhost'},function(err,d){

  console.log('dongle online');

  console.log(err);

  var ss = d.scoutScript;

  var i = 0;
  setImmediate(function(){
    d._scommand('led.blue;',function(err,data){
      if(err) throw err;
      console.log('DONGLE SCOUT READY!')
    })
  });
});






