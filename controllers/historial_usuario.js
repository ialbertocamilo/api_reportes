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
const { getTopicStatusName, loadTopicsStatuses } = require('../helper/CoursesTopicsHelper')

async function historialUsuario ({ document, excel }) {
  // Load user from database

  const user = await findUserByDocument(document)

  // When there is no user with provided document,
  // stop execution and return response

  if (!user || !document) {
    process.send({ alert: 'Usuario no encontrado, verifica el documento' })
    process.exit()
  }

  const [users] = await con.raw(`
    select group_concat(distinct (s.name) separator ', ') schools_names,
           c.name                                         course_name,
           t.name                                         topic_name,
           st.grade                                       topic_grade,
           st.status_id                                   topic_status_id

    from users u
             inner join summary_topics st on u.id = st.user_id
             inner join topics t on t.id = st.topic_id
             inner join courses c on t.course_id = c.id
             inner join course_school cs on c.id = cs.course_id
             inner join schools s on cs.school_id = s.id

    where u.id = :userId
    group by u.id, st.topic_id
    `,
  { userId: user.id }
  )

  if (!users.length) {
    process.send({ alert: `El usuario con el documento ${document} no tiene evaluaciones desarrolladas` })
    process.exit()
  }

  // Load user topic statuses

  const userTopicsStatuses = await loadTopicsStatuses()

  // Generate results

  const courseResults = []
  for (const user of users) {
    const courseObj = {}

    courseObj.schools_names = user.schools_names
    courseObj.course_name = user.course_name
    courseObj.topic_name = user.topic_name
    courseObj.grade = user.topic_grade ?? '-'
    courseObj.topic_status = getTopicStatusName(userTopicsStatuses, user.topic_status_id)

    courseResults.push(courseObj)
  }

  if (excel) {
    await excelResponse(courseResults)
  } else {
    await jsonResponse(user, courseResults)
  }
}

async function jsonResponse (user, courseResults) {
  // Load user module

  const modules = await con('workspaces')
    .where('id', user.subworkspace_id)

  process.send({
    courses: courseResults,
    user: {
      user, module: modules[0]
    }
  })
}

async function excelResponse (courseResults) {
  await createHeaders(['Escuelas', 'Curso', 'Tema', 'Nota', 'Estado'])
  for (const course of courseResults) {
    const cellRow = []
    cellRow.push(course.schools_names)
    cellRow.push(course.course_name)
    cellRow.push(course.topic_name)
    cellRow.push(course.grade)
    cellRow.push(course.topic_status)

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
