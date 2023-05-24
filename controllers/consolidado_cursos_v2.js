"use strict";
process.on("message", (requestData) => {
  generateSegmentationReport(requestData);
});

require("../error");
const moment = require("moment");
const { workbook, worksheet, createHeaders, createAt } = require("../exceljs");
const { response } = require("../response");
const _ = require('lodash')
let usersCoursesProgress = []
const {
  loadCoursesV3,
  loadUsersSegmented,
  loadUsersSegmentedv2,
  getCountTopics, loadCoursesSegmentedToUsersInSchool
// } = require("../helper/SegmentationHelper");
} = require("../helper/SegmentationHelper_v2");

const {
  loadCoursesStatuses,
  loadCompatiblesId,
  getCourseStatusName,
  getCourseStatusId
} = require("../helper/CoursesTopicsHelper");


const { pluck, logtime, pluckUnique } = require("../helper/Helper");
const { loadSummaryCoursesByUsersAndCourses } = require("../helper/Summaries");
const {
  getGenericHeadersNotasXCurso,
  getWorkspaceCriteria,
} = require("../helper/Criterios");
const {
  loadUsersBySubWorspaceIds,
  loadUsersCriteriaValues,
  getUserCriterionValues,
  getUsersNullAndNotNull,
  getUserCriterionValues2,
} = require("../helper/Usuarios");
const { getSuboworkspacesIds } = require("../helper/Workspace");
const { con } = require('../db')
const { loadUsersCoursesProgress, calculateSchoolProgressPercentage,
  loadUsersWithCourses
} = require('../helper/Courses')

// Headers for Excel file

const headers = [
  'ULTIMA SESIÓN',
  'ESCUELA',
  'AVANCE ESCUELA (%)',
  'CURSO',
  'AVANCE CURSO (%)',
  'VISITAS',
  'NOTA PROMEDIO',
  'RESULTADO CURSO', // convalidado
  'ESTADO CURSO',
  'TIPO CURSO',
  'REINICIOS CURSOS',
  'TEMAS ASIGNADOS',
  'TEMAS COMPLETADOS',
  'ULTIMA EVALUACIÓN',
  'CURSO COMPATIBLE' // nombre del curso
];

async function generateSegmentationReport({
  modulos = [],
  workspaceId,
  cursos,
  escuelas,
  areas,

  aprobados,
  desaprobados,
  desarrollo,
  encuestaPendiente,
  tipocurso,

  CursosActivos = false, // posible filtro en estado de curso
  CursosInactivos = false, // posible filtro en estado de curso

  start: start_date,
  end: end_date,
  UsuariosActivos: activeUsers,
  UsuariosInactivos: inactiveUsers,
  completed = true
}) {
  // Generate Excel file header
  const headersEstaticos = await getGenericHeadersNotasXCurso(
    workspaceId,
    [1, 5, 13, 4, 40, 41]
  );
  await createHeaders(headersEstaticos.concat(headers));

  // Load workspace criteria

  const workspaceCriteria = await getWorkspaceCriteria(
    workspaceId,
    [1, 5, 13, 4, 40, 41]
  );
  const workspaceCriteriaNames = pluck(workspaceCriteria, "name");
  // console.log('workpace_criteria_data: ',{ workspaceCriteria });

  if (modulos.length === 0) {
    modulos = await getSuboworkspacesIds(workspaceId);
  }

  let users_to_export = [];

  //Load Courses
  const courses = await loadCoursesV3({ cursos, escuelas, tipocurso,
                                      CursosActivos, CursosInactivos }, 
                                      modulos);
  const coursesStatuses = await loadCoursesStatuses();

  // console.log('courses_count', courses.length)

  // === filtro de checks === 
  const StateChecks = (aprobados && desaprobados &&
                       desarrollo && encuestaPendiente);
  let StackChecks = [];

  if (aprobados) { StackChecks.push( getCourseStatusId(coursesStatuses, 'aprobado') ) }
  if (desaprobados) { StackChecks.push( getCourseStatusId(coursesStatuses, 'desaprobado') ) }
  if (desarrollo) { StackChecks.push( getCourseStatusId(coursesStatuses, 'desarrollo') ) }
  if (encuestaPendiente) { StackChecks.push( getCourseStatusId(coursesStatuses, 'enc_pend') ) }
  // === filtro de checks ===

  // === precargar usuarios y criterios
  const StackUsersData = await loadUsersBySubWorspaceIds(modulos, true);
  let StackUserCriterios = [];
  // === precargar usuarios y criterios

  // Load progress by user

  usersCoursesProgress = await loadUsersCoursesProgress(escuelas)

  // Load users from database and generate ids array

  const allUsers = await loadUsersWithCourses(
    workspaceId, coursesStatuses,
    modulos, activeUsers, inactiveUsers, escuelas, cursos,
    aprobados, desaprobados, desarrollo, encuestaPendiente, start_date, end_date,
    tipocurso
  )
  const allUsersIds = pluck(allUsers, 'id')

  // Load segmented courses by school for each user

  let segmentedCoursesByUsers
  if (allUsersIds.length) {
    segmentedCoursesByUsers = await loadCoursesSegmentedToUsersInSchool(escuelas, allUsersIds)
  }


  for (const course of courses) {
    logtime(`CURRENT COURSE: ${course.course_id} - ${course.course_name}`);

    // datos usuarios - cursos
    logtime(`-- start: user segmentation --`);
    const users = await loadUsersSegmentedv2(
      course.course_id,
      modulos,
      areas,

      start_date,
      end_date,
      
      activeUsers,
      inactiveUsers,

      completed
    );
    logtime(`-- end: user segmentation --`);


    const countTopics = await getCountTopics(course.course_id);

    // filtro para usuarios nulos y no nulos
    const { users_null, users_not_null } = getUsersNullAndNotNull(users);
    users_to_export = users_not_null;

    console.log( 'total rows', { users_null: users_null.length,
                                 users_not_null: users_not_null.length });

    const compatibles_courses = await loadCompatiblesId(course.course_id);
    const pluck_compatibles_courses = pluck(compatibles_courses, "id");

    if (compatibles_courses.length > 0 && users_null.length > 0) {
      logtime(`INICIO COMPATIBLES`);

      // summary_course verifica si es compatible
      const sc_compatibles = await loadSummaryCoursesByUsersAndCourses(
        pluck(users_null, "id"),
        pluck_compatibles_courses
      );

      for (const user of users_null) {

        //verificar compatible con 'user_id' y 'course_id'
        const sc_compatible = sc_compatibles
          .filter(
            (row) =>
              row.user_id == user.id &&
              pluck_compatibles_courses.includes(row.course_id)
          )
          .sort()[0];

        if (!sc_compatible) {
          users_to_export.push(user); //usercourse
          continue;
        }

        const { course_name, ...RestCompatible} = sc_compatible;

        const additionalData = {
          ...user,
          ...RestCompatible,
          assigned: countTopics,
          course_passed: countTopics,
          course_status_name: 'Convalidado',
          compatible: course_name
        }
        // console.log('additionalData', { user, additionalData } );
        users_to_export.push(additionalData); // usercourse
      }

      logtime(`FIN COMPATIBLES`);
    } else {
      users_to_export = [...users_not_null, ...users_null];
    }

    //exportar usuarios (users_to_export);
    for (const user of users_to_export) {

      // === filtro de checks === 
      if(!StateChecks && !StackChecks.includes(user.course_status_id)) continue;

      const cellRow = [];

      // encontrar usuario por 'id'
      const { id } = user;
      const userStore = StackUsersData[id];
      const lastLogin = moment(userStore.last_login).format("DD/MM/YYYY H:mm:ss");
      cellRow.push(userStore.name);
      cellRow.push(userStore.lastname);
      cellRow.push(userStore.surname);
      cellRow.push(userStore.document);
      cellRow.push(userStore.active === 1 ? "Activo" : "Inactivo");
      cellRow.push(userStore.email);
      // encontrar usuario por 'id'

      // criterios de usuario
      if(StackUserCriterios[id]) {
        const StoreUserValues = StackUserCriterios[id];
        StoreUserValues.forEach((item) => cellRow.push(item.criterion_value || "-"));

      } else {
        const userValues = await getUserCriterionValues2(user.id, workspaceCriteriaNames);
        userValues.forEach((item) => cellRow.push(item.criterion_value || "-"));

        StackUserCriterios[id] = userValues; 
      }
      // criterios de usuario

      const passed = user.course_passed || 0;
      const taken = user.taken || 0;
      const reviewed = user.reviewed || 0;
      const completed = passed + taken + reviewed;

      cellRow.push(lastLogin !== "Invalid date" ? lastLogin : "-");
      cellRow.push(course.school_name);
      cellRow.push(calculateSchoolProgressPercentage(
        usersCoursesProgress, user.id, course.school_id, segmentedCoursesByUsers[user.id]
      ) + '%');
      cellRow.push(course.course_name);
      cellRow.push(
        user.advanced_percentage ? user.advanced_percentage + "%" : "0%"
      );
      cellRow.push(user.course_views || "-");
      cellRow.push(user.grade_average);

      // estado para - 'RESULTADO DE TEMA'
      if(!user.course_status_name) {
        cellRow.push(getCourseStatusName(coursesStatuses, user.course_status_id) || "No iniciado" );
      }else {
        cellRow.push(user.course_status_name);
      }

      cellRow.push(course.course_active === 1 ? "Activo" : "Inactivo");
      cellRow.push(course.course_type || "-");
      cellRow.push(user.course_restarts || "-");
      cellRow.push(user.assigned || '-');
      cellRow.push(Math.round(completed) || 0);
      cellRow.push(
        user.last_time_evaluated_at
          ? moment(user.last_time_evaluated_at).format("DD/MM/YYYY H:mm:ss")
          : "-"
      );
      cellRow.push(user.compatible || `-`);

      // añadir fila 
      worksheet.addRow(cellRow).commit();
    }
    logtime(`FIN addRow`);
  }

  logtime(`FIN Cursos`);

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: "ConsolidadoCompatibleCursos" }));
    });
  } else {
    process.send({ alert: "No se encontraron resultados" });
  }
}
