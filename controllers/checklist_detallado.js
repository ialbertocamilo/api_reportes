process.on('message', requestData => {
  generateReport(requestData)
})

const { con } = require('../db')
const { worksheet, workbook, createAt, createHeaders } = require('../exceljs')
const { response } = require('../response')
const { getSuboworkspacesIds } = require('../helper/Workspace')
const { getGenericHeaders, getWorkspaceCriteria } = require('../helper/Criterios')
const { pluck, pluckUnique } = require('../helper/Helper')
const {
  getUserCriterionValues, loadUsersCriteriaValues, addActiveUsersCondition
} = require('../helper/Usuarios')

// Headers for Excel file

const headers = [
  'Documento (entrenador)',
  'Nombre (entrenador)',
  'Escuela',
  'Curso',
  'Checklist',
  'Avance de Checklist',
 // 'Estado de entrenador de usuario'
]

async function generateReport ({
  workspaceId, checklist, curso, escuela, modulos,
  UsuariosActivos, UsuariosInactivos, start, end
}) {
  // Generate Excel file header

  const headersEstaticos = await getGenericHeaders(workspaceId)

  // Load workspace criteria

  const workspaceCriteria = await getWorkspaceCriteria(workspaceId)
  const workspaceCriteriaNames = pluck(workspaceCriteria, 'name')

  // When no modules are provided, get its ids using its parent id

  if (modulos.length === 0) {
    modulos = await getSuboworkspacesIds(workspaceId)
  }

  // Load users from database and generate ids array

  const users = await loadUsersCheckists(
    modulos, checklist, curso, escuela, UsuariosActivos, UsuariosInactivos, start, end
  )
  const usersIds = pluck(users, 'id')

  // Load workspace user criteria

  const usersCriterionValues = await loadUsersCriteriaValues(modulos, usersIds)

  // Load checklist activities

  const checklistActivities = await loadChecklistActivities(checklist)
  const activitiesHeaders = pluckUnique(checklistActivities, 'activity')
  activitiesHeaders.forEach(h => headers.push(h))

  // Add headers

  await createHeaders(headersEstaticos.concat(headers))

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
    cellRow.push(user.school_name)
    cellRow.push(user.course_name)
    cellRow.push(user.checklists_title)
    cellRow.push(Math.round(progress) + '%')

    // Add activities values
    const userActivitiesValues = filterUserActivities(activitiesHeaders, checklistActivities, user.id)
    userActivitiesValues.forEach(values => {
      cellRow.push(values)
    })

    worksheet.addRow(cellRow).commit()
  }

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'checklist_detallado' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

async function loadUsersCheckists (
  modulos, checklistId, courseId, schoolId, activeUsers, inactiveUsers, start, end
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
          s.name school_name,
          c.name course_name,
          checklists.title checklists_title,
          count(checklist_id) assigned_checklists,
          sum(if(cai.qualification = 'Cumple', 1, 0)) completed_checklists
          
      from
          checklist_answers ca
              inner join checklists on ca.checklist_id = checklists.id
              inner join users trainers on ca.coach_id = trainers.id
              inner join users u on u.id = ca.student_id
              inner join schools s on s.id = ca.school_id
              inner join courses c on c.id = ca.course_id
              left join checklist_answers_items cai on ca.id = cai.checklist_answer_id
      
      where
          u.active = 1 and
          checklists.active = 1 and
          u.subworkspace_id in (${modulos.join()}) and
          ca.school_id = :schoolId and
          ca.course_id = :courseId and
          ca.checklist_id = :checklistId
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

  query += ' group by s.id, c.id, u.id'

  // Execute query

  const [rows] = await con.raw(query, { checklistId, courseId, schoolId })
  return rows
}

/**
 * Load checklist's activities
 * @param checklistId
 * @returns {Promise<*>}
 */
async function loadChecklistActivities (checklistId) {

  const query = `
    select
      ci.activity,
      cai.qualification,
      ca.student_id
     from
        checklist_items ci
            inner join checklist_answers_items cai on ci.id = cai.checklist_item_id 
            inner join checklist_answers ca on ca.checklist_id = cai.checklist_answer_id
     where 
       ci.checklist_id = :checklistId and
       active = 1
    
     group by
        ci.id, ca.student_id
  `

  // Execute query

  const [rows] = await con.raw(query, { checklistId })
  return rows
}

function filterUserActivities (activitiesHeaders, checklistActivities, userId) {
  const values = []

  activitiesHeaders.forEach(h => {
    checklistActivities.forEach(ca => {
      if (ca.student_id === userId && h === ca.activity) {
        values.push(ca.qualification === 'Cumple' ? 'Sí' : '-')
      }
    })
  })

  return values
}