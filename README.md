pinoccio-bridge
===============

use a field scout with pinoccio hq. 

plug on scout into your computer and control your whole troop without a wifi backpack


```js

var bridge = require('pinoccio-bridge');

// bridge: 
// args
//   the com port
//   optional options to pass through to https://github.com/soldair/pinoccio-server/blob/master/bridge.js#L12
//   ready callback

bridge('/dev/ttyACM0',{host:'localhost'},function(err,b){


  if(err) console.error(err);
  if(!b) throw new Error("could not connect to scout for some reason. is something else connecting via serial? or is it a different com port?")

  console.log('bridge online');

  // turn the light blue every time someone connects
  // bridgeCommand runs copmmand on the scout that is the bridge.
  b.bridgeCommand('led.blue;',function(err,data){
    if(err) throw err;
    console.log('BRIDGE SCOUT READY!');
  });

  // run commands on any scouts in this mesh.
  b.command(3,'led.red',function(err,data){
    // set the led to red on scout 3 in this troop.
  })

});


```

