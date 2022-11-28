"use strict";
process.on("message", (requestData) => {
  generateSegmentationReport(requestData);
});

require("../error");
const moment = require("moment");
const { workbook, worksheet, createHeaders, createAt } = require("../exceljs");
const { response } = require("../response");
const {
  loadUsersSegmented,
  loadCourses,
} = require("../helper/SegmentationHelper");
const { loadCoursesStatuses, loadCompatibles } = require("../helper/CoursesTopicsHelper");

const { con } = require("../db");
const { pluck } = require("../helper/Helper");
const { loadSummaryCoursesByUsersAndCourses } = require("../helper/Summaries");

// Headers for Excel file

const headers = [
  "Nombre",
  "Apellido Paterno",
  "Apellido Materno",
  "Documento",
  "EMAIL",
  "ESCUELA",
  "CURSO",
  "PROMEDIO",
  "AVANCE (%)",
  "RESULTADO CURSO",
];

async function generateSegmentationReport({ cursos, escuelas }) {

  const headersEstaticos = await getGenericHeadersNotasXCurso(workspaceId,[1,5,13,4,40,41])
  await createHeaders(headersEstaticos.concat(headers))


  // Generate Excel file header
  await createHeaders(headers);
  let users_to_export = [];
  //Load Courses
  const courses = await loadCourses({ cursos, escuelas });
  const coursesStatuses = await loadCoursesStatuses();
  for (const course of courses) {
    const users = await loadUsersSegmented(course.course_id);
    const users_null = users.filter((us) => us.grade_average == null);
    const users_not_null = users.filter((us) => us.grade_average != null);
    users_to_export = users_not_null;
    const compatibles = await loadCompatibles(course.id);

    const sc_compatibles = await loadSummaryCoursesByUsersAndCourses(
      users_null,
      pluck(compatibles, 'id')
    );

    for (const user in users_null) {
      const sc_compatible = sc_compatibles
        .filter((row) => row.user_id == user.id && course_id == course.id)
        .sort((row) => row.grade_average)[0];
      if (sc_compatible) {
        const { name, lastname, surname, document, email } = user;
        const { school_name, course_name, grade_average, advanced_percentage, status_id } =
          sc_compatible;
        const temp = {
          name,
          lastname,
          surname,
          document,
          email,

          school_name,
          course_name,
          grade_average,
          advanced_percentage,
          status_id
        };

        users_to_export.push(temp);
      }
    }
  }

  for (const user of users_to_export) {
    const cellRow = [];
    const user_status = user.status_id
      ? coursesStatuses.find((status) => status.id == user.status_id)
      : { name: "Pendiente" };
    cellRow.push(user.name);
    cellRow.push(user.lastname);
    cellRow.push(user.surname);
    cellRow.push(user.document);
    cellRow.push(user.email);
    cellRow.push(course.school_name);
    cellRow.push(course.course_name);
    cellRow.push(user.grade_average || "-");
    cellRow.push(
      user.advanced_percentage ? user.advanced_percentage + "%" : "0%"
    );
    cellRow.push(user_status.name);
    worksheet.addRow(cellRow).commit();
  }

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: "SegmentaciónCursos" }));
    });
  } else {
    process.send({ alert: "No se encontraron resultados" });
  }
}
