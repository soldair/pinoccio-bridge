
var through = require('through');
var serial = require('pinoccio/lib/serial')();
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
    // must send token first! TODO.
  });

  serial.connect(com,function(err,scoutScript){
    if(err) return out.emit('error');
    

    out.ready = true;
    out.scoutScript = scoutScript;

    var series = [
      function(){
        out._scommand('hq.gettoken',function(err,data){
          if(err) return out.emit('error',new Error('error getting token. '+err));
          out.token = data; 
          done();
        });
      },
      function(){
        out._scommand('mesh.report',function(err,data){ 
          if(err) return out.emit('error',new Error('error getting mesh config. '+err));
          out.mesh = json(data);
          done();
        });
      },
      function(){
        //var startup = "function startup.dongle {"
        //  +"verbose(1);"
        //  +"mesh.joingroup"
        //+"}";
        //  +"function on.message.group{"
        //    +"group,from,keys"
        //+"};"
        //+""
        out._scommand('hq.verbose(1);report;',done)
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
    var scout;
    //{"type":"mesh","scoutid":2,"troopid":2,"routes":0,"channel":20,"rate":"250 kb/s","power":"3.5 dBm"}
    if(out.mesh) {
      scout = out.mesh.scoutid;
    }

    if(out.token && !out.sentToken){
      out.sentToken = true;
      out.queue({type:"token",token:out.token,dongle:version,scout:scout});
    }

    // add scout id and wrap with type report!
    // make sure its a report!
    // TODO support announce.

    out.queue({type:"report",report:data,from:out.mesh.scoutid});

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


        //console.log('COMMAND REPLY!',data);

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


  // just expose command because you probably want to run commands from everywhere
  out.command = function(scout,command,cb){    
    if(out.mesh && out.mesh.scoutid == scout) return out._scommand(command,cb);

    // needs to support running on other scouts in troop!
    setImmediate(function(){
      cb('dongle cant message other scouts over mesh yet');
    });
  }

  out._scommand = function(command,cb){
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
            if(lines[i].indexOf('mesh announcing to') === 0) continue;
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

