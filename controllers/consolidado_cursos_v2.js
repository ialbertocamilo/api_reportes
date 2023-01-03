"use strict";
process.on("message", (requestData) => {
  generateSegmentationReport(requestData);
});

require("../error");
const moment = require("moment");
const { workbook, worksheet, createHeaders, createAt } = require("../exceljs");
const { response } = require("../response");
const {
  loadCourses,
  loadUsersSegmented,
  loadUsersSegmentedv2,
} = require("../helper/SegmentationHelper");
const {
  loadCoursesStatuses,
  loadCompatiblesId,
  getCourseStatusName,
  getCourseStatusId
} = require("../helper/CoursesTopicsHelper");

const { pluck, logtime } = require("../helper/Helper");
const { loadSummaryCoursesByUsersAndCourses } = require("../helper/Summaries");
const {
  getGenericHeadersNotasXCurso,
  getWorkspaceCriteria,
} = require("../helper/Criterios");
const {
  loadUsersCriteriaValues,
  getUserCriterionValues,
  getUserCriterionValues2,
} = require("../helper/Usuarios");
const { getSuboworkspacesIds } = require("../helper/Workspace");

// Headers for Excel file

const headers = [
  "ULTIMA SESIÓN",
  "ESCUELA",
  "CURSO",
  "VISITAS",
  "NOTA PROMEDIO",
  "RESULTADO CURSO", // convalidado
  "ESTADO CURSO",
  "TIPO CURSO",
  "REINICIOS CURSOS",
  "TEMAS ASIGNADOS",
  "TEMAS COMPLETADOS",
  "AVANCE (%)",
  "ULTIMA EVALUACIÓN",
  "ESTADO COMPATIBLE" // nombre del curso
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
  const courses = await loadCourses({ cursos, escuelas, tipocurso,
                                      CursosActivos, CursosInactivos }, 
                                      workspaceId);
  const coursesStatuses = await loadCoursesStatuses();


  // === filtro de checks === 
  const StateChecks = (aprobados && desaprobados &&
                       desarrollo && encuestaPendiente);
  let StackChecks = [];

  if (aprobados) { StackChecks.push( getCourseStatusId(coursesStatuses, 'aprobado') ) }
  if (desaprobados) { StackChecks.push( getCourseStatusId(coursesStatuses, 'desaprobado') ) }
  if (desarrollo) { StackChecks.push( getCourseStatusId(coursesStatuses, 'desarrollo') ) }
  if (encuestaPendiente) { StackChecks.push( getCourseStatusId(coursesStatuses, 'enc_pend') ) }
  // ===filtro de checks ===

  for (const course of courses) {
    // Load workspace user criteria

    logtime(`CURSO => ${course.course_name}`);

    const users = await loadUsersSegmentedv2(
      course.course_id,
      modulos,
      areas,

      start_date,
      end_date,
      
      activeUsers,
      inactiveUsers
    );
    logtime(`[loadUsersSegmentedv2]`);

    const users_null = users.filter((us) => us.sc_created_at == null);
    const users_not_null = users.filter((us) => us.sc_created_at != null);
    
    users_to_export = users_not_null;

    const compatibles_courses = await loadCompatiblesId(course.course_id);
    const pluck_compatibles_courses = pluck(compatibles_courses, "id");
    

    // console.log('compatibles_courses',{compatibles_courses, users_null_length: users_null.length})
    if (compatibles_courses.length > 0 && users_null.length > 0) {
      logtime(`INICIO COMPATIBLES`);

      // obtener usuarios por cursos compatibles
      const sc_compatibles = await loadSummaryCoursesByUsersAndCourses(
        pluck(users_null, "id"),
        pluck(compatibles_courses, "id")
      );

      for (const user of users_null) {
        if (user.sc_created_at) {
          users_to_export.push(user);
          continue;
        }

        // encontrar usuario compatible
        const sc_compatible = sc_compatibles
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

        const { id, name, 
                lastname, 
                surname, 
                document, 
                email, 
                active, 
                last_login } = user;
          
        const { school_name, 
                  
                course_name, 
                course_status_id, 
                course_passed,
                course_restarts, 
                course_views,

                grade_average, 
                advanced_percentage,
                assigned, 
                completed,
                taken, 
                reviewed, 
                last_time_evaluated_at

              } = sc_compatible;

        const temp = { 
            id, name, 
            lastname, 
            surname, 
            document, 
            email,
            active, 
            last_login,

            school_name, 
            course_name, 
            course_status_id,
            course_passed, 
            course_restarts, 
            course_views,

            grade_average, 
            advanced_percentage,
            assigned, 
            completed,
            taken, reviewed,
            last_time_evaluated_at,
            
            compatible: `${course_name}.`
        };

        users_to_export.push({...temp, course_status_name: 'Convalidado' });
      }
    } else {
      users_to_export = [...users_not_null, ...users_null];
    }

    //exportar usuarios (users_to_export);
    for (const user of users_to_export) {

      // === filtro de checks === 
      if(!StateChecks && !StackChecks.includes(user.course_status_id)) continue;

      const cellRow = [];
      const lastLogin = moment(user.last_login).format("DD/MM/YYYY H:mm:ss");

      cellRow.push(user.name);
      cellRow.push(user.lastname);
      cellRow.push(user.surname);
      cellRow.push(user.document);
      cellRow.push(user.active === 1 ? "Activo" : "Inactivo");
      cellRow.push(user.email);

      // criterios de usuario
      const userValues = await getUserCriterionValues2(user.id,workspaceCriteriaNames);
      userValues.forEach((item) => cellRow.push(item.criterion_value || "-"));
      // criterios de usuario

      const passed = user.course_passed || 0;
      const taken = user.taken || 0;
      const reviewed = user.reviewed || 0;
      const completed = passed + taken + reviewed;

      cellRow.push(lastLogin !== "Invalid date" ? lastLogin : "-");
      cellRow.push(course.school_name);
      cellRow.push(course.course_name);
      cellRow.push(user.course_views || "-");
      cellRow.push(user.course_passed > 0 ? user.grade_average : "-");

      // estado para - 'RESULTADO DE TEMA'
      if(!user.course_status_name) {
        cellRow.push(getCourseStatusName(coursesStatuses, user.course_status_id) || "No iniciado" );
      }else {
        cellRow.push(user.course_status_name);
      }

      cellRow.push(course.course_active === 1 ? "Activo" : "Inactivo");
      cellRow.push(course.course_type || "-");
      cellRow.push(user.course_restarts || "-");
      cellRow.push(user.assigned || 0);
      cellRow.push(Math.round(completed) || 0);
      cellRow.push(
        user.advanced_percentage ? user.advanced_percentage + "%" : "0%"
      );
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
