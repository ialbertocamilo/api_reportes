process.on('message', requestData => {
  evaluationsExcel(requestData)
})

require('../error')
const moment = require('moment')
const { response } = require('../response')
moment.locale('es')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs');
const { loadAllEvaluationsResults } = require('../helper/EvaluationsHelper');

const defaultHeaders = [
    'MÓDULO', // modulo user,
    'ESCUELA',
    'CURSO',
    'TEMA',
    'CORRECTAS',
    'INCORRECTAS',
    'TOTAL DE EVALUACIONES',
];

async function evaluationsExcel(indata) {
  const topicResultData = await loadAllEvaluationsResults(indata);

  await createHeaders(defaultHeaders);

  for (const topic of topicResultData) {
    const cellRow = [];

    cellRow.push(topic.subworkspaces_names);
    cellRow.push(topic.school_name);
    cellRow.push(topic.course_name);
    cellRow.push(topic.topic_name);
    cellRow.push(topic.total_corrects);
    cellRow.push(topic.total_incorrects);
    cellRow.push(topic.total_evaluations);

    worksheet.addRow(cellRow).commit();
  }

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'Resumen de evaluaciones' }));
    });
  } else {
    process.send({ alert: "No se encontraron resultados" });
  }
}