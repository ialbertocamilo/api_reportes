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