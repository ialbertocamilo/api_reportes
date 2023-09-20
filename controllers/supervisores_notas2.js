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
let usersCoursesProgress = []
const { pluck, logtime, calculateUserSeniorityRange } = require('../helper/Helper')
const { loadSummaryCoursesByUsersAndCourses } = require('../helper/Summaries')
const { getGenericHeadersNotasXCurso, getWorkspaceCriteria } = require('../helper/Criterios')
const { loadUsersBySubWorspaceIds, getUserCriterionValues2 } = require('../helper/Usuarios')
const { getSuboworkspacesIds } = require('../helper/Workspace')
const { loadSupervisorSegmentUsersIds } = require('../helper/Segment')
const { loadUsersCoursesProgress, calculateSchoolProgressPercentage,
  loadUsersWithCourses, calculateSchoolAccomplishmentPercentage,
  countCoursesActiveTopics,
  loadSummaryTopicsCount, calculateCourseAccomplishmentPercentage
} = require('../helper/Courses')
const { loadCoursesSegmentedToUsersInSchool } = require('../helper/SegmentationHelper_v2')

// Headers for Excel file

const headers = [
  'ULTIMA SESIÓN',
  'ESCUELA',
  'CURSO',
  'APROBACIÓN CURSO',
  'VISITAS',
  'NOTA PROMEDIO',
  'RESULTADO CURSO', // convalidado
  'ESTADO CURSO',
  'TIPO CURSO',
  'REINICIOS CURSOS',
  'TEMAS ASIGNADOS',
  'TEMAS COMPLETADOS',
  'ULTIMA EVALUACIÓN',
  'CURSO COMPATIBLE', // nombre del curso

  // 'NOTA COMPATIBLE',
  // 'PROGRESO COMPATIBLE',
  // 'TEMAS ASIGNADOS COMPATIBLES',
  // 'TEMAS COMPLETADOS COMPATIBLES'
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
  noIniciado,
  CursosActivos = false, // posible filtro en estado de curso
  CursosInactivos = false // posible filtro en estado de curso
}) {

  // Homecenters Peruanos -> id 11
  let isPromart = workspaceId === 11
  if (isPromart) {

    let schoolProgressIndex = 2
    headers.splice(schoolProgressIndex, 0, 'CUMPLIMIENTO ESCUELA');
    headers.splice(schoolProgressIndex, 0, 'APROBACIÓN ESCUELA');
    headers.unshift('RANGO DE ANTIGÜEDAD');

    headers.splice(7, 0, 'CUMPLIMIENTO CURSO');
  }

  // Generate Excel file header
  const headersEstaticos = await getGenericHeadersNotasXCurso(workspaceId)
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

  // Load workspace criteria

  const workspaceCriteria = await getWorkspaceCriteria(workspaceId, criteriaIds)
  const workspaceCriteriaNames = pluck(workspaceCriteria, 'name')

  let segmentedCoursesByUsers = []
  if (isPromart) {
    // Load progress by user

    usersCoursesProgress = await loadUsersCoursesProgress(escuelas)

    // Load segmented courses by school for each user

    if (supervisedUsersIds.length) {
      segmentedCoursesByUsers = await loadCoursesSegmentedToUsersInSchool(escuelas, supervisedUsersIds)
    }
  }

  const coursesIds = pluck(courses, 'course_id')
  const coursesTopics = await countCoursesActiveTopics(coursesIds)
  const summaryTopicsCount = await loadSummaryTopicsCount(coursesIds, supervisedUsersIds)


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
      true,
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
          compatible: sc_compatible.course_name,
          compatible_grade_average: sc_compatible.grade_average,
          compatible_completed: sc_compatible.completed,
          compatible_assigned: sc_compatible.assigned
        }

        users_to_export.push({ ...user, ...additionalData }) // usercourse
      }
    } else {
      users_to_export = [...users_not_null, ...users_null]
    }
    // exportar usuarios (users_to_export);
    for (const user of users_to_export) {
      // === filtro de checks ===
      const course_status_name = getCourseStatusName(coursesStatuses, user.course_status_id) || 'No iniciado';
      if(noIniciado && !StateChecks){
        if(course_status_name != 'No iniciado') continue
      }else{
        if ((!StateChecks && !StackChecks.includes(user.course_status_id))) continue
      }
      
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
        // const userValues = []
        // for (let i = 0; i < criteriaIds.length; i++) {
        //   userValues.push({ criterion_value: '-' })
        // }
        // userValues.forEach((item) => cellRow.push(item.criterion_value || '-'))
        //
        // StackUserCriterios[id] = userValues

        const userValues = await getUserCriterionValues2(user.id, workspaceCriteriaNames)
        userValues.forEach((item) => cellRow.push(item.criterion_value || "-"))

        StackUserCriterios[id] = userValues;
      }

      if (isPromart) {

        let startDateCriteria = StackUserCriterios[id].find(c =>
          c.criterion_name === 'Date_Start')
        let seniorityValue = '-'

        if (startDateCriteria) {
          seniorityValue = calculateUserSeniorityRange(startDateCriteria.criterion_value)
        }

        cellRow.push(seniorityValue);
      }

      // criterios de usuario
      const passed = user.course_passed || 0
      const taken = user.taken || 0
      const reviewed = user.reviewed || 0
      const completed = passed + taken + reviewed
      const userSummaryTopicsCount = summaryTopicsCount.filter(stc => stc.user_id === user.id)

      cellRow.push(lastLogin !== 'Invalid date' ? lastLogin : '-')
      cellRow.push(course.school_name)
      if (isPromart) {
        const schoolTotals = calculateSchoolProgressPercentage(
          usersCoursesProgress, user.id, course.school_id, segmentedCoursesByUsers[user.id]
        )
        cellRow.push((schoolTotals.schoolPercentage || 0) + '%');
        cellRow.push((calculateSchoolAccomplishmentPercentage(coursesTopics, userSummaryTopicsCount, segmentedCoursesByUsers[user.id], course.school_id) || 0) + '%')
      }

      cellRow.push(course.course_name)
      cellRow.push(
        user.advanced_percentage
          ? user.advanced_percentage + '%'
          : user.compatible ? '100%' : '0%'
      )

      if (isPromart) {
        cellRow.push((calculateCourseAccomplishmentPercentage(course.course_id, coursesTopics, userSummaryTopicsCount) || 0) + '%')
      }

      let gradeAverage =  user.course_passed > 0
        ? user.grade_average
        : user.compatible_grade_average;

      if (!gradeAverage) {
        gradeAverage = user.grade_average
      }

      cellRow.push(user.course_views || '-')
      cellRow.push(gradeAverage)
      
      // estado para - 'RESULTADO DE TEMA'
      if (!user.course_status_name) {
        cellRow.push(course_status_name)
      } else {
        cellRow.push(user.course_status_name)
      }

      cellRow.push(course.course_active === 1 ? 'Activo' : 'Inactivo')
      cellRow.push(course.course_type || '-')
      cellRow.push(user.course_restarts || '-')
      cellRow.push(
        user.compatible
        ? user.compatible_assigned
        : user.assigned
      )
      cellRow.push(
        user.compatible
        ? Math.round(user.compatible_completed)
        : Math.round(completed) || 0
      )

      cellRow.push(
        user.last_time_evaluated_at
          ? moment(user.last_time_evaluated_at).format('DD/MM/YYYY H:mm:ss')
          : '-'
      )
      cellRow.push(user.compatible || '-')

      // Get topics count

      // añadir fila
      worksheet.addRow(cellRow).commit()
    }
  }

  logtime('FIN Cursos')

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'SupervisoresNotas' }))
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
