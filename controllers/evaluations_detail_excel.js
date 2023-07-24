process.on('message', requestData => {
  evaluationsDetailExcel(requestData)
})

require('../error')
const moment = require('moment')
const { response } = require('../response')
moment.locale('es')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs');
const { loadAllEvaluationsDetailsResults } = require('../helper/EvaluationsHelper')

const defaultHeaders = [
    'MÓDULO', // modulo user,
    'ESCUELA',
    'CURSO',
    'TEMA',
    'PREGUNTA',
    'CORRECTAS',
    'INCORRECTAS',
    'TOTAL DE EVALUACIONES',
];

async function evaluationsDetailExcel(indata) {
  const topicQuestionsResultData = await loadAllEvaluationsDetailsResults(indata);

  await createHeaders(defaultHeaders);
  
  for (const question of topicQuestionsResultData) {
    const cellRow = [];

    cellRow.push(question.subworkspaces_names);
    cellRow.push(question.school_name);
    cellRow.push(question.course_name);
    cellRow.push(question.topic_name);
    cellRow.push(question.question_name);
    cellRow.push(question.total_corrects);
    cellRow.push(question.total_incorrects);
    cellRow.push(question.total_evaluations);

    worksheet.addRow(cellRow).commit();
  }

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'Resumen detalle de evaluaciones' }));
    });
  } else {
    process.send({ alert: "No se encontraron resultados" });
  }
}