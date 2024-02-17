process.on('message', (requestData) => {
    exportAssists(requestData);
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

async function exportAssists({  }) {
    const data = await loadAssists();
    console.log(data);
    process.send(response({ data: data,file_ext:'.zip',modulo: 'Dc3' }))
    // if(data.length == 0){
    //     process.send({ alert: 'No se encontraron resultados' })
    // }
    // const fileNames = pluck(data, 'dc3_path');
    // const dateFileName = Date.now();
    // const zipFileName =dateFileName +'.zip';
    // await zipAndUploadFilesInS3(fileNames, zipFileName);
    // console.log('End function');
    process.send(response({ createAt: dateFileName,file_ext:'.zip',modulo: 'Dc3' }))
}

async function loadAssists() {
    const query = `SELECT id,user_id,status_id,date_assistance,signature FROM topic_assistance_user;`
    const [summaries] = await con.raw(query)
    return summaries
}

