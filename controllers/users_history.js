'use strict'
process.on('message', (requestData) => {
  UsersHistory(requestData)
})

require('../error')
const _ = require('lodash')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { response } = require('../response')
const { getGenericHeaders, getWorkspaceCriteria } = require('../helper/Criterios')
const moment = require('moment')
const { con } = require('../db')
const { pluck, logtime, logDurationInSeconds, getDurationInSeconds } = require('../helper/Helper')
const { loadUsersCriteriaValues, getUserCriterionValues, addActiveUsersCondition,
  loadUsersBySubWorspaceIds, subworkspacesUsersids
} = require('../helper/Usuarios')
const {
  loadTopicsStatuses, getTopicStatusId, getEvaluationTypeName,

  loadEvaluationTypes, getCourseStatusName, getTopicStatusName,
  loadCoursesStatuses
} = require('../helper/CoursesTopicsHelper')
const { getSuboworkspacesIds } = require('../helper/Workspace')

moment.locale('es')

let headers = [
  'ULTIMA SESIÓN',
  'MÓDULOS',
  'ESCUELAS',
  'CURSO',
  'RESULTADO CURSO',
  'REINICIOS CURSO',
  'TIPO CURSO',
  'TEMA',
  'RESULTADO TEMA',
  'ESTADO TEMA',
  'NOTA TEMA',
  'REINICIOS TEMA',
  'INTENTOS PRUEBA',
  'EVALUABLE TEMA',
  'TIPO TEMA',
  'VISITAS TEMA',
  'PJE. MINIMO APROBATORIO',
  'ULTIMA EVALUACIÓN'
]

async function UsersHistory ({
  workspaceId, modules, end, start
}) {
  // Generate Excel file header

  const headersEstaticos = [
    'Nombre', 'Apellido Paterno', 'Apellido Materno',
    'Documento', 'Estado (Usuario)','email'
  ]
  await createHeaders(headersEstaticos.concat(headers))

  // Start benchmark

  logtime(`----> START Users history: ${workspaceId}`)
  const startTime = new Date();

  // When no modules are provided, get its ids using its parent id

  if (modules.length === 0) {
    modules = await getSuboworkspacesIds(workspaceId)
  }

  // Load user topic statuses

  const userTopicsStatuses = await loadTopicsStatuses()

  // Load user course statuses

  const userCourseStatuses = await loadCoursesStatuses()

  // Load evaluation types

  const evaluation_types = await loadEvaluationTypes()
  // Load users from database and generate ids array

  const users = await loadUsersWithCoursesAndTopics(
    workspaceId, modules, start, end
  )

  // Add users to Excel rows

  for (const user of users) {
    const lastLogin = moment(user.last_login).format('DD/MM/YYYY H:mm:ss')

    const cellRow = []

    cellRow.push(user.name)
    cellRow.push(user.lastname)
    cellRow.push(user.surname)
    cellRow.push(user.document)
    cellRow.push(user.active === 1 ? 'Activo' : 'Inactivo')
    cellRow.push(user.email)

    // Add user's criterion values
    // const userValues = getUserCriterionValues(user.id, workspaceCriteriaNames, usersCriterionValues)
    // userValues.forEach(item => cellRow.push(item.criterion_value || '-'))

    // Add topic values

    cellRow.push(lastLogin !== 'Invalid date' ? lastLogin : '-')
    cellRow.push(user.module)
    cellRow.push(user.school_name)
    cellRow.push(user.course_name)

    cellRow.push(getCourseStatusName(userCourseStatuses, user.course_status_id))

    cellRow.push(user.course_restarts || '-')
    cellRow.push(user.course_type || '-')
    cellRow.push(user.topic_name)

    cellRow.push(getTopicStatusName(userTopicsStatuses, user.topic_status_id))
    cellRow.push(user.topic_active === 1 ? 'ACTIVO' : 'INACTIVO')

    cellRow.push(user.topic_grade || '-')
    cellRow.push(user.topic_restarts || '-')
    cellRow.push(user.topic_attempts || '-')
    cellRow.push(user.topic_assessable ? 'Sí' : 'No')

    cellRow.push(getEvaluationTypeName(evaluation_types, user.type_evaluation_id))

    cellRow.push(user.topic_views || '-')
    cellRow.push(user.minimum_grade || '-')
    cellRow.push(user.topic_last_time_evaluated_at ? moment(user.topic_last_time_evaluated_at).format('DD/MM/YYYY H:mm:ss') : '-')

    // Add row to sheet

    worksheet.addRow(cellRow).commit()
  }

  // Finish benchmark

  logtime(
    `----> END Users history: ${workspaceId} - ` +
    getDurationInSeconds(startTime, new Date())
  )

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: '-' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

/**
 * Load users with its courses and schools
 */
async function loadUsersWithCoursesAndTopics (
  workspaceId, modules, start, end
) {

  const subworkspaceUsersIds = await subworkspacesUsersids(modules)

  let query = `
      select
          u.name,
          u.lastname,
          u.surname,
          u.document,
          u.active,
          u.email,
          
          group_concat(distinct(s.name) separator ', ') school_name,
          tx.name as course_type,
          group_concat(distinct(old_subworkspace.name) separator ', ') module,
          c.name course_name,
          c.active course_active,
          sc.status_id course_status_id,
          sc.views course_views,
          sc.passed course_passed,
          sc.grade_average,
          sc.restarts course_restarts,
          t.name topic_name,
          t.active topic_active,
          t.assessable topic_assessable,
          t.type_evaluation_id,
          st.grade topic_grade,
          st.attempts topic_attempts,
          st.restarts topic_restarts,
          st.views topic_views,
          st.status_id topic_status_id,
          st.last_time_evaluated_at topic_last_time_evaluated_at,
          json_extract(c.mod_evaluaciones, '$.nota_aprobatoria') minimum_grade
      from users u
               inner join workspaces w on u.subworkspace_id = w.id
               inner join summary_topics st on u.id = st.user_id
               inner join topics t on t.id = st.topic_id
               inner join summary_courses sc on u.id = sc.user_id and sc.course_id = t.course_id
               inner join courses c on t.course_id = c.id
               inner join taxonomies tx on tx.id = c.type_id
               inner join course_school cs on c.id = cs.course_id
               inner join schools s on cs.school_id = s.id
               left join school_subworkspace ss on s.id = ss.school_id
               left join workspaces old_subworkspace on old_subworkspace.id = ss.subworkspace_id
  `

  query += `where sc.user_id in (${subworkspaceUsersIds.join(',')})`

  // Add type_course and dates at ('created_at')

  if(start) query += ` and date(st.updated_at) >= '${start}'`
  if(end) query += ` and date(st.updated_at) <= '${end}'`

  // Add user conditions and group sentence

  query += ' group by u.id, st.topic_id'

  // Execute query

  const [rows] = await con.raw(query)

  return rows
}
