'use strict'
process.on('message', (requestData) => {
  generateSegmentationReport(requestData)
})

require('../error')
const moment = require('moment')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { response } = require('../response')
const {  loadUsersSegmented, loadCourses } = require('../helper/SegmentationHelper')
const {  getCourseStatusId } = require('../helper/CoursesTopicsHelper')

const { con } = require('../db')

// Headers for Excel file

const headers = [
    'Nombre','Apellido Paterno', 'Apellido Materno',
    'Documento','EMAIL',
    'ESCUELA',
    'CURSO',
    'PROMEDIO',
    'AVANCE (%)',
    'RESULTADO CURSO'
]

async function generateSegmentationReport ({
  cursos,
  escuelas
}) {
  // Generate Excel file header
  await createHeaders(headers)
  //Load Courses
  const courses = await loadCourses({cursos,escuelas}); 
  for (const course of courses) {
    const users = await loadUsersSegmented(course.course_id)
    for (const user of users) {
        const cellRow = []
        cellRow.push(user.name)
        cellRow.push(user.lastname)
        cellRow.push(user.surname)
        cellRow.push(user.document)
        cellRow.push(user.email)
        cellRow.push(course.school_name)
        cellRow.push(course.course_name)
        cellRow.push(user.grade_average || '-')
        cellRow.push(user.advanced_percentage ? user.advanced_percentage+'%' : '0%')
        cellRow.push(user.status_id || 'Pendiente')
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