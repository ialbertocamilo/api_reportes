process.on('message', requestData => {
  notasUsuario2(requestData)
})

require('../error')
const moment = require('moment')
moment.locale('es')
const { con } = require('../db')
const { findUserByDocument } = require('../helper/Usuarios')
const { loadCoursesStatuses, getCourseStatusName, loadCompatiblesIds
} = require('../helper/CoursesTopicsHelper')
const { strippedString } = require('../helper/Helper')
const { loadModuleCoursesIds } = require('../helper/SegmentationHelper')
const { loadSummaryCoursesByUsersAndCourses } = require('../helper/Summaries')

async function notasUsuario2 ({ document }) {
  // Load user from database

  const user = await findUserByDocument(document)

  // When there is no user with provided document,
  // stop execution and return response

  if (!user || !document) {
    process.send({ alert: 'Usuario no encontrado, verifica el documento' })
    process.exit()
  }

  // Get moduleId (criterion_value_id) from user's subworkspace

  const moduleId = await getModuleIdFromSubworkspace(user.subworkspace_id)

  // Get courses from module using segmentation

  const moduleCoursesIds = await loadModuleCoursesIds(moduleId)

  const userSummaryCourses = []
  for (let i = 0; i < moduleCoursesIds.length; i++) {
    const courseId = moduleCoursesIds[i]
    const summaryCourses = await loadSummaryCoursesByUsersAndCourses(
      [user.id], [courseId]
    )

    // Course is "aprobado" so adds it to collection
    if (summaryCourses[0]) {
      userSummaryCourses.push(summaryCourses[0])
    } else {
      // Look for compatible course with "aprobado" status

      const compatiblesCoursesIds = await loadCompatiblesIds([courseId])
      if (compatiblesCoursesIds.length) {
        const compatiblesUserSummaryCourses = await loadSummaryCoursesByUsersAndCourses([user.id], compatiblesCoursesIds)

        // Get summary course with the highest grade

        let highestGrade = 0
        let highestGradeIndex = -1
        if (compatiblesUserSummaryCourses.length) {
          for (let j = 0; j < compatiblesUserSummaryCourses.length; j++) {
            const sc = compatiblesUserSummaryCourses[j]
            if (sc.grade_average > highestGrade) {
              highestGrade = sc.grade_average
              highestGradeIndex = j
            }
          }

          if (highestGrade > 0) {
            const compatible = compatiblesUserSummaryCourses[highestGradeIndex]
            compatible.convalidado_de = compatible.course_name
            compatible.course_name = await getCourseName(courseId)
            userSummaryCourses.push(compatible)
          }
        }
      }
    }
  }

  // When user has no summary courses,
  // stop execution and return response

  if (!userSummaryCourses.length) {
    process.send({ alert: `El usuario con el documento ${document} no tiene evaluaciones desarrolladas` })
    process.exit()
  }
  // Load user course statuses

  const userCourseStatuses = await loadCoursesStatuses()

  // Generate results

  const courseResults = []
  for (const summaryCourse of userSummaryCourses) {
    const { course_id } = summaryCourse
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
    courseObj.convalidado_de = summaryCourse.convalidado_de
    // courseObj.resultado = +summaryCourse.advance_percentage === 100 ? 'Completado' : 'En desarrollo'
    courseObj.resultado = summaryCourse.convalidado_de
      ? 'Convalidado'
      : getCourseStatusName(userCourseStatuses, summaryCourse.status_id)
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
 *
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

/**
 * Get moduleId (criterion_value_id) from user's subworkspace
 * @param subworkspaceId
 * @returns {*|null}
 */
async function getModuleIdFromSubworkspace (subworkspaceId) {
  const [workspaces] = await con.raw(`
    select * from workspaces where id = :subworkspaceId
  `,
  { subworkspaceId }
  )

  return workspaces ? workspaces[0].criterion_value_id : null
}

async function getCourseName(courseId) {
  const [courses] = await con.raw(`
    select * from courses where id = :courseId
  `, { courseId }
  )

  return courses ? courses[0].name : null
}
