const { con } = require('../db')
const moment = require('moment/moment')

exports.getUsers = async (modulesIds, activeUsers, inactiveUsers) => {

  if (modulesIds && activeUsers && inactiveUsers) {
    return con('users')
      .whereIn('subworkspace_id', modulesIds)
  } else if (modulesIds && activeUsers && !inactiveUsers) {
    return con('users')
      .whereIn('subworkspace_id', modulesIds)
      .andWhere('active', 1)
  } else if (modulesIds && !activeUsers && inactiveUsers) {
    return con('users')
      .whereIn('subworkspace_id', modulesIds)
      .andWhere('active', 0)
  } else if (modulesIds && !activeUsers && !inactiveUsers) {
    return []
  } else if (!modulesIds) {
    return []
  }
}

/**
 * Load users criteria values from selected values
 * @param modules
 * @param userIds
 * @returns {Promise<*>}
 */
exports.loadUsersCriteriaValues = async (modules, userIds = null) => {
  let query = `
    select 
        cvu.user_id, 
        cv.criterion_id,
        c.name criterion_name,
        cv.value_text,
        cv.value_datetime,
        cv.value_date,
        cv.value_boolean,
        cv.value_decimal,
        cv.value_integer
    from
        users u
            inner join criterion_value_user cvu on cvu.user_id = u.id
            inner join criterion_values cv on cv.id = cvu.criterion_value_id
            inner join criteria c on c.id = cv.criterion_id
    where
        -- this line is added to avoid errors with WHERE 
        -- clause when no conditions are provided
        u.id > 0 
    `

  // When module ids array has been provided, add condition to filter them

  if (modules) {
    if (modules.length > 0) {
      query += ` and u.subworkspace_id in (${modules.join()})`
    }
  }

  // When user ids array has been provided, add condition to filter them

  if (userIds) {
    if (userIds.length > 0) {
      query += ` and u.id in (${userIds.join()})`
    }
  }

  // Add sorting order

  query += ' order by cv.id'

  const [rows] = await con.raw(query)
  return rows
}

/**
 * Extract user criterion values according a list of criterion names,
 * if a value for criterion name is not found, add an empty value
 * @param userId
 * @param criterionNames
 * @param userCriterionValues
 * @returns {*[]}
 */
exports.getUserCriterionValues = (userId, criterionNames, userCriterionValues) => {

  const result = []
  const found = []

  // Iterate criterion names to find its values

  criterionNames.forEach(name => {
    userCriterionValues.forEach(userCriterionValue => {
      if (userCriterionValue.criterion_name === name &&
          userCriterionValue.user_id === userId) {
        // Get criterion value

        let value
        if (userCriterionValue.value_text) value = userCriterionValue.value_text
        if (userCriterionValue.value_datetime) value = moment(userCriterionValue.value_datetime).format('DD/MM/YYYY H:mm:ss')
        if (userCriterionValue.value_date) value = moment(userCriterionValue.value_date).format('DD/MM/YYYY')
        if (userCriterionValue.value_boolean === 1) value = 'Sí'
        if (userCriterionValue.value_boolean === 0 && value === '-') value = 'No'
        if (userCriterionValue.value_decimal !== null) value = userCriterionValue.value_decimal
        if (userCriterionValue.value_integer !== null) value = userCriterionValue.value_integer

        // Since value for name was found, added to found array

        found.push(name)

        // Add name and value for results collection

        result.push({
          criterion_name: name,
          criterion_value: value
        })
      }
    })

    // When value for name was not found, add an empty value

    if (!found.includes(name)) {
      result.push({
        criterion_name: name,
        criterion_value: null
      })
    }
  })

  return result
}

/**
 * Find user using its document number
 * @param document
 * @returns {Promise<ResolveResult<TResult>[0]>}
 */
exports.findUserByDocument = async (document) => {
  return await con('users')
    .select('*')
    .where('document', `${document}`)
    .then(([row]) => row)
}
