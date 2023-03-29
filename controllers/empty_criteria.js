process.on('message', (requestData) => {
  executeReport(requestData)
})

const { createHeaders, worksheet, workbook, createAt } = require('../exceljs')
const { con } = require('../db')
const { loadWorkspaceSegmentationCriteria, getWorkspaceCriteria } = require('../helper/Criterios')
const { pluck, logtime } = require('../helper/Helper')
const { response } = require('../response')
const { getUserCriterionValues2, getUserCriterionValues,
  loadUsersCriteriaValues
} = require('../helper/Usuarios')
const moment = require('moment/moment')

const defaultHeaders = [
  'NOMBRE COMPLETO',
  'NOMBRE',
  'APELLIDO PATERNO',
  'APELLIDO MATERNO',
  'DOCUMENTO',
  'NÚMERO DE TELÉFONO',
  'NÚMERO DE PERSONA COLABORADOR',
  'ESTADO(USUARIO)',
  'EMAIL',
  'ULTIMA SESIÓN'
]
async function executeReport ({ workspaceId, modules, selectedCriteria }) {
  // When criteria ids are not provided, load all
  // workspace criteria which is used in segmentation

  let segmentationCriteriaIds = []
  if (selectedCriteria.length) {
    segmentationCriteriaIds = selectedCriteria
  } else {
    const segmentationCriteria = await loadWorkspaceSegmentationCriteria(workspaceId)
    segmentationCriteriaIds = pluck(segmentationCriteria, 'id')
  }

  // Find those users who have no complete set of criteria

  const users = await findUsersWithIncompleteCriteriaValues(modules, segmentationCriteriaIds)
  const usersIds = pluck(users, 'user_id')

  // Generate headers adding workspace criteria to default header columns
  const workspaceCriteria = await getWorkspaceCriteria(workspaceId)
  workspaceCriteria.forEach(el => defaultHeaders.push(el.name))
  const workspaceCriteriaNames = pluck(workspaceCriteria, 'name')
  const usersCriteriaValues = await loadUsersCriteriaValues(modules, usersIds)
  await createHeaders(defaultHeaders)

  // Generate rows for Excel file
  logtime('Start file generation')
  for (const user of users) {
    const cellRow = []
    const lastLogin = moment(user.last_login).format('DD/MM/YYYY H:mm:ss')
    const fullname = [user.name, user.lastname, user.surname]
      .filter(e => Boolean(e))
      .join(' ');
    cellRow.push(fullname)
    cellRow.push(user.name)
    cellRow.push(user.lastname)
    cellRow.push(user.surname)
    cellRow.push(user.document)
    cellRow.push(user.phone_number)
    cellRow.push(user.person_number)
    cellRow.push(user.active === 1 ? 'Activo' : 'Inactivo')
    cellRow.push(user.email)
    cellRow.push(lastLogin !== 'Invalid date' ? lastLogin : '-')

    // Add user's criterion values

    const userValues = getUserCriterionValues(user.id, workspaceCriteriaNames, usersCriteriaValues)
    userValues.forEach(item => cellRow.push(item.criterion_value || '-'))

    // Add row to sheet

    worksheet.addRow(cellRow).commit()
  }

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: '-' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

/**
 * Find those users who have no complete set of criteria
 */
async function findUsersWithIncompleteCriteriaValues (subworkspacesIds, criteriaIds) {

  const query = `
    select
        user_id,
        name,
        lastname,
        username,
        surname,
        fullname,
        document,
        email,
        phone_number,
        person_number,
        active,
        last_login,
        sum(criteria_count) total_criteria_count
    from (
        select
            u.id user_id,
            u.name,
            u.lastname,
            u.surname,
            u.username,            
            concat(u.name, ' ', coalesce(u.lastname, '')) fullname,
            u.document,
            u.email,
            u.phone_number,
            u.person_number,
            u.active,
            u.last_login,
            -- when a user has the same criterion with
            -- different values, only counts as one
            if (sum(if(cv.criterion_id in (${criteriaIds.join()}), 1, 0)) >= 1, 1, 0) criteria_count
      
        from
            users u
            join criterion_value_user cvu on u.id = cvu.user_id
            join criterion_values cv on cv.id = cvu.criterion_value_id
        where
            u.active = 1
            and cv.active = 1
            and u.deleted_at is null
            and cv.deleted_at is null
            and u.subworkspace_id in (${subworkspacesIds.join()})
        group by
          u.id, cv.criterion_id
    ) user_criteria_count
    group by user_id
    having total_criteria_count < :criteriaCount
  `

  const [rows] = await con.raw(query, { criteriaCount: criteriaIds.length })
  return rows
}

/**
 * Load array of criteria names
 *
 * @param criteriaIds
 * @returns {Promise<*>}
 */
async function getCriteriaNames (criteriaIds) {
  const query = `select * from criteria where id in (${criteriaIds.join()})`
  const [rows] = await con.raw(query, { criteriaCount: criteriaIds.length })

  return pluck(rows, 'name')
}
