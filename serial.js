
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

  parser.on('data',function(data){
    // send out to event stream
    handle(data);
    // send to bridge.. the bridge can be moved out of this file.
  });

  serial.connect(com,function(err,scoutScript){
    if(err) return out.emit('error');
    
    out.ready = true;
    out.scoutScript = scoutScript;

    var series = [
      function(){
        out.bridgeCommand('hq.gettoken',function(err,data){
          if(err) return out.emit('error',new Error('error getting token. '+err));
          out.token = data; 
          done();
        });
      },
      function(){
        out.bridgeCommand('mesh.report',function(err,data){ 
          if(err) return out.emit('error',new Error('error getting mesh config. '+err));
          out.mesh = json(data);
          done();
        });
      },
      function(){
        out.bridgeCommand("z=0; while(z < 200) { key.print(z); z = z+1; }",function(err,data){ 
          if(err) return out.emit('error',new Error('error getting mesh config. '+err));

          // add keys pulled directly from the bridge scout.
          parser.keys = data.trim().split("\r\n");

          done();
        });
      },
      function(){
        out.bridgeCommand('hq.bridge(1)',function(err,data){ 
          if(err) return out.emit('error',new Error('error getting mesh config. '+err));
          if(data !== "on") return out.emit('error',new Error('scout requires the hq.bridge command please update firmware.'));
          done();
        });
      },
      function(){
        out.bridgeCommand('report;',done)
      }
    ], done = function(err){
      if(err) return out.emit('error',err);
      var next = series.shift();
      if(next) {
        return next();
      }

      out.emit('ready',scoutScript);
      readycb(false,out);
      readycb = noop;
    };

    done();

    // all serial output
    scoutScript.on('log',function(data){
      parser.write(data);
    });

  });

  // from board
  var handle = function(data){
    //console.log(data);
    out.emit('log',data);
    var scout;
    //{"type":"mesh","scoutid":2,"troopid":2,"routes":0,"channel":20,"rate":"250 kb/s","power":"3.5 dBm"}
    if(out.mesh) {
      scout = out.mesh.scoutid;
    }

    if(out.token && !out.sentToken){
      out.sentToken = true;
      out.queue({type:"token",token:out.token,bridge:version,scout:scout});
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
    //console.log('BRIDGE> ',data);
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
        //console.log('<<<< reply back to hq',data);
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

    out.bridgeCommand("hq.bridge.command("+JSON.stringify(command+'')+","+scout+","+id+");",function(err,data){
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

