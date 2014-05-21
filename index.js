

var through = require('through');

var serial = require('pinoccio/lib/serial')();

var bridge = require('pinoccio-server/bridge');

module.exports = function(com,options,readycb){
  if(typeof options == 'function'){
    readycb = options;
    options = {};
  }

  if(typeof com == 'object'){
    options = com;
    com = options.com;
  }

  var b = bridge(options);

  b.on('data',function(command){
    console.log('bridge data!',command); 
  });

  serial.connect(com,function(err,scoutScript){
    if(err) return out.emit('error');
    

    out.ready = true;
    out.scoutScript = scoutScript;

    var series = [
      function(){
        out._scommand('hq.gettoken',function(err,data){
          console.log('get token>!',err,data)
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
        out._scommand('verbose(1);report;',done)
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

    scoutScript.on('log',function(data){
      console.log('[log]',data+'');
    });

  });

  var out = through(function(data){
    console.log('data into dongle?',data);
  });

  if(readycb) out.once('error',function(err){
    readycb(err); readycb = noop;
  }) 

  out.ready = false;


  // just expose command because you probably want to run commands from everywhere
  out.command = function(){

  }

  out._scommand = function(command,cb){
    
    var attempts = 0
    , z = this
    , run = function _scommand(){
      z.scoutScript.command(command,function(err,data){
        if(err) {
          if(err.code == 'EWRITE' && ++attempts < 2) return _scommand();
        }
        if(!cb) throw command;
        cb(err,data);
      }) 
    }
    run();
  }
  
  out.close = function(){
    
  }

  return out;
}

function retryCommand(){
}

function noop(){};
