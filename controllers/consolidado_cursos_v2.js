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
  getCourseStatusId, calculateTopicsReviewedPercentage,
  loadTopicQualificationTypes,
  getTopicCourseGrade,
  loadModalities,
} = require("../helper/CoursesTopicsHelper");


const { pluck, logtime, pluckUnique, calculateUserSeniorityRange, setCustomIndexAtObject,
  generateSqlScript
} = require("../helper/Helper");
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
const { getSuboworkspacesIds, loadWorkspace } = require("../helper/Workspace");
const { con } = require('../db')
const { loadUsersCoursesProgress, calculateSchoolProgressPercentage,
  loadUsersWithCourses, loadSummaryTopicsCount,
  calculateSchoolAccomplishmentPercentage, countCoursesActiveTopics,
  calculateCourseAccomplishmentPercentage
} = require('../helper/Courses')

// Headers for Excel file

const headers = [
  'ULTIMA SESIÓN',
  'ESCUELA',
  'MODALIDAD',
  'CURSO',
  'APROBACIÓN CURSO',
  'VISITAS',
  'SISTEMA DE CALIFICACIÓN',
  'NOTA PROMEDIO',
  'RESULTADO CURSO', // convalidado
  'ESTADO CURSO',
  'TIPO CURSO',
  'REINICIOS CURSOS',
  'TEMAS ASIGNADOS',
  'TEMAS COMPLETADOS',
  'ULTIMA EVALUACIÓN (FECHA)',
  'ULTIMA EVALUACIÓN (HORA)',
  'CURSO COMPATIBLE' // nombre del curso
];

async function generateSegmentationReport({
  modulos = [],
  workspaceId,
  format,

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



  // Homecenters Peruanos -> id 11
  let isPromart = (workspaceId === 11 && format !== "sql")
  if (isPromart) {
    let schoolProgressIndex = 2
    headers.splice(schoolProgressIndex, 0, 'CUMPLIMIENTO ESCUELA');
    headers.splice(schoolProgressIndex, 0, 'APROBACIÓN ESCUELA');
    headers.unshift('RANGO DE ANTIGÜEDAD')

    headers.splice(8, 0, 'CUMPLIMIENTO CURSO');
  }

  // Generate Excel file header
  let defaultsCriteriaIds = (format === 'sql')
    ? [1, 2, 7, 28, 40, 41]
    : []

  let headersEstaticos = await getGenericHeadersNotasXCurso(workspaceId, defaultsCriteriaIds)

  await createHeaders(headersEstaticos.concat(headers));

  // Load workspace criteria

  const workspaceCriteria = await getWorkspaceCriteria(workspaceId, defaultsCriteriaIds);
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

  const modalities = await loadModalities();
  // load qualification types
  
  let QualificationTypes = await loadTopicQualificationTypes();
      QualificationTypes = setCustomIndexAtObject(QualificationTypes);

  // console.log('courses_count', courses.length)

  // === filtro de checks === 
  const allStatusesChecked = (aprobados && desaprobados &&
                       desarrollo && encuestaPendiente);
  let selectedStatuses = [];

  if (aprobados) { selectedStatuses.push( getCourseStatusId(coursesStatuses, 'aprobado') ) }
  if (desaprobados) { selectedStatuses.push( getCourseStatusId(coursesStatuses, 'desaprobado') ) }
  if (desarrollo) { selectedStatuses.push( getCourseStatusId(coursesStatuses, 'desarrollo') ) }
  if (encuestaPendiente) { selectedStatuses.push( getCourseStatusId(coursesStatuses, 'enc_pend') ) }
  // === filtro de checks ===

  // === precargar usuarios y criterios
  const StackUsersData = await loadUsersBySubWorspaceIds(modulos, true);
  let StackUserCriterios = [];
  // === precargar usuarios y criterios

  // Load users from database and generate ids array

  const allUsers = await loadUsersWithCourses(
    workspaceId, coursesStatuses,
    modulos, activeUsers, inactiveUsers, escuelas, cursos,
    aprobados, desaprobados, desarrollo, encuestaPendiente, start_date, end_date,
    tipocurso
  )
  const allUsersIds = pluck(allUsers, 'id')

  let segmentedCoursesByUsers = []
  if (isPromart) {
    // Load progress by user

    usersCoursesProgress = await loadUsersCoursesProgress(escuelas)

    // Load segmented courses by school for each user

    if (allUsersIds.length) {
      segmentedCoursesByUsers = await loadCoursesSegmentedToUsersInSchool(escuelas, allUsersIds)
    }
  }

  // Count summary topics and course topics
  const coursesIds = pluck(courses, 'course_id')
  const coursesTopics = await countCoursesActiveTopics(coursesIds)
  const summaryTopicsCount = await loadSummaryTopicsCount(coursesIds, allUsersIds)

  let rowsToBeExported = [];
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
          assigned:  0,
          course_passed: 0,
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

      const statusName = getCourseStatusName(coursesStatuses, user.course_status_id);

      // 'No iniciado' does not exist in database, so it has no name,
      // and no filter, other statuses have a name and a filter so check
      // those cases

      if( !allStatusesChecked &&
          !selectedStatuses.includes(user.course_status_id) &&
          statusName) {
        continue;
      }

      const cellRow = [];

      // encontrar usuario por 'id'
      const { id } = user;
      const userStore = StackUsersData[id];
      if (!userStore) continue;

      const lastLogin = moment(userStore.last_login).format("DD/MM/YYYY H:mm:ss");
      cellRow.push(userStore.name);
      cellRow.push(userStore.lastname);
      cellRow.push(userStore.surname);
      cellRow.push(userStore.document);
      cellRow.push(userStore.active === 1 ? "Activo" : "Inactivo");
      cellRow.push(userStore.email);
      if (process.env.MARCA === 'inretail-test2') { cellRow.push(userStore.phone_number) }
      // encontrar usuario por 'id'

      // criterios de usuario
      if(StackUserCriterios[id]) {
        const StoreUserValues = StackUserCriterios[id];
        StoreUserValues.forEach((item) => cellRow.push(item.criterion_value || "-"));

      } else {
        const userValues =
          await getUserCriterionValues2(user.id, workspaceCriteriaNames, defaultsCriteriaIds);
        userValues.forEach((item) => cellRow.push(item.criterion_value || "-"));

        StackUserCriterios[id] = userValues; 
      }

      if (isPromart) {

        let startDateCriteria = StackUserCriterios[id].find(c =>
          c.criterion_name === 'Date_Start')
        let seniorityValue = '-'

        if (startDateCriteria) {
          seniorityValue = calculateUserSeniorityRange(startDateCriteria.criterion_value)
        }

        cellRow.push(seniorityValue);
      }

      // criterios de usuario

      const passed = user.course_passed || 0;
      const taken = user.taken || 0;
      const reviewed = user.reviewed || 0;
      const completed = passed + taken + reviewed;
      const userSummaryTopicsCount = summaryTopicsCount.filter(stc => +stc.user_id === +user.id)

      cellRow.push(lastLogin !== "Invalid date" ? lastLogin : "-");
      cellRow.push(course.school_name);

      if (isPromart) {
        const schoolTotals = calculateSchoolProgressPercentage(
          usersCoursesProgress, user.id, course.school_id, segmentedCoursesByUsers[user.id]
        )
        cellRow.push((schoolTotals.schoolPercentage || 0) + '%');
        cellRow.push((calculateSchoolAccomplishmentPercentage(coursesTopics, userSummaryTopicsCount, segmentedCoursesByUsers[user.id], course.school_id) || 0) + '%')
      }
      const modality = modalities.find(m => m.id == course.modality_id);
      cellRow.push(modality ? modality.name : '-');
      cellRow.push(course.course_name);
      const qualification = QualificationTypes[course.qualification_type_id];
      
      cellRow.push(
        user.advanced_percentage ? user.advanced_percentage + "%" : "0%"
      );

      if (isPromart) {
        cellRow.push((calculateCourseAccomplishmentPercentage(course.course_id, coursesTopics, userSummaryTopicsCount) || 0) + '%')
      }

      cellRow.push(user.course_views || "-");
      cellRow.push(qualification.name); // tipo calificacion
      cellRow.push(getTopicCourseGrade(user.grade_average, qualification.position)); //promedio

      // estado para - 'RESULTADO DE TEMA'
      if(!user.course_status_name) {
        cellRow.push(statusName || "No iniciado" );
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
          ? moment(user.last_time_evaluated_at).format("DD/MM/YYYY ")
          : "-"
      );
      cellRow.push(
        user.last_time_evaluated_at
          ? moment(user.last_time_evaluated_at).format("H:mm:ss")
          : "-"
      );

      cellRow.push(user.compatible || `-`);

      // añadir fila 
      worksheet.addRow(cellRow).commit();

      if (format === 'sql')  {
        rowsToBeExported.push(cellRow)
      }

    }
    logtime(`FIN addRow`);
  }

  logtime(`FIN Cursos`);

  if (worksheet._rowZero > 1) {

    if (format === 'sql')  {
      const workspace = await loadWorkspace(workspaceId)
      const timestamp = Math.floor((new Date).getTime() / 1000)
      generateSqlScript(
        'notas_curso',
        workspace.name,
        headersEstaticos.concat(headers),
        rowsToBeExported,
        `consolidado-notas-${workspace.name}-${timestamp}`
      )
    }

    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: "ConsolidadoCompatibleCursos" }));
    });
  } else {
    process.send({ alert: "No se encontraron resultados" });
  }
}
