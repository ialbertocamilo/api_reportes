/**
 * Generate array with values of items' specific property
 * @param collection
 * @param key
 * @returns {*}
 */
const moment = require('moment/moment')
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
exports.uniqueElementsOfArray = (array)=>{
  return array.filter((elemento, indice) => {
    return array.indexOf(elemento) === indice;
  });
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

exports.generatePagination = (total, perPage, page) => {
  if (!page) {
    page = 1
  } else {
    page = +page
  }

  let pages = Math.floor(total / perPage)
  const leftover = total % perPage

  // When there are leftover items,
  // add a new page for them

  if (leftover > 0) {
    pages++
  }

  // When provided page number is higher, fix its
  // value with the page count

  if (page > pages) {
    page = pages
  }

  // Calculate start and end index for items

  const startIndex = (page * perPage) - perPage
  let endIndex = startIndex + perPage

  if (leftover > 0 && page === pages) {
    endIndex = startIndex + leftover
  }

  return {
    total: total,
    pages: pages,
    page: page,
    perPage: perPage,
    startIndex: startIndex > 0 ? startIndex : 0,
    endIndex: endIndex
  }
}

exports.setCustomIndexAtObject = (data, key = 'id') => {
  let StackValues = {};

  for(const value of data) {
    const { [key]:index } = value;
    StackValues[index] = value;
  }

  return StackValues;
}

// solo en formato objeto
exports.groupArrayOfObjects_v2 = (data, key = 'id') => {

  const ResultData = {};

  for(const value of data) {
    const { [key]:index } = value;
    
    if(!ResultData[index]) ResultData[index] = [];
    ResultData[index].push(value);
  }

  return ResultData;
}

exports.formatDatetimeToString = (datetime) => {
  if (isNaN(datetime)) {
    return '-'
  }

  if (datetime === 'Invalid date') {
    return '-'
  }

  return datetime
    ? moment(datetime).format('DD/MM/YYYY H:mm:ss')
    : '-'
}

exports.calculateUserSeniorityRange = (dateString) => {
  let seniorityValue = '-'

  let startDate = moment(dateString, 'YYYY-MM-DD');
  let today = moment();
  let differenceMonths = today.diff(startDate, 'months')
  if (differenceMonths > 12) {
    seniorityValue = 'mas 1 año'
  } else if (differenceMonths >= 6 && differenceMonths <= 12) {
    seniorityValue = '6-12 meses'
  } else if (differenceMonths >= 3 && differenceMonths < 6) {
    seniorityValue = '3-6 meses'
  }

  return seniorityValue
}
