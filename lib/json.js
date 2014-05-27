
module.exports = json;

function json(s){
  try{
    return JSON.parse(s);
  }catch(e){}
}
