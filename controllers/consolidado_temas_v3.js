'use strict'
process.on('message', (requestData) => {
  exportarUsuariosDW(requestData)
})

require('../error')
const _ = require('lodash')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { response } = require('../response')
const { getGenericHeaders, getWorkspaceCriteria } = require('../helper/Criterios')
const moment = require('moment')
const { con } = require('../db')
const { pluck, logtime } = require('../helper/Helper')
const { loadUsersCriteriaValues, getUserCriterionValues, addActiveUsersCondition } = require('../helper/Usuarios')
const {
  loadTopicsStatuses, getTopicStatusId, getEvaluationTypeName,
  loadEvaluationTypes, getCourseStatusName, getTopicStatusName,
  loadCoursesStatuses,
  loadTopicsByCourseId
} = require('../helper/CoursesTopicsHelper')
const { getSuboworkspacesIds } = require('../helper/Workspace')
const { loadCoursesV2, loadUsersSegmentedv2, loadUsersSegmentedWithSummariesTopics, loadUsersSegmentedv2WithSummaryTopics } = require('../helper/SegmentationHelper')
const { loadSummaryCoursesByUsersAndCoursesTopics } = require('../helper/Summaries')

moment.locale('es')

let headers = [
  'ULTIMA SESIÓN',
  'ESCUELA',
  'CURSO',
  'RESULTADO CURSO',
  'REINICIOS CURSO',
  'TIPO CURSO',
  'TEMA',
  'RESULTADO TEMA',
  'ESTADO TEMA',
  'NOTA TEMA',
  'REINICIOS TEMA',
  'INTENTOS PRUEBA',
  'EVALUABLE TEMA',
  'TIPO TEMA',
  'VISITAS TEMA',
  'PJE. MINIMO APROBATORIO',
  'ULTIMA EVALUACIÓN'
]

async function exportarUsuariosDW({
  workspaceId,
  modulos, UsuariosActivos, UsuariosInactivos, escuelas,
  cursos, temas, revisados, aprobados, desaprobados, realizados, porIniciar,
  activeTopics, inactiveTopics, end, start, validador, areas, tipocurso
}) {
  // Generate Excel file header

  const headersEstaticos = await getGenericHeaders(workspaceId)
  await createHeaders(headersEstaticos.concat(headers))

  if (validador) {
    headers = headers.concat([
      'VALIDADOR DE INTENTOS REINICIOS',
      'VALIDADOR PUNTAJE'
    ])
  }

  // Load workspace criteria

  const workspaceCriteria = await getWorkspaceCriteria(workspaceId)
  const workspaceCriteriaNames = pluck(workspaceCriteria, 'name')

  // When no modules are provided, get its ids using its parent id

  if (modulos.length === 0) {
    modulos = await getSuboworkspacesIds(workspaceId)
  }

  // Load user topic statuses

  const userTopicsStatuses = await loadTopicsStatuses()

  // Load user course statuses

  const userCourseStatuses = await loadCoursesStatuses()

  // Load evaluation types

  const evaluationTypes = await loadEvaluationTypes()

  let users_to_export = [];

  const courses = await loadCoursesV2({ 
    workspaceId, schools: escuelas, courses: cursos, topics: temas });

  console.log({ courses_count: pluck(courses, 'course_id') });
  
  for (const course of courses) {
    console.log({ course });

    const topics = await loadTopicsByCourseId(course.course_id);

    // Cargar summary courses cruzados con left outer join con summary topics
    // User- Summary Course Data - Summary Topic Data
    const users = await loadUsersSegmentedv2WithSummaryTopics(course.course_id, temas, modulos, start, end, UsuariosActivos, UsuariosInactivos);


    /**
     * Crear funcion para agrupar los summaries por course_id
     * 
     * [
     *  {
     *    user_id 
     *    course_id
     *    topics: [ todos los sumarry topics con su data]
    *     .....
     *  }
     * ]
     * 
     */
    const rows_grouped = await groupRowsByCourseId(users);

    // console.log({ course, users_count: users.length });


    const users_null = rows_grouped.filter((us) => us.created_at == null);
    const users_not_null = rows_grouped.filter((us) => us.created_at != null);
    users_to_export = users_not_null;



    const compatibles_courses = await loadCompatiblesId(course.course_id);
    const pluck_compatibles_courses = pluck(compatibles_courses, "id");

    if (compatibles_courses.length > 0) {


      // Modificar o duplicar la funcion Summaries.loadSummaryCoursesByUsersAndCourses
      // Agregar los join necesarios para cruzar data con summary topics
      /**
       *  INNER join topics t on t.course_id = sc.course_id
          LEFT OUTER JOIN summary_topics st on st.topic_id = t.id
       */
      const st_compatibles = await loadSummaryCoursesByUsersAndCoursesTopics(
        pluck(users_null, "id"),
        pluck(compatibles_courses, "id")
      )

      const compatibles_rows_grouped = await groupRowsByCourseId(users);


      for (const user of users) {
        if (user.created_at) {
          users_to_export.push(user);
          continue;
        }

        const sc_compatible = compatibles_rows_grouped
          .filter(
            (row) =>
              row.user_id == user.id &&
              pluck_compatibles_courses.includes(row.course_id)
          )
          .sort()[0];


        if (!sc_compatible) {
          users_to_export.push(user);
          continue;
        }

        let user_temp = {
          user_id: null,
          criterios: await getUserCriterionValues(),
          topics: [],
        };
        sc_compatible.topics.forEach(summary_topic => {

          let user_temp = {};

          // Armar objeto con datos usuarios, course, topic

          user_temp.topics.push(user_temp);
        });

        users_to_export.push(user_temp);


      }

    } else {
      users_to_export = [...users_not_null, ...users_null];
    }

    for (const user of users_to_export) {


      user.topics.forEach(topics => {


        // Push each row



      });


    }


  }


  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'ConsolidadoTemas' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

