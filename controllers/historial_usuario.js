process.on('message', requestData => {
  historialUsuario(requestData)
})

require('../error')
const moment = require('moment')
moment.locale('es')
const { con } = require('../db')
const { response } = require('../response')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { findUserByDocument } = require('../helper/Usuarios')
const { getCourseStatusName, loadCoursesStatuses } = require('../helper/CoursesTopicsHelper')
const { generatePagination, pluck } = require('../helper/Helper')

async function historialUsuario ({ document, type, page, schoolId, search, workspaceId }) {
  // Load user from database

  const user = await findUserByDocument(document)

  // When there is no user with provided document,
  // stop execution and return response

  if (!user || !document) {
    process.send({ alert: 'Usuario no encontrado, verifica el documento' })
    process.exit()
  }

  // Load user topic statuses

  const userCoursesStatuses = await loadCoursesStatuses()

  // Load user's history from database

  let userHistory = []
  let pagination
  if (type === 'paginated') {
    // Get only allowed statuses ids
    const allowedStatuses = userCoursesStatuses.filter(
      s => ['aprobado'].includes(s.code)
    )
    const allowStatusesIds = pluck(allowedStatuses, 'id')

    // Calaculate query records count

    const countQuery = `select count(*) total from (${generateQuery(null, schoolId, search, allowStatusesIds, workspaceId)}) u`
    const [count] = await con.raw(countQuery,
      { userId: user.id }
    )

    // Fetch paginated records

    const total = count[0]['total'] || 0
    pagination = generatePagination(total, 16, page)

    const [rows] = await con.raw(generateQuery(pagination, schoolId, search, allowStatusesIds, workspaceId),
      { userId: user.id }
    )

    userHistory = rows
  } else {
    const [rows] = await con.raw(generateQuery(),
      { userId: user.id }
    )
    userHistory = rows
  }

  if (!userHistory.length) {
    process.send({ alert: `El usuario con el documento ${document} no tiene evaluaciones desarrolladas` })
    process.exit()
  }

  // Generate results

  let courseResults = []
  for (const user of userHistory) {
    const courseObj = {}

    courseObj.schools_names = user.schools_names
    courseObj.course_name = user.course_name
    courseObj.grade = user.course_grade || '-'
    courseObj.course_status = getCourseStatusName(userCoursesStatuses, user.course_status_id)

    courseResults.push(courseObj)
  }

  // Paginated data is for app, so group courses by workspace
  if (type === 'paginated') {
    const groups = { }
    courseResults.forEach(item => {
      const list = groups[item.schools_names]

      if (list) {
        list.push(item)
      } else {
        groups[item.schools_names] = [item]
      }
    })
    courseResults = groups
  }

  // Generate response according the report's type

  if (type === 'excel') {
    await excelResponse(courseResults)
  } else {
    await jsonResponse(user, courseResults, pagination)
  }
}

async function jsonResponse (user, courseResults, pagination) {
  // Load user module

  const modules = await con('workspaces')
    .where('id', user.subworkspace_id)

  process.send({
    courses: courseResults,
    pagination: pagination || {},
    user: {
      user, module: modules[0]
    }
  })
}

/**
 * Generate Excel file and make a response with its data
 *
 * @param courseResults
 * @returns {Promise<void>}
 */
async function excelResponse (courseResults) {
  await createHeaders(['Escuelas', 'Curso', 'Nota', 'Estado'])
  for (const course of courseResults) {
    const cellRow = []
    cellRow.push(course.schools_names)
    cellRow.push(course.course_name)
    cellRow.push(course.grade)
    cellRow.push(course.course_status)

    // Add row to sheet

    worksheet.addRow(cellRow).commit()
  }
  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'HistorialUsuario' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

/**
 * Generate SQL query for report
 *
 * @param pagination
 * @param schoolId
 * @param search
 * @param allowStatusesIds
 * @param workspaceId
 * @returns {string}
 */
function generateQuery (pagination = null, schoolId = null, search = null, allowStatusesIds = [], workspaceId = null) {
  let limit = ''
  let statusCondition = ''
  if (pagination) {
    limit = `limit ${pagination.startIndex}, ${pagination.perPage}`
  }

  if (allowStatusesIds.length > 0) {
    statusCondition = ` and sc.status_id in (${allowStatusesIds.join(',')})`
  }

  return `
    select
        group_concat(distinct (s.name) separator ', ') schools_names,
        c.name                                         course_name,
        sc.grade_average                               course_grade,
        sc.status_id                                   course_status_id
    
    from users u
         inner join summary_courses sc on u.id = sc.user_id
         inner join courses c on sc.course_id = c.id
         inner join course_school cs on c.id = cs.course_id
         inner join schools s on cs.school_id = s.id
         inner join school_workspace sw on sw.school_id = s.id

    where 
        u.id = :userId 
        ${statusCondition}
        ${workspaceId ? ' and sw.workspace_id = ' + workspaceId : ''}
        ${schoolId ? ' and s.id = ' + schoolId : ''}
        ${search ? ' and c.name like "%' + search + '%"' : ''}
    
    group by u.id, sc.course_id
    ${limit}
   `
}
