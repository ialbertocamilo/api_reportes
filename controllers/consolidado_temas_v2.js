'use strict'
process.on('message', (requestData) => {
  exportarUsuariosDW(requestData)
})

require('../error')
const _ = require('lodash')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { response } = require('../response')
const { getHeadersEstaticos, getWorkspaceCriteria } = require('../helper/Criterios')
const moment = require('moment')
const { con } = require('../db')
const { pluck } = require('../helper/Helper')
const { loadUsersCriteriaValues, getUserCriterionValues } = require('../helper/Usuarios')
const {
  loadTopicsStatuses, getTopicStatusId, getEvaluationTypeName,
  loadEvaluationTypes
} = require('../helper/CoursesTopicsHelper')
const { getSuboworkspacesIds } = require('../helper/Workspace')

moment.locale('es')

let headers = [
  'ULTIMA SESIÓN',
  'ESCUELA',
  'CURSO',
  'RESULTADO CURSO',
  'REINICIOS CURSO',
  'TEMA',
  'RESULTADO TEMA',
  'ESTADO TEMA',
  'NOTA TEMA',
  'REINICOS TEMA',
  'INTENTOS PRUEBA',
  'EVALUABLE TEMA',
  'TIPO TEMA',
  'VISITAS TEMA',
  'PJE. MINIMO APROBATORIO',
  'ULTIMA EVALUACIÓN'
]

async function exportarUsuariosDW ({
  workspaceId,
  modulos, UsuariosActivos, UsuariosInactivos, escuelas,
  cursos, temas, revisados, aprobados, desaprobados, realizados, porIniciar,
  temasActivos, temasInactivos, end, start, validador
}) {
  // Generate Excel file header

  const headersEstaticos = await getHeadersEstaticos(workspaceId)
  await createHeaders(headersEstaticos.concat(headers))

  if (validador) {
    headers = headers.concat([
      'VALIDADOR DE INTENTOS REINICIOS',
      'VALIDADOR PUNTAJE'
    ])
  }

  // Load workspace criteria

  const workspaceCriteria = await getWorkspaceCriteria(workspaceId)
  const workspaceCriteriaNames = pluck(workspaceCriteria, 'name')

  // When no modules are provided, get its ids using its parent id

  if (modulos.length === 0) {
    modulos = await getSuboworkspacesIds(workspaceId)
  }

  // Load user course statuses

  const topicsStatuses = await loadTopicsStatuses()

  // Load evaluation types

  const evaluationTypes = await loadEvaluationTypes()

  // Load users from database and generate ids array

  const users = await loadUsersWithCoursesAndTopics(
    workspaceId, topicsStatuses,
    modulos, UsuariosActivos, UsuariosInactivos, escuelas, cursos, temas,
    revisados, aprobados, desaprobados, realizados, porIniciar,
    temasActivos, temasInactivos, start, end
  )
  const usersIds = pluck(users, 'id')

  // Load workspace user criteria

  const usersCriterionValues = await loadUsersCriteriaValues(modulos, usersIds)

  // Add users to Excel rows

  for (const user of users) {
    const lastLogin = moment(user.last_login).format('DD/MM/YYYY H:mm:ss')

    const cellRow = []

    cellRow.push(user.subworkspace_name)
    cellRow.push(user.name)
    cellRow.push(user.lastname)
    cellRow.push(user.surname)
    cellRow.push(user.document)
    cellRow.push(user.email || 'Email no registrado')
    cellRow.push(user.active === 1 ? 'Activo' : 'Inactivo')

    // Add user's criterion values

    const userValues = getUserCriterionValues(user.id, workspaceCriteriaNames, usersCriterionValues)
    userValues.forEach(item => cellRow.push(item.criterion_value || '-'))

    // Add topic values

    cellRow.push(lastLogin !== 'Invalid date' ? lastLogin : '-')

    cellRow.push(user.school_name)
    cellRow.push(user.course_name)

    cellRow.push('')// resultadoCurso)

    cellRow.push(user.course_restarts || '-')
    cellRow.push(user.topic_name)

    cellRow.push('')// resultadoTema)
    cellRow.push(user.topic_active === 1 ? 'ACTIVO' : 'INACTIVO')

    cellRow.push(user.topic_grade || '-')
    cellRow.push(user.topic_restarts || '-')
    cellRow.push(user.topic_attempts || '-')
    cellRow.push(user.topic_assessable ? 'Sí' : 'No')

    cellRow.push(getEvaluationTypeName(evaluationTypes, user.type_evaluation_id))

    cellRow.push(user.topic_views || '-')
    cellRow.push('') // NotaMinima.value || '-')
    cellRow.push(user.topic_last_time_evaluated_at ? moment(user.topic_last_time_evaluated_at).format('L') : '-')

    worksheet.addRow(cellRow).commit()
  }

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'ConsolidadoTemas' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

/**
 * Load users with its courses and schools
 * @param workspaceId
 * @param userTopicsStatuses
 * @param {array} modulesIds
 * @param {boolean} activeUsers include active users
 * @param {boolean} inactiveUsers include inactive users
 * @param {array} schooldIds
 * @param {array} coursesIds
 * @param topicsIds
 * @param {boolean} revisados include revisados
 * @param {boolean} aprobados include aprobados
 * @param {boolean} desaprobados include desaprobados
 * @param {boolean} realizados include realizados
 * @param {boolean} porIniciar include encuestas pendientes
 * @param activeTopics
 * @param inactiveTopics
 * @param start
 * @param end
 * @returns {Promise<*[]|*>}
 */
async function loadUsersWithCoursesAndTopics (
  workspaceId, userTopicsStatuses,
  modulesIds, activeUsers, inactiveUsers, schooldIds, coursesIds, topicsIds,
  revisados, aprobados, desaprobados, realizados, porIniciar,
  activeTopics, inactiveTopics, start, end
) {
  // Base query

  let query = `
    select 
        u.*, 
        w.name subworkspace_name,
        group_concat(s.name separator ', ') school_name,
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
        st.last_time_evaluated_at topic_last_time_evaluated_at
    from users u
        inner join workspaces w on u.subworkspace_id = w.id
        inner join summary_topics st on u.id = st.user_id
        inner join topics t on t.id = st.topic_id
        inner join summary_courses sc on u.id = sc.user_id
        inner join courses c on sc.course_id = c.id
        inner join course_school cs on c.id = cs.course_id
        inner join schools s on cs.school_id = s.id
        inner join school_workspace sw on s.id = sw.school_id
    where 
      u.subworkspace_id in (${modulesIds.join()}) and
      sw.workspace_id = ${workspaceId}
    group by
        u.id, t.id, st.id
  `

  // Add condition for schools ids

  if (schooldIds.length > 0) {
    query += ` and s.id in (${schooldIds.join()})`
  }

  // Add condition for courses ids

  if (coursesIds.length > 0) {
    query += ` and c.id in (${coursesIds.join()})`
  }

  // Add condition for topics ids

  if (topicsIds.length > 0) {
    query += ` and t.id in (${topicsIds.join()})`
  }

  // Add condition to allow active topics only

  if (activeTopics && !inactiveTopics) {
    query += ' and t.active = 1'
  }

  // Add condition to allow inactive topics only

  if (!activeTopics && inactiveTopics) {
    query += ' and t.active = 0'
  }

  // Get statuses ids

  const revisadoId = getTopicStatusId(userTopicsStatuses, 'revisado')
  const aprobadoId = getTopicStatusId(userTopicsStatuses, 'aprobado')
  const desaprobadoId = getTopicStatusId(userTopicsStatuses, 'desaprobado')
  const realizadoId = getTopicStatusId(userTopicsStatuses, 'realizado')
  const porIniciarId = getTopicStatusId(userTopicsStatuses, 'por-iniciar')

  // Add condition for statuses

  if (revisados || aprobados || desaprobados || realizados || porIniciar) {
    const statusConditions = []

    if (revisados) { statusConditions.push(`st.status_id = ${revisadoId}`) }
    if (aprobados) { statusConditions.push(`st.status_id = ${aprobadoId}`) }
    if (desaprobados) { statusConditions.push(`st.status_id = ${desaprobadoId}`) }
    if (realizados) { statusConditions.push(`st.status_id = ${realizadoId}`) }
    if (porIniciar) { statusConditions.push(`st.status_id = ${porIniciarId}`) }

    query += ' and (' + statusConditions.join(' or ') + ')'
  }

  // Execute query

  if (modulesIds && activeUsers && inactiveUsers) {
    const [rows] = await con.raw(query)
    return rows
  } else if (modulesIds && activeUsers && !inactiveUsers) {
    const [rows] = await con.raw(`${query} and u.active = 1`)
    return rows
  } else if (modulesIds && !activeUsers && inactiveUsers) {
    const [rows] = await con.raw(`${query} and u.active = 0`)
    return rows
  } else if (modulesIds && !activeUsers && !inactiveUsers) {
    return []
  } else if (!modulesIds) {
    return []
  }
}
