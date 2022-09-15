process.on('message', requestData => {
  notasUsuario(requestData)
})

require('../error')
const moment = require('moment')
moment.locale('es')
const { con } = require('../db')
const { findUserByDocument } = require('../helper/Usuarios')
const { loadEvaluationTypes, getEvaluationTypeName } = require('../helper/CoursesTopicsHelper')

async function notasUsuario ({ document }) {
  // Load user from database

  const user = await findUserByDocument(document)

  // When there is no user with provided document,
  // stop execution and return response

  if (!user || !document) {
    process.send({ alert: 'Usuario no encontrado, verifica el documento' })
    process.exit()
  }

  // When user has no summary courses,
  // stop execution and return response

  const [userSummaryCourses] = await con.raw(`
    select sc.*, c.name as course_name
    from summary_courses sc 
        inner join courses c on sc.course_id = c.id
    where sc.user_id = :userId`,
  { userId: user.id }
  )

  if (!userSummaryCourses.length) {
    process.send({ alert: `El usuario con el documento ${document} no tiene evaluaciones desarrolladas` })
    process.exit()
  }



  // Load evaluation types

  const evaluationTypes = await loadEvaluationTypes()

  // Generate results

  const courseResults = []
  for (const summaryCourse of userSummaryCourses) {
    const { course_id, user_id } = summaryCourse
    const courseObj = {}
    const topicsArray = []

    // Load user summary topics from database

    const [userSummaryTopics] = await con.raw(`
       select st.*, t.name as topic_name, t.type_evaluation_id
       from summary_topics st
               inner join topics t on st.topic_id = t.id
       where st.user_id = :userId and t.course_id = :courseId
       `,
    { userId: user.id, courseId: course_id }
    )

    for (const summaryTopic of userSummaryTopics) {
      const topicObj = {}
      const evaluationType = getEvaluationTypeName(evaluationTypes, summaryTopic.type_evaluation_id)
      topicObj.tema = summaryTopic.topic_name
      topicObj.sistema_calificacion = evaluationType || '-'
      topicObj.puntaje = ''// summaryTopic.grade ? parseInt(summaryTopic.grade) : '-'
      topicObj.nota = summaryTopic.grade ? parseFloat(summaryTopic.grade).toFixed(2) : '-'
      topicObj.correctas = summaryTopic.correct_answers || '-'
      topicObj.incorrectas = summaryTopic.failed_answers || '-'
      topicObj.visitas = summaryTopic.views || '-'
      topicObj.reinicios = summaryTopic.restarts || '-'
      topicObj.ultima_evaluacion = summaryTopic.last_time_evaluated_at
        ? moment(summaryTopic.last_time_evaluated_at).format('L')
        : '-'

      topicsArray.push(topicObj)
    }

    courseObj.curso = summaryCourse.course_name
    courseObj.nota_prom = summaryCourse.grade_average ? summaryCourse.grade_average : '-'
    courseObj.visitas = summaryCourse.views
    courseObj.reinicios = summaryCourse.restarts ? summaryCourse.restarts : '-'
    courseObj.temas = topicsArray

    courseResults.push(courseObj)
  }

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
