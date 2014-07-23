var bridge = require('./');


bridge('/dev/tty.usbmodem1431',{},function(err,d){

  if(err) console.error(err);
  if(!d) throw new Error("could not connect to scout for some reason. is something else connecting via serial? or is it a different com port?")

  console.log('bridge online');

  d.bridgeCommand('led.blue;',function(err,data){
    if(err) throw err;
    console.log('BRIDGE SCOUT READY!');
  })
  setTimeout(function(){
    d.bridgeCommand('asdf',function(err,data){
      console.log('ASDF',err,data);
      d.bridgeCommand('led.red;',function(err,data){
        console.log('RED',err,data);
      })
    })
    
  },10000);
}).on('data',function(data){
  console.log('event stream>',data);
});






