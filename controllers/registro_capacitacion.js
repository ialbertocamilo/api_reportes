process.on('message', (requestData) => {
  exportarRegistroCapacitacion(requestData);
});

require('../error');

const { response } = require('../response');
const { Op } = require('sequelize');
const { con } = require('../db')
const { zipAndUploadFilesInS3 } = require('../s3/storage')
const { pluck } = require('../helper/Helper')
const fs = require('fs');
const { worksheet, workbook, createAt, createHeaders } = require('../exceljs')
const Excel = require('exceljs')
const { CARPETA_DESCARGA } = require('../config')
const { loadUsersSegmentedv2 } = require('../helper/SegmentationHelper_v2')

async function exportarRegistroCapacitacion({
  format, modulesIds, schoolsIds, coursesIds
}) {

  let defaultHeaders = [
    'Módulo',
    'Nombre completo',
    'Documento de identidad',
    'Curso',
    'Firmó'
  ];

  //  Generate Excel file
  // ----------------------------------------

  if (format === 'xlsx') {
    await createHeaders(defaultHeaders)

    const courses = await con('courses').where('id', coursesIds[0]);
    const summaries = await loadSummaries(modulesIds, coursesIds[0]);
    summaries.forEach(summary => {
      const cellRow = []

      cellRow.push(summary.subworkspace)
      cellRow.push(`${summary.name} ${summary.lastname} ${summary.surname}`)
      cellRow.push(summary.document)
      cellRow.push(courses[0].name)
      cellRow.push(summary.registro_capacitacion_path ? 'Sí' : 'No')

      worksheet.addRow(cellRow).commit()
    })

    if (worksheet._rowZero > 1) {
      workbook.commit().then(() => {
        process.send(response({ createAt, modulo: 'RegistroCapacitacion' }))
      })
    } else {
      process.send({ alert: 'No se encontraron resultados' })
    }
  }

  //  Generate ZIP file with PDFs files
  // ----------------------------------------

  if (format === 'zip') {

    const summariesWithRegistros = await loadSignedSummaries(modulesIds, coursesIds)
    if (summariesWithRegistros.length === 0) {
      process.send({ alert: 'No se encontraron resultados' })
    }

    const filenames = pluck(summariesWithRegistros, 'registro_capacitacion_path')
    let urls = []
    filenames.forEach(filename => {

      // Trim slash from relative path

      urls.push(filename.replace(/^\/|\/$/g, ''));
    })

    const dateFileName = Date.now();
    const zipFileName = dateFileName +'.zip';
    await zipAndUploadFilesInS3(urls, zipFileName);

    process.send(response({
      createAt: dateFileName, file_ext:'.zip', modulo: 'RegistroCapacitacionzip'
    }))
  }
}

async function loadSignedSummaries(modulesIds, coursesIds) {

  const query = `
    select user_id, registro_capacitacion_path 
    from users u
      inner join summary_courses sc on u.id = sc.user_id
    where 
      sc.course_id in (${coursesIds.join(',')})
      and u.subworkspace_id in (${modulesIds.join(',')})
      and sc.deleted_at is null 
      and sc.registro_capacitacion_path is not null;`

  const [summaries] = await con.raw(query)
  return summaries
}

async function loadSummaries(modulesIds, courseId) {

  const usersSegmented = await loadUsersSegmentedv2(
    courseId,
    modulesIds,
    [],
    null,
    null,

    1,
    0,
    false
  );
  const usersIds = pluck(usersSegmented, 'id')
  if (!usersIds.length) return;

  const query = `
    select 
      u.name,
      u.lastname,
      u.surname,
      u.document,
      w.name subworkspace,
      sc.registro_capacitacion_path 
    from users u 
      inner join workspaces w on w.id = u.subworkspace_id
      left join summary_courses sc on u.id = sc.user_id
    where 
      sc.course_id = ${courseId}
      and u.id in (${usersIds.join(',')})
      and sc.deleted_at is null`

  const [summaries] = await con.raw(query)
  return summaries
}

