process.on('message', requestData => {
  notasUsuario(requestData)
})

require('../error')
const moment = require('moment')
moment.locale('es')
const { con } = require('../db')
const { findUserByDocument } = require('../helper/Usuarios')
const { loadEvaluationTypes } = require('../helper/CoursesTopicsHelper')
const { strippedString } = require('../helper/Helper')

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
       select st.*, 
              t.name as topic_name, 
              t.id as topic_id, 
              t.type_evaluation_id
       from summary_topics st
               inner join topics t on st.topic_id = t.id
       where st.user_id = :userId and 
             t.course_id = :courseId
       `,
    { userId: user.id, courseId: course_id }
    )

    for (const summaryTopic of userSummaryTopics) {
      const topicObj = {}
      // const evaluationType = getEvaluationTypeName(evaluationTypes, summaryTopic.type_evaluation_id)
      topicObj.tema = summaryTopic.topic_name
      topicObj.nota = summaryTopic.grade ? parseFloat(summaryTopic.grade).toFixed(2) : '-'
      topicObj.puntaje = ''// summaryTopic.grade ? parseInt(summaryTopic.grade) : '-'
      topicObj.correctas = summaryTopic.correct_answers || '-'
      topicObj.incorrectas = summaryTopic.failed_answers || '-'
      topicObj.visitas = summaryTopic.views || '-'
      topicObj.reinicios = summaryTopic.restarts || '-'
      topicObj.ultima_evaluacion = summaryTopic.last_time_evaluated_at
        ? moment(summaryTopic.last_time_evaluated_at).format('L')
        : '-'

      const [questions] = await con.raw(`
        select
            *
        from
            questions
        where
            topic_id = :topicId
      `,
      { topicId: summaryTopic.topic_id }
      )

      // Retrieves questions with its user's answers

      const questionsAnswers = []
      const usersAnswers = summaryTopic.answers
      questions.forEach(q => {
        questionsAnswers.push({
          pregunta: strippedString(q.pregunta),
          respuesta_usuario: getUserAnswerText(q.id, q.rptas_json, usersAnswers),
          respuesta_ok: getQuestionCorrectAnswerText(q.rptas_json, q.rpta_ok)
        })
      })

      topicObj.prueba = questionsAnswers

      topicsArray.push(topicObj)
    }

    courseObj.curso = summaryCourse.course_name
    courseObj.nota_prom = summaryCourse.grade_average ? summaryCourse.grade_average : '-'
    courseObj.visitas = summaryCourse.views
    courseObj.reinicios = summaryCourse.restarts ? summaryCourse.restarts : '-'
    courseObj.temas = topicsArray
    courseObj.resultado = +summaryCourse.advance_percentage === 100 ? 'Completado' : 'En desarrollo'

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

/**
 * Get correct answer text from question answers
 * @param answers
 * @param correctAnswer
 * @returns {string}
 */
function getQuestionCorrectAnswerText (answers, correctAnswer) {
  try {
    answers = JSON.parse(answers)
  } catch (ex) {
    return '-'
  }

  let correctAnswerText = '-'
  for (const [key, value] of Object.entries(answers)) {
    if (+key === +correctAnswer) {
      correctAnswerText = value
    }
  }

  return strippedString(correctAnswerText)
}

/**
 * Get user answer text from question answers
 * @param questionId
 * @param questionAnswers
 * @param userAnswers
 * @returns {string}
 */
function getUserAnswerText (questionId, questionAnswers, userAnswers) {
  console.log(questionAnswers)
  console.log(userAnswers)
  try {
    questionAnswers = JSON.parse(questionAnswers)
  } catch (ex) {
    return '-'
  }

  if (!userAnswers) return '-'

  let userAnswerText = '-'
  const userAnswer = userAnswers.find(ua => +ua.preg_id === +questionId)

  for (const [answerId, value] of Object.entries(questionAnswers)) {
    if (userAnswer) {
      if (+answerId === +userAnswer.opc) {
        userAnswerText = value
      }
    }
  }

  return strippedString(userAnswerText)
}
