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
  return value.replace(/(<([^>]+)>)/gi, '')
}
