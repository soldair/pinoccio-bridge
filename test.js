var dongle = require('./');


dongle('/dev/ttyACM0',{host:'localhost'},function(err,d){

  console.log('bridge online');

  console.error(err);
  if(!d) throw new Error("could not connect to scout for some reason. is a serial monitor open?")
  

  var ss = d.scoutScript;

  var i = 0;
  setImmediate(function(){
    d._scommand('led.blue;',function(err,data){
      if(err) throw err;
      console.log('BRIDGE SCOUT READY!');
    })
  });
});






