
var through = require('through');
var serial = require('pinoccio-serial')();
var outputParser = require('./lib/verbose-parser');
var json = require('./lib/json');
var version = require('./package.json').version;


module.exports = function(com,readycb){
  if(typeof options == 'function'){
    readycb = options;
    options = {};
  }

  if(typeof com == 'object'){
    options = com;
    com = options.com;
  }

  var out;
  var parser = outputParser();

  parser.on('reboot',function(){
    activateBridge(function(err){
      if(err) console.log('failed to reactivate bridge');
    })
  })

  parser.on('data',function(data){

    // send out to event stream
    handle(data);
    // send to bridge.. the bridge can be moved out of this file.
  });

  serial.connect(com,function(err,scoutScript){
    if(err) return out.emit('error');
    
    out.ready = true;
    out.scoutScript = scoutScript;

    activateBridge(function(err){
      if(err) return out.emit('error',err);

      out.emit('ready',scoutScript);
      readycb(false,out);
      readycb = noop;
    });


    // all serial output
    scoutScript.on('log',function(data){
      parser.write(data);
    });

  });

  function activateBridge(cb){
    out.bridgeCommand('hq.bridge();',function(err,data){ 
      if(err) return out.emit('error',new Error('error getting mesh config. '+err));
      if(data && data.indexOf('unexpected number') > -1) {
        return out.emit('error',new Error('scout requires the hq.bridge command please update firmware.'));
      }
      
      cb(err,data);
    });
  }


  // from board
  var handle = function(data){
    //console.log(data);
    var scout;
    //{"type":"mesh","scoutid":2,"troopid":2,"routes":0,"channel":20,"rate":"250 kb/s","power":"3.5 dBm"}
    if(out.mesh) {
      scout = out.mesh.scoutid;
    }

    
    if(data.type == "token"){

      out.token = data.token;
      data['pinoccio-bridge'] = version+'';

      out.sentToken = true;

    } else if(out.token && !out.sentToken){
      out.sentToken = true;
      out.queue({type:"token",token:out.token,_v:version,bridge:version,scout:scout});
    }


    // add scout id and wrap with type report!
    // make sure its a report!
    // TODO support announce.
    if(data.type == 'reply') return out._handleReply(data);
    out.queue(data);

  }

  out = through(function(data){
    if(!data) return;
    // command stream to board
    if(data.type == 'command') {
      if(!data.to || !data.command){
        return console.log('INVALID BRIDGE COMMAND!',data);
      }

      // support external data.timeout
      var t = Date.now();
      out.command(data.to,data.command,function(err,res){
        //data.
        data.type = "reply";
        if(err) data.err = true;
        data.reply = res != undefined?res:err+'';
        data.from = data.to;
        data.basetime = Date.now()-t;
        data.end = true;
        delete data.to;
        // send replies back.
        out.queue(data);
      });
    } else if(data.type == 'online') {
      // noop.
    } else {
      console.log('UNKNOWN bridge command!',  data);
    }

  });

  if(readycb) out.once('error',function(err){
    readycb(err); readycb = noop;
  }) 

  out.ready = false;

  
  var _id = 0;
  var replyCbs = {};

  out._handleReply = function(reply){

    if(!replyCbs[reply.id]) return;
    var cb = replyCbs[reply.id];

    if(!cb.reply) cb.reply = [];
    cb.reply.push(reply.reply);

    // im really done!
    if(reply.err || reply.end){

      reply.reply = cb.reply.join('');
    } else {

      return;
    }

    delete replyCbs[reply.id];
    clearTimeout(cb.timer);
    
    // TODO err,data from reply
    cb(reply.err?reply.reply:false,reply.reply);

    out.queue(reply); 
  }

  // just expose command because you probably want to run commands from everywhere
  out.command = function(scout,command,cb){    
    if(out.mesh && out.mesh.scoutid == scout) return out.bridgeCommand(command,cb);
  
    var id = ++_id;
    replyCbs[id] = cb;
    var timeout = 10000;
    cb.timer = setTimeout(function(){
      var cb = replyCbs[id];
      if(cb) {
        delete replyCbs[id];
        cb(false,{type:"reply",err:"base timeout in "+timeout+" ms",from:scout});
      }
    },10000);

    command = {id:id,type:"command",to:scout,command:command};
    command = "hq.bridge("+JSON.stringify(JSON.stringify(command)+"\n")+");";

    out.bridgeCommand(command,function(err,data){
      if(err) {
        var cb = replyCbs[id];
        if(!cb)  return;
        delete replyCbs[id];
        cb(false,{type:"reply",id:id,err:err+'',from:scout})
      }
    });
  }

  out.bridgeCommand = function(command,cb){
    command = command.trim(); 
    var attempts = 0
    , z = this
    , run = function _scommand(){
      z.scoutScript.command(command,function(err,data){
        if(err) {
          if(err.code == 'EWRITE' && ++attempts < 2) return _scommand();
        }

        var reply;
        if(!err) {
          var orig = data;
          // remove command just in case it snuck in output.
          if(data.indexOf(command) === 0) data = data.substr(data.indexOf(command));
          var lines = data.split("\r\n");
          reply = [];
          for(var i =0;i<lines.length;++i){
            if(lines[i].indexOf('[hq-bridge]') === 0) continue;
            reply.push(lines[i]);
          }         
          reply = reply.join("\r\n");

        }
        if(cb) cb(err,reply);
      }) 
    }
    run();
  }
  
  out.close = function(){
    
  }


  return out;
}


function noop(){};

