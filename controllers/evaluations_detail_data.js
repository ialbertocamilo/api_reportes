process.on('message', requestData => {
  evaluationsDetailData(requestData)
})

require('../error')
const moment = require('moment')
moment.locale('es')
const { loadAllEvaluationsDetailsResults } = require('../helper/EvaluationsHelper')

async function evaluationsDetailData(indata) {  
  const topicQuestionsResultData = await loadAllEvaluationsDetailsResults(indata);

  // === DATOS JSON ===
  process.send({
    data: topicQuestionsResultData
  })
  // === DATOS JSON ===
}