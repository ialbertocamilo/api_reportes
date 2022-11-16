'use strict'
process.on('message', (requestData) => {
  generateSegmentationReport(requestData)
})

require('../error')
const moment = require('moment')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { response } = require('../response')
const {  loadUsersSegmented, loadCourses } = require('../helper/SegmentationHelper')
const { pluck } = require('../helper/Helper')
const { getSuboworkspacesIds } = require('../helper/Workspace')
const { con } = require('../db')

// Headers for Excel file

const headers = [
    'Nombre','Apellido Paterno', 'Apellido Materno',
    'Documento', 'Estado (Usuario)','EMAIL',
    'ESCUELA',
    'CURSO',
    'RESULTADO CURSO',
    'AVANCE (%)'
]

async function generateSegmentationReport ({
  cursos,
  escuelas
}) {
  // Generate Excel file header
  await createHeaders(headers)
  //Load Courses
  const courses = (cursos.length > 0)  ? cursos : await loadCourses(escuelas); 
  for (const course of courses) {
    const users = await loadUsersSegmented(course.course_id)
    for (const user of users) {
        const cellRow = []
        cellRow.push(user.name)
        cellRow.push(user.lastname)
        cellRow.push(user.surname)
        cellRow.push(user.document)
        cellRow.push(user.active === 1 ? 'Activo' : 'Inactivo')
        cellRow.push(user.email)
        worksheet.addRow(cellRow).commit()
    }
  }

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'ConsolidadoCursos' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

/**
 * Load users with its courses and schools
 * @param workspaceId
 * @param userCourseStatuses
 * @param {array} modulesIds
 * @param {boolean} activeUsers include active users
 * @param {boolean} inactiveUsers include inactive users
 * @param {array} schooldIds
 * @param {array} coursesIds
 * @param {boolean} aprobados include aprobados
 * @param {boolean} desaprobados include desaprobados
 * @param {boolean} desarrollo include desarrollo
 * @param {boolean} encuestasPendientes include encuestas pendientes
 * @returns {Promise<*[]|*>}
 */
async function loadUsersWithCourses (
  workspaceId, userCourseStatuses,
  modulesIds, activeUsers, inactiveUsers, schooldIds, coursesIds,
  aprobados, desaprobados, desarrollo, encuestasPendientes
) {
  // Base query

  let query = `
    select 
        u.*, 
        group_concat(distinct(s.name) separator ', ') school_name,
        c.name course_name,
        c.active course_active,
        sc.views course_views,
        sc.passed course_passed,
        sc.grade_average, 
        sc.status_id course_status_id,
        sc.restarts course_restarts,
        sc.assigned,
        sc.completed,
        sc.reviewed,
        sc.advanced_percentage
    from users u
        inner join summary_courses sc on u.id = sc.user_id
        inner join courses c on sc.course_id = c.id
        inner join course_school cs on c.id = cs.course_id
        inner join schools s on cs.school_id = s.id 
        inner join school_workspace sw on s.id = sw.school_id
    where 
      u.subworkspace_id in (${modulesIds.join()}) and
      sw.workspace_id = ${workspaceId}
  `

  // Add condition for schools ids

  if (schooldIds.length > 0) {
    query += ` and s.id in (${schooldIds.join()})`
  }

  // Add condition for courses ids

  if (coursesIds.length > 0) {
    query += ` and c.id in (${coursesIds.join()})`
  }

  // Get statuses ids

  const aprobadoId = getCourseStatusId(userCourseStatuses, 'aprobado')
  const desaprobadoId = getCourseStatusId(userCourseStatuses, 'desaprobado')
  const desarrolloId = getCourseStatusId(userCourseStatuses, 'desarrollo')
  const encuestaPendienteId = getCourseStatusId(userCourseStatuses, 'enc_pend')

  // Add condition for statuses

  if (aprobados || desaprobados || desarrollo || encuestasPendientes) {
    const statusConditions = []

    if (aprobados) { statusConditions.push(`sc.status_id = ${aprobadoId}`) }
    if (desaprobados) { statusConditions.push(`sc.status_id = ${desaprobadoId}`) }
    if (desarrollo) { statusConditions.push(`sc.status_id = ${desarrolloId}`) }
    if (encuestasPendientes) { statusConditions.push(`sc.status_id = ${encuestaPendienteId}`) }

    query += ' and (' + statusConditions.join(' or ') + ')'
  }

  // Add user conditions and group sentence

  query = addActiveUsersCondition(query, activeUsers, inactiveUsers)
  query += ' group by u.id, c.id, sc.id'

  // Execute query

  const [rows] = await con.raw(query)
  return rows
}
