process.on('message', (requestData) => {
  exportarDiplomas(requestData);
});

require('../error');
const config = require('../config.js')
const moment = require('moment');
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs');
const { response } = require('../response');
const sequelize = require('../sequelize.js');
const { Op } = require('sequelize');

/* helpers */
const { logtime, pluck } = require('../helper/Helper');
const { getSchoolStatesWorkspace,
  getSchoolCoursesStates,
  generateQuery, removeCoursesWithDisabledDiplomas
} = require('../helper/Diplomas')

/* models */

const { loadCompatiblesIds, loadCompatiblesId } = require('../helper/CoursesTopicsHelper')
const { con } = require('../db')
const { getUsers } = require('../helper/Usuarios')

const defaultHeaders = [
  'Módulo', // modulo user
  'Apellidos y Nombres',
  'Dni',
  'Estado (usuario)', // active user

  'Escuela', // school
  'Estado (escuela)', // school estado active

  'Tipo de curso', // tipo de curso
  'Curso',
  'Estado (curso)',

  'Fecha en la que obtuvo el diploma', // issue DD/MM/YYYY
  'Fecha de aceptación del usuario', // accepted DD/MM/YYYY
  'Link ver diploma',
  'Link descarga diploma',
  'Curso compatible'
];

async function exportarDiplomas({ data, states }) {

  const { estados_usuario,
    estados_escuela,
    estados_curso } = states;

  let { workspaceId, modules, date,
    course: course_ids,
    school: school_ids } = data;

  // === schools and courses ===
  const stackSchools = !(school_ids.length)
    ? await getSchoolStatesWorkspace(workspaceId, estados_escuela)
    : school_ids;
  const stackCourses = !(course_ids.length)
    ? await getSchoolCoursesStates(stackSchools, estados_curso)
    : course_ids;

  // Load alls users' ids from modules

  const users = await getUsers(modules, true, false)
  const usersIds = pluck(users, 'id')

  // Extract courses ids from courses without diploma

  const summariesWithoutDiploma = await loadSummaries(
    'without-diplomas', [], usersIds, estados_usuario, stackSchools,
    stackCourses, estados_escuela, estados_curso, date
  )
  const coursesWithoutDiplomaIds = pluck(summariesWithoutDiploma, 'course_id')

  // Get compatible courses ids

  const compatiblesCoursesIds = await loadCompatiblesIds(course_ids.length ? course_ids : coursesWithoutDiplomaIds)

  // Load summary courses with diploma

  const summariesWithCompatibleDiplomas = await loadSummaries(
    'compatible-diplomas', modules, usersIds, estados_usuario, stackSchools,
    stackCourses, estados_escuela, estados_curso, date, compatiblesCoursesIds
  )

  await createHeaders(defaultHeaders)

  // Format date

  const transformDate = (datetime) => {
    return datetime ? moment(datetime).format('DD/MM/YYYY') : '-'
  }

  for (const summary of summariesWithCompatibleDiplomas) {
    const cellRow = []

    // Get original course's name and id from compatible course

    let originalCourseName = ''
    let originalCourseId = ''
    if (compatiblesCoursesIds.includes(summary.course_id)) {
      let originalCoursesIds = await loadCompatiblesIds([summary.course_id])
      const filteredOriginalCoursesIds = filterCompatibles(course_ids, originalCoursesIds)
      if (filteredOriginalCoursesIds.length) {
        originalCoursesIds = filteredOriginalCoursesIds
      }

      const originalCourse = await con('courses').where('id', originalCoursesIds[0])
      if (originalCourse[0]) {
        originalCourseName = originalCourse[0].name
        originalCourseId = originalCourse[0].id
      }
    }

    // Add cells to Excel row

    cellRow.push(summary.workspace_name)
    cellRow.push(summary.user_fullname)
    cellRow.push(summary.user_document)
    cellRow.push(summary.user_active ? 'Activo' : 'Inactivo')

    cellRow.push(summary.school_name)
    cellRow.push(summary.school_active ? 'Activo' : 'Inactivo')

    cellRow.push(summary.course_type)
    cellRow.push(originalCourseName || summary.course_name)
    cellRow.push(summary.course_active ? 'Activo' : 'Inactivo')

    cellRow.push(transformDate(summary.certification_issued_at))
    cellRow.push(transformDate(summary.certification_accepted_at))

    let idParam = ''
    if (originalCourseId) {
      idParam = `?original_id=${originalCourseId}`
    }

    cellRow.push(`${config.URL_TEST}/tools/ver_diploma/${summary.user_id}/${summary.course_id}${idParam}`)
    cellRow.push(`${config.URL_TEST}/tools/dnc/${summary.user_id}/${summary.course_id}${idParam}`)

    cellRow.push(originalCourseName ? summary.course_name : '')

    worksheet.addRow(cellRow).commit()
  }

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'Diplomas' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

async function loadSummaries (
  type,
  modulesIds, usersIds, usersStatuses, schoolsIds,
  coursesIds, schoolsStatuses, coursesStatuses, date,
  compatiblesCoursesIds
) {
  const query = generateQuery(
    type,
    modulesIds, usersIds, usersStatuses, schoolsIds,
    coursesIds, schoolsStatuses, coursesStatuses, date,
    compatiblesCoursesIds
  )

  const [summaries] = await con.raw(query)
  return summaries
}

function filterCompatibles (coursesIds, compatibleCoursesIds) {
  const found = []
  for (const i of compatibleCoursesIds) {
    if (coursesIds.includes(i)) {
      found.push(i)
    }
  }

  return found
}
