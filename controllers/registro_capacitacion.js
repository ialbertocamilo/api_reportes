process.on('message', (requestData) => {
  exportarRegistroCapacitacion(requestData);
});

require('../error');
const config = require('../config.js')
const moment = require('moment');
const { response } = require('../response');
const { Op } = require('sequelize');
const { con } = require('../db')

const { AWS_ENDPOINT, AWS_BUCKET_NAME, MARCA } = require('../config.js')
const { zipAndUploadFilesInS3 } = require('../s3/storage')
const { pluck } = require('../helper/Helper')
const fs = require('fs');

async function exportarRegistroCapacitacion({
  type, modulesIds, schoolsIds, coursesIds
}) {


  const summariesWithRegistros = await loadSummaries(coursesIds)
  if (summariesWithRegistros.length === 0) {
    process.send({ alert: 'No se encontraron resultados' })
  }

  const filenames = pluck(summariesWithRegistros, 'registro_capacitacion_path');

  let urls = []
  filenames.forEach(filename => {

    // Trim slash from relative path

    urls.push(filename.replace(/^\/|\/$/g, ''));
  })

  const dateFileName = Date.now();
  const zipFileName = dateFileName +'.zip';
  await zipAndUploadFilesInS3(urls, zipFileName);

  console.log('End function');

  process.send(response({
    createAt: dateFileName, file_ext:'.zip', modulo: 'RegistroCapacitacion'
  }))
}

async function loadSummaries(coursesIds) {

  const query = `
    select user_id, registro_capacitacion_path 
    from summary_courses sc 
    where 
        sc.course_id in (${coursesIds.join(',')})
        and sc.deleted_at is null 
        and sc.registro_capacitacion_path is not null;`

  const [summaries] = await con.raw(query)
  return summaries
}

