const PRESERVE_EXACT_KEYS=/password|passcode|secret|token/i;

function normalizeText(value,key=''){
  if(typeof value==='string'){
    if(PRESERVE_EXACT_KEYS.test(String(key))) return value;
    return value.replace(/\s+/gu,' ').trim();
  }

  if(Array.isArray(value)){
    return value.map(item=>normalizeText(item,key));
  }

  if(value&&typeof value==='object'&&!Buffer.isBuffer(value)){
    for(const [childKey,childValue] of Object.entries(value)){
      value[childKey]=normalizeText(childValue,childKey);
    }
  }

  return value;
}

function normalizeInput(req,res,next){
  if(req.body&&typeof req.body==='object'){
    normalizeText(req.body);
  }
  next();
}

module.exports={normalizeInput,normalizeText};
