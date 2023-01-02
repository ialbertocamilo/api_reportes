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
const { pluck, logtime, groupArrayOfObjects } = require('../helper/Helper')
const { loadUsersCriteriaValues, getUserCriterionValues, addActiveUsersCondition } = require('../helper/Usuarios')
const {
  loadTopicsStatuses, getTopicStatusId, getEvaluationTypeName,
  loadEvaluationTypes, getCourseStatusName, getTopicStatusName,
  loadCoursesStatuses,
  loadCompatiblesId,
  loadTopicsByCourseId,
  loadTopicsByCourseUniqueId
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
  workspaceId, modulos, 
  escuelas, cursos, temas, areas,
  
  revisados, 
  aprobados, 
  desaprobados, 
  realizados, 
  porIniciar,
  tipocurso,

  CursosActivos = false, CursosInactivos = false,
  UsuariosActivos, UsuariosInactivos,
  activeTopics, inactiveTopics,

  start: start_date,
  end: end_date,
  validador
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
      escuelas, cursos, temas,
      CursosActivos, CursosInactivos,
      tipocurso
    }, workspaceId);

  console.log(courses);
  for (const course of courses) {
    logtime('CURRENT COURSE:', `${course.course_id} - ${course.course_name}`);
    // const topics = await loadTopicsByCourseUniqueId(course.course_id);

    // Cargar summary courses cruzados con left outer join con summary topics
    // User- Summary Course Data - Summary Topic Data
    // const users = await loadUsersSegmentedv2WithSummaryTopics(course.course_id, temas, modulos, start, end, UsuariosActivos, UsuariosInactivos);
    const users = await loadUsersSegmentedv2WithSummaryTopics(
      course.course_id, 
      modulos, 
      areas,

      start_date, 
      end_date, 

      UsuariosActivos, 
      UsuariosInactivos
    );

    const users_null = users.filter((us) => us.sc_created_at == null);
    const users_not_null = users.filter((us) => us.sc_created_at != null);

    const rows_grouped = groupArrayOfObjects(users_null, 'id');

    // console.log({users_not_null}, rows_grouped);
    // console.log('rows_grouped', rows_grouped);

    // /**
    //  * Crear funcion para agrupar los summaries por course_id
    //  * 
    //  * [
    //  *  {
    //  *    user_id 
    //  *    course_id
    //  *    topics: [ todos los sumarry topics con su data]
    // *     .....
    //  *  }
    //  * ]
    //  * 
    //  */
    // const rows_grouped = groupRowsByCourseId(users);
    // // console.log({ course, users_count: users.length });


    users_to_export = users_not_null;

    const compatibles_courses = await loadCompatiblesId(course.course_id);
    const pluck_compatibles_courses = pluck(compatibles_courses, "id");

    console.log('compatibles_courses', compatibles_courses, users_null.length);

    if (compatibles_courses.length > 0 && users_null.length > 0) {

    //   // Modificar o duplicar la funcion Summaries.loadSummaryCoursesByUsersAndCourses
    //   // Agregar los join necesarios para cruzar data con summary topics
    //   /**
    //    *  INNER join topics t on t.course_id = sc.course_id
    //       LEFT OUTER JOIN summary_topics st on st.topic_id = t.id
    //    */

      console.log('keys rows_grouped', Object.keys(rows_grouped));

      const st_compatibles = await loadSummaryCoursesByUsersAndCoursesTopics(
        Object.keys(rows_grouped),
        pluck(compatibles_courses, "id")
      )

      console.log('st_compatibles', st_compatibles)

    //   const compatibles_rows_grouped = groupRowsByCourseId(st_compatibles);


    //   for (const user of rows_grouped) {
    //     if (user.created_at) {
    //       users_to_export.push(user);
    //       continue;
    //     }

    //     const sc_compatible = compatibles_rows_grouped
    //       .filter(
    //         (row) =>
    //           row.user_id == user.id &&
    //           pluck_compatibles_courses.includes(row.course_id)
    //       )
    //       .sort()[0];


    //     if (!sc_compatible) {
    //       users_to_export.push(user);
    //       continue;
    //     }

    //     let user_temp = {
    //       user_id: null,
    //       criterios: await getUserCriterionValues(),
    //       topics: [],
    //     };
    //     sc_compatible.topics.forEach(summary_topic => {

    //       let user_temp = {};

    //       // Armar objeto con datos usuarios, course, topic

    //       user_temp.topics.push(user_temp);
    //     });

    //     users_to_export.push(user_temp);


    //   }

    } else {
      users_to_export = [...users_not_null, ...users_null];
    }

    // for (const user of users_to_export) {


    //   user.topics.forEach(topics => {


    //     // Push each row



    //   });


    // }


  }


  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'ConsolidadoTemas' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}
