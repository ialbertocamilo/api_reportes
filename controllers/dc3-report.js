process.on('message', (requestData) => {
    exportarDC3(requestData);
});

require('../error');
const config = require('../config.js')
const moment = require('moment');
const { response } = require('../response');
const { Op } = require('sequelize');
const { con } = require('../db')
/* helpers */
// const { createAt } = require('../exceljs');
const { zipAndUploadFilesInS3 } = require('../s3/storage')
const { pluck } = require('../helper/Helper')
const fs = require('fs');

async function exportarDC3({ type, cursos,reportName }) {
    const summariesWitDC3 = await loadSummaries(cursos)
    const fileNames = pluck(summariesWitDC3, 'dc3_path');
    const dateFileName = Date.now();
    const zipFileName =dateFileName +'.zip';
    await zipAndUploadFilesInS3(fileNames, zipFileName);
    console.log('End function');
    process.send(response({ createAt: dateFileName,file_ext:'.zip',modulo: 'Dc3' }))
}

async function loadSummaries(
    cursos
) {
    const query = `SELECT user_id,dc3_path FROM summary_courses sc WHERE sc.course_id = ${cursos} and sc.deleted_at is null and sc.dc3_path is not null;`
    const [summaries] = await con.raw(query)
    return summaries
}

