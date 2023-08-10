process.on('message', requestData => {
  evaluationsData(requestData);
})

require('../error')
const moment = require('moment')
moment.locale('es')
const { loadAllEvaluationsResults } = require('../helper/EvaluationsHelper')

async function evaluationsData (indata) {
  const topicResultData = await loadAllEvaluationsResults(indata);

  // === DATOS JSON ===
  process.send({
    data: topicResultData
  })
  // === DATOS JSON ===
}