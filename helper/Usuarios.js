const { con } = require('../db')
const moment = require('moment/moment')
const { pluck, logtime } = require('./Helper')

exports.getUsers = async (modulesIds, activeUsers, inactiveUsers) => {
  logtime('method: getUsers')
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

exports.addActiveUsersCondition = (query, activeUsers, inactiveUsers) => {
  if (activeUsers && inactiveUsers) {
    return query
  } else if (activeUsers && !inactiveUsers) {
    return `${query} and u.active = 1`
  } else if (!activeUsers && inactiveUsers) {
    return `${query} and u.active = 0`
  }
}

/**
 * Load users criteria values from selected values
 * @param modules
 * @param userIds
 * @returns {Promise<*>}
 */
exports.loadUsersCriteriaValues = async (modules, userIds = null) => {
  logtime('method: loadUsersCriteriaValues')
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
      c.show_in_reports = 1
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
 * @param usersCriterionValues
 * @returns {*[]}
 */
exports.getUserCriterionValues = (userId, criterionNames, usersCriterionValues) => {
  const result = []
  const found = []

  // Iterate criterion names to find its values
  const userValues = usersCriterionValues.filter(ucv => ucv.user_id === userId)
  criterionNames.forEach(name => {
    userValues.forEach(userCriterionValue => {
      if (userCriterionValue.criterion_name === name) {
        // Get criterion value

        let value
        if (userCriterionValue.value_text) value = userCriterionValue.value_text
        //if (userCriterionValue.value_datetime) value = moment(userCriterionValue.value_datetime).format('DD/MM/YYYY H:mm:ss')
        // if (userCriterionValue.value_date) value = moment(userCriterionValue.value_date).format('DD/MM/YYYY')
        // if (userCriterionValue.value_boolean === 1) value = 'Sí'
        // if (userCriterionValue.value_boolean === 0 && value === '-') value = 'No'
        // if (userCriterionValue.value_decimal !== null) value = userCriterionValue.value_decimal
        // if (userCriterionValue.value_integer !== null) value = userCriterionValue.value_integer

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

/**
 * Load users which have all the provided criterion values ids
 *
 * @param workspaceId
 * @param criterionValuesIds
 * @returns {Promise<*[]>}
 */
exports.loadUsersIdsWithCriterionValues = async (workspaceId, criterionValuesIds) => {
  criterionValuesIds = criterionValuesIds.filter(i => !!i)
  if (criterionValuesIds.length === 0) return []

  const [users] = await con.raw(`
    select 
        u.id,
        count(cvu.criterion_value_id) criterion_count
    from users u
        inner join criterion_value_user cvu on u.id = cvu.user_id
        inner join workspaces w on u.subworkspace_id = w.id
    where
        w.parent_id = :workspaceId and
        cvu.criterion_value_id in (${criterionValuesIds.join()}) 
    group by u.id
    having criterion_count = :criterionCount
  `, { workspaceId, criterionCount: criterionValuesIds.length })

  return pluck(users, 'id')
}
