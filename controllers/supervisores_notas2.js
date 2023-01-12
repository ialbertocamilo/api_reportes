'use strict'
process.on('message', (requestData) => {
  generateSegmentationReport(requestData)
})

require('../error')
const moment = require('moment')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { response } = require('../response')
const { loadCourses, loadUsersSegmentedv2 } = require('../helper/SegmentationHelper')
const {
  loadCoursesStatuses,
  loadCompatiblesId,
  getCourseStatusName,
  getCourseStatusId
} = require('../helper/CoursesTopicsHelper')

const { pluck, logtime } = require('../helper/Helper')
const { loadSummaryCoursesByUsersAndCourses } = require('../helper/Summaries')
const { getGenericHeadersNotasXCurso } = require('../helper/Criterios')
const { loadUsersBySubWorspaceIds } = require('../helper/Usuarios')
const { getSuboworkspacesIds } = require('../helper/Workspace')
const { loadSupervisorSegmentUsersIds } = require('../helper/Segment')

// Headers for Excel file

const headers = [
  'ULTIMA SESIÓN',
  'ESCUELA',
  'CURSO',
  'VISITAS',
  'NOTA PROMEDIO',
  'RESULTADO CURSO', // convalidado
  'ESTADO CURSO',
  'TIPO CURSO',
  'REINICIOS CURSOS',
  'TEMAS ASIGNADOS',
  'TEMAS COMPLETADOS',
  'AVANCE (%)',
  'ULTIMA EVALUACIÓN',
  'ESTADO COMPATIBLE' // nombre del curso
]

async function generateSegmentationReport ({
  workspaceId,
  supervisorId,
  escuelas,
  cursos,
  UsuariosActivos: activeUsers,
  UsuariosInactivos: inactiveUsers,
  aprobados,
  desaprobados,
  desarrollo,
  encuestaPendiente,
  CursosActivos = false, // posible filtro en estado de curso
  CursosInactivos = false // posible filtro en estado de curso
}) {
  // Generate Excel file header
  const headersEstaticos = await getGenericHeadersNotasXCurso(
    workspaceId,
    [1, 5, 13, 4, 40, 41]
  )
  await createHeaders(headersEstaticos.concat(headers))

  const modulos = await getSuboworkspacesIds(workspaceId)
  const supervisedUsersIds = await loadSupervisorSegmentUsersIds(modulos, supervisorId)
  const areas = []
  let tipocurso
  const startDate = null
  const endDate = null

  let users_to_export = []

  // Load Courses
  const courses = await loadCourses({
    cursos,
    escuelas,
    tipocurso,
    CursosActivos,
    CursosInactivos
  },
  workspaceId)
  const coursesStatuses = await loadCoursesStatuses()

  // console.log('courses_count', courses.length)

  // === filtro de checks ===
  const StateChecks = (aprobados && desaprobados &&
    desarrollo && encuestaPendiente)
  const StackChecks = []

  if (aprobados) { StackChecks.push(getCourseStatusId(coursesStatuses, 'aprobado')) }
  if (desaprobados) { StackChecks.push(getCourseStatusId(coursesStatuses, 'desaprobado')) }
  if (desarrollo) { StackChecks.push(getCourseStatusId(coursesStatuses, 'desarrollo')) }
  if (encuestaPendiente) { StackChecks.push(getCourseStatusId(coursesStatuses, 'enc_pend')) }
  // === filtro de checks ===

  // === precargar usuarios y criterios
  const StackUsersData = await loadUsersBySubWorspaceIds(modulos, true)
  const StackUserCriterios = []
  // === precargar usuarios y criterios

  for (const course of courses) {
    // Load workspace user criteria

    const users = await loadUsersSegmentedv2(
      course.course_id,
      modulos,
      areas,
      startDate,
      endDate,
      activeUsers,
      inactiveUsers,
      supervisedUsersIds
    )

    // filtro para usuarios nulos y no nulos
    const { users_null, users_not_null } = getUsersNullAndNotNull(users)
    users_to_export = users_not_null

    const compatibles_courses = await loadCompatiblesId(course.course_id)
    const pluck_compatibles_courses = pluck(compatibles_courses, 'id')

    if (compatibles_courses.length > 0 && users_null.length > 0) {
      logtime('INICIO COMPATIBLES')

      // summary_course verifica si es compatible
      const sc_compatibles = await loadSummaryCoursesByUsersAndCourses(
        pluck(users_null, 'id'),
        pluck_compatibles_courses
      )

      for (const user of users_null) {
        if (user.sc_created_at) {
          users_to_export.push(user) // usercourse
          continue
        }

        // verificar compatible con 'user_id' y 'course_id'
        const sc_compatible = sc_compatibles
          .filter(
            (row) =>
              row.user_id == user.id &&
              pluck_compatibles_courses.includes(row.course_id)
          )
          .sort()[0]

        if (!sc_compatible) {
          users_to_export.push(user) // usercourse
          continue
        }

        const additionalData = {
          course_status_name: 'Convalidado',
          compatible: sc_compatible.course_name
        }

        users_to_export.push({ ...user, ...additionalData }) // usercourse
      }
    } else {
      users_to_export = [...users_not_null, ...users_null]
    }

    // exportar usuarios (users_to_export);
    for (const user of users_to_export) {
      // === filtro de checks ===
      if (!StateChecks && !StackChecks.includes(user.course_status_id)) continue

      const cellRow = []

      // encontrar usuario por 'id'
      const { id } = user
      const userStore = StackUsersData[id]
      const lastLogin = moment(userStore.last_login).format('DD/MM/YYYY H:mm:ss')
      cellRow.push(userStore.name)
      cellRow.push(userStore.lastname)
      cellRow.push(userStore.surname)
      cellRow.push(userStore.document)
      cellRow.push(userStore.active === 1 ? 'Activo' : 'Inactivo')
      cellRow.push(userStore.email)
      // encontrar usuario por 'id'

      // criterios de usuario
      if (StackUserCriterios[id]) {
        const StoreUserValues = StackUserCriterios[id]
        StoreUserValues.forEach((item) => cellRow.push(item.criterion_value || '-'))
      } else {
        const userValues = [{ criterion_value: '-' }, { criterion_value: '-' }, { criterion_value: '-' }, { criterion_value: '-' }, { criterion_value: '-' }, { criterion_value: '-' }]

        userValues.forEach((item) => cellRow.push(item.criterion_value || '-'))

        StackUserCriterios[id] = userValues
      }
      // criterios de usuario

      const passed = user.course_passed || 0
      const taken = user.taken || 0
      const reviewed = user.reviewed || 0
      const completed = passed + taken + reviewed

      cellRow.push(lastLogin !== 'Invalid date' ? lastLogin : '-')
      cellRow.push(course.school_name)
      cellRow.push(course.course_name)
      cellRow.push(user.course_views || '-')
      cellRow.push(user.course_passed > 0 ? user.grade_average : '-')

      // estado para - 'RESULTADO DE TEMA'
      if (!user.course_status_name) {
        cellRow.push(getCourseStatusName(coursesStatuses, user.course_status_id) || 'No iniciado')
      } else {
        cellRow.push(user.course_status_name)
      }

      cellRow.push(course.course_active === 1 ? 'Activo' : 'Inactivo')
      cellRow.push(course.course_type || '-')
      cellRow.push(user.course_restarts || '-')
      cellRow.push(user.assigned || 0)
      cellRow.push(Math.round(completed) || 0)
      cellRow.push(
        user.advanced_percentage ? user.advanced_percentage + '%' : '0%'
      )
      cellRow.push(
        user.last_time_evaluated_at
          ? moment(user.last_time_evaluated_at).format('DD/MM/YYYY H:mm:ss')
          : '-'
      )
      cellRow.push(user.compatible || '-')

      // añadir fila
      worksheet.addRow(cellRow).commit()
    }
  }

  logtime('FIN Cursos')

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'ConsolidadoCompatibleCursos' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

function getUsersNullAndNotNull (users) {
  const users_null = []
  const users_not_null = []

  for (const user of users) {
    const { sc_created_at } = user

    if (sc_created_at == null) users_null.push(user)
    else users_not_null.push(user)
  }

  return { users_null, users_not_null }
}
