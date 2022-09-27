'use strict'
process.on('message', req => {
  exportarEvaluacionesAbiertas(req)
})

require('../error')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { con } = require('../db')
const { response } = require('../response')
const { getGenericHeaders, getWorkspaceCriteria } = require('../helper/Criterios')
const { getUserCriterionValues, loadUsersCriteriaValues,
  addActiveUsersCondition
} = require('../helper/Usuarios')
const moment = require('moment')
const { pluck } = require('../helper/Helper')
const { getSuboworkspacesIds } = require('../helper/Workspace')

const headers = [
  'Última sesión',
  'Escuela',
  'Curso',
  'Tema',
  'Pregunta',
  'Respuesta'
]

async function exportarEvaluacionesAbiertas ({
  workspaceId, modulos, UsuariosActivos, UsuariosInactivos, escuelas, cursos, temas, start, end
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

  // Load users with answers

  const users = await loadUsersQuestions(
    workspaceId, modulos, UsuariosActivos, UsuariosInactivos,
    escuelas, cursos, temas, start, end
  )
  const usersIds = pluck(users, 'id')

  // Load workspace user criteria

  const usersCriterionValues = await loadUsersCriteriaValues(modulos, usersIds)

  const questions = await loadQuestions(modulos)

  // Add users to Excel rows

  for (const user of users) {
    const lastLogin = moment(user.last_login).format('DD/MM/YYYY H:mm:ss')

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
    // Add report values

    cellRow.push(lastLogin !== 'Invalid date' ? lastLogin : '-')
    cellRow.push(user.school_name || '-')
    cellRow.push(user.course_name || '-')
    cellRow.push(user.topic_name || '-')

    try {
      const answers = JSON.parse(user.answers)
      if (answers) {
        answers.forEach((answer, index) => {
          if (answer) {
            const question = questions.find(q => q.id === answer.preg_id)
            cellRow.push(question ? strippedString(question.pregunta) : '-')
            cellRow.push(answer ? strippedString(answer.opc) : '-')
          }
        })
      }
    } catch (ex) {}

    worksheet.addRow(cellRow).commit()
  }

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'EvaluacionAbierta' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

const strippedString = (value) => {
  return value.replace(/(<([^>]+)>)/gi, '')
}

async function loadUsersQuestions (
  workspaceId, modulesIds, activeUsers, inactiveUsers,
  schoolsIds, coursesIds, topicsIds, start, end
) {

  // Load evaluation types

  const questionTypes = await con('taxonomies')
    .where('group', 'question')
    .where('code', 'written-answer')
  const type = questionTypes[0]

  let query = `
    select 
        u.*, 
        group_concat(distinct(s.name) separator ', ') school_name,
        c.name course_name,
        t.name topic_name,
        q.pregunta,
        q.id pregunta_id,
        st.answers
            
      from users u
        inner join summary_topics st on u.id = st.user_id
        inner join topics t on t.id = st.topic_id
        inner join summary_courses sc on u.id = sc.user_id
        inner join courses c on t.course_id = c.id
        inner join course_school cs on c.id = cs.course_id
        inner join schools s on cs.school_id = s.id 
        inner join school_workspace sw on s.id = sw.school_id
        inner join questions q on t.id = q.topic_id
      
      where 
        u.subworkspace_id in (${modulesIds.join()}) and
        sw.workspace_id = ${workspaceId} and
        q.type_id = ${type.id}
  `

  // Add condition for schools ids

  if (schoolsIds.length > 0) {
    query += ` and s.id in (${schoolsIds.join()})`
  }

  // Add condition for courses ids

  if (coursesIds.length > 0) {
    query += ` and c.id in (${coursesIds.join()})`
  }

  // Add condition for topics ids

  if (topicsIds.length > 0) {
    query += ` and t.id in (${topicsIds.join()})`
  }

  if (start && end) {
    query += ` and (
      st.updated_at between '${start} 00:00' and '${end} 23:59'
    )`
  }

  // Add user conditions and group sentence

  query = addActiveUsersCondition(query, activeUsers, inactiveUsers)
  query += ' group by u.id, t.id, st.id'

  // Execute query
console.log(query)
  const [rows] = await con.raw(query)
  return rows
}

/**
 * Load questions with written answers
 * @param modulesIds
 * @returns {Promise<*>}
 */
async function loadQuestions (modulesIds) {

  // Load evaluation types

  const questionTypes = await con('taxonomies')
    .where('group', 'question')
    .where('code', 'written-answer')
  const type = questionTypes[0]

  const query = `
    select *
    from
        questions
    where
        questions.type_id = :typeId
      and
        topic_id in (
            select t.id 
            from topics t 
                inner join summary_topics st on st.topic_id = t.id
                inner join users u on st.user_id = u.id
            where
                u.subworkspace_id in (${modulesIds.join()})
            group by t.id
        )
  `

  const [rows] = await con.raw(query, { typeId: type.id })
  return rows
}
