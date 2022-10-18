process.on('message', requestData => {
  generateReport(requestData)
})

const { con } = require('../db')
const { worksheet, workbook, createAt, createHeaders } = require('../exceljs')
const { response } = require('../response')
const { getSuboworkspacesIds } = require('../helper/Workspace')
const { getGenericHeaders, getWorkspaceCriteria } = require('../helper/Criterios')
const { pluck } = require('../helper/Helper')
const {
  getUserCriterionValues, loadUsersCriteriaValues, addActiveUsersCondition
} = require('../helper/Usuarios')

// Headers for Excel file

const headers = [
  'Documento (entrenador)',
  'Nombre (entrenador)',
  'Checklist asignados',
  'Checklist realizados',
  'Avance total'
]

async function generateReport ({
  workspaceId, modulos, UsuariosActivos, UsuariosInactivos, start, end
}) {
  // Generate Excel file header

  const headersEstaticos = await getGenericHeaders(workspaceId)
  await createHeaders(headersEstaticos.concat(headers))

  // Load workspace criteria

  const workspaceCriteria = await getWorkspaceCriteria(workspaceId)
  const workspaceCriteriaNames = pluck(workspaceCriteria, 'name')

  // When no modules are provided, get its ids using its parent id

  if (modulos.length === 0) {
    modulos = await getSuboworkspacesIds(workspaceId)
  }

  // Load users from database and generate ids array

  const users = await loadUsersCheckists(modulos, UsuariosActivos, UsuariosInactivos, start, end)
  const usersIds = pluck(users, 'id')

  // Load workspace user criteria

  const usersCriterionValues = await loadUsersCriteriaValues(modulos, usersIds)

  // Add data to Excel rows

  for (const user of users) {
    const cellRow = []

    // Add default values

    cellRow.push(user.name)
    cellRow.push(user.lastname)
    cellRow.push(user.surname)
    cellRow.push(user.document)
    cellRow.push(user.active === 1 ? 'Activo' : 'Inactivo')

    // Add user's criterion values

    const userValues = getUserCriterionValues(user.id, workspaceCriteriaNames, usersCriterionValues)
    userValues.forEach(item => cellRow.push(item.criterion_value || '-'))

    // Add additional values

    const progress = user.completed_checklists > 0
      ? (user.assigned_checklists * 100) / user.completed_checklists
      : 0

    cellRow.push(user.trainer_document)
    cellRow.push(user.trainer_name)
    cellRow.push(user.assigned_checklists)
    cellRow.push(user.completed_checklists)
    cellRow.push(Math.round(progress) + '%')

    worksheet.addRow(cellRow).commit()
  }

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'checklist_general' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

async function loadUsersCheckists (
  modulos, activeUsers, inactiveUsers, start, end
) {
  let query = `
      select
          u.id,
          u.name,
          u.lastname,
          u.surname,
          u.document,
          u.active,
          
          ifnull(trainers.fullname, trainers.name) trainer_name,
          trainers.document trainer_document,
          count(checklist_id) assigned_checklists,
          sum(if(cai.qualification = 'Cumple', 1, 0)) completed_checklists

      from
          checklist_answers ca
              inner join checklists on ca.checklist_id = checklists.id
              inner join users trainers on ca.coach_id = trainers.id
              inner join users u on u.id = ca.student_id
              left join checklist_answers_items cai on ca.id = cai.checklist_answer_id

      where
          u.active = 1 and
          checklists.active = 1 and
          u.subworkspace_id in (${modulos.join()})
  `

  // Add user conditions and group sentence

  query = addActiveUsersCondition(query, activeUsers, inactiveUsers)

  // Add dates conditions

  if (start && end) {
    query += ` and (
      ca.updated_at between '${start} 00:00' and '${end} 23:59'
    )`
  }

  // Add group sentence

  query += ' group by u.id'

  // Execute query

  const [rows] = await con.raw(query)
  return rows
}
