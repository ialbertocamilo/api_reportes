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
 * Remove HTML tags from string
 * @param value
 * @returns {*}
 */
exports.strippedString = (value) => {
  return value.replace(/(<([^>]+)>)/gi, '')
}
