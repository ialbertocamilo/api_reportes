/**
 * Generate array with values of items' specific property
 * @param collection
 * @param key
 * @returns {*}
 */
exports.pluck = (collection, key) => {
  return collection.map(obj => obj[key])
}

/**
 * Generate array with unique values of items' specific property
 * @param collection
 * @param key
 * @returns {*}
 */
exports.pluckUnique = (collection, key) => {
  const values = []
  collection.forEach(obj => {
    if (!values.includes(obj[key])) {
      values.push(obj[key])
    }
  })

  return values
}

/**
 * Remove HTML tags from string
 * @param value
 * @returns {*}
 */
exports.strippedString = (value) => {
  try {
    return value.replace(/(<([^>]+)>)/gi, '')
  } catch (error) {
    return value;    
  }
}

exports.logtime = (message) => {
  const now = new Date()
  const seconds = Math.floor(now.getTime() / 1000)
  const timestamp = now
    .toISOString()
    .substring(11)
    .replace(/T/, ' ')
    .replace(/\..+/, '')

  console.log(`Seconds:${seconds - 1666736790} Time:${timestamp} |`, message)
}

exports.groupArrayOfObjects = (list, key , type = 'get_object')=>{
  const new_list = list.reduce((rv, x)=>{
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
  if(type == 'get_array'){
    return Object.keys(new_list).map((key) => new_list[key]);
  }
  return new_list;
};

exports.uniqueElements = (list,key = 'id')=>{
  return list.reduce((unique, o) => {
      if(!unique.some(obj => obj[key] === o[key])) {
        unique.push(o);
      }
      return unique;
  },[])
}