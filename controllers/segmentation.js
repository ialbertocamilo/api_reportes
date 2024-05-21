'use strict'
process.on('message', (requestData) => {
  generateSegmentationReport(requestData)
})

require('../error')
const moment = require('moment')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { response } = require('../response')
const {  loadUsersSegmented, loadCourses } = require('../helper/SegmentationHelper')
const {  loadCoursesStatuses } = require('../helper/CoursesTopicsHelper')
const { getSuboworkspacesIds } = require('../helper/Workspace')

const { con } = require('../db')

// Headers for Excel file

const headers = [
    'Módulo',
    'Nombre','Apellido Paterno', 'Apellido Materno',
    'Documento','EMAIL',
    'ESCUELA',
    'CURSO',
    'ESTADO DEL CURSO',
    'PROMEDIO',
    'AVANCE (%)',
    'RESULTADO CURSO',
    'ULTIMA EVALUACIÓN'
]

async function generateSegmentationReport ({
  cursos,
  escuelas,
  workspaceId
}) {

  if (process.env.MARCA === 'inretail-test2') {
    const index = headers.indexOf('EMAIL');
    headers.splice(index + 1, 0, 'Número de teléfono');
  }


  // Generate Excel file header
  await createHeaders(headers)
  //Load Courses
  const courses_s = (Array.isArray(cursos)) ? cursos : [cursos];
  
  const courses = await loadCourses({cursos:courses_s,escuelas,tipocurso:'include_free'},workspaceId); 
  const coursesStatuses = await loadCoursesStatuses();
  const subworkspaces = await getSuboworkspacesIds(workspaceId,'all')

  for (const course of courses) {
    const users = await loadUsersSegmented(course.course_id,true)
    for (const user of users) {
        const cellRow = []
        const user_status = (user.status_id) ? coursesStatuses.find(status=>status.id == user.status_id) : {name:'Pendiente'};
        const subworkspace= subworkspaces.find(s => s.id == user.subworkspace_id);
        // Add default values
        cellRow.push(subworkspace ? subworkspace.name : '-')
        cellRow.push(user.name)
        cellRow.push(user.lastname)
        cellRow.push(user.surname)
        cellRow.push(user.document)
        cellRow.push(user.email)
        if (process.env.MARCA === 'inretail-test2') { cellRow.push(user.phone_number) }

        cellRow.push(course.school_name)
        cellRow.push(course.course_name)
        cellRow.push(course.course_active ? 'Activo' : 'Inactivo')
        cellRow.push(user.grade_average || '-')
        cellRow.push(user.advanced_percentage ? user.advanced_percentage+'%' : '0%')
        cellRow.push(user_status.name)
        cellRow.push(user.last_time_evaluated_at)
        worksheet.addRow(cellRow).commit()
    }
  }

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'SegmentaciónCursos' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}
