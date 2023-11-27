const { con } = require('../db');
const { decode } = require('html-entities');
const { setCustomIndexAtObject, strippedString, groupArrayOfObjects_v2 } = require('../helper/Helper'); 

async function loadAllEvaluationsResults({ type, modulos, escuelas, cursos, temas, start, end}) {

  const topicResult = await loadTopicResults(cursos, temas, start, end);
  let schoolsSubworkspacesResult = await loadSchoolsSubworkspaces(escuelas);
      schoolsSubworkspacesResult = groupArrayOfObjects_v2(schoolsSubworkspacesResult, 'school_id');

  let topicResultData = [];

  for(const topic of topicResult) {
    const { 
            school_id, 

            topic_id,  
            school_name,
            course_name,
            topic_name,
            total_evaluations,
            total_corrects,
            total_incorrects
          } = topic;
    const subworkspaces = schoolsSubworkspacesResult[school_id];



    if (subworkspaces) {
      const subworkspaces_names = subworkspaces.filter((ele) => modulos.includes(ele.id) )
        .map((ele) => ele.name)
        .join(', ');
      topicResultData.push({
        topic_id,
        subworkspaces_names,
        school_name,
        course_name,
        topic_name,
        total_corrects: total_corrects || 0,
        total_incorrects: total_incorrects || 0,
        total_evaluations
      });
    }
  }
  return topicResultData
} 

async function loadTopicResults(cursos, temas, start, end) {

  const evaluationType = await con('taxonomies').where('group', 'topic').where('code', 'qualified');
  const type = evaluationType[0];

  let statusTypes = await con('taxonomies').select('id').where('group', 'topic')
                                           .where('type', 'user-status').whereIn('code', ['aprobado','desaprobado']);
  statusTypes = statusTypes.map((ele) => ele.id);

  // fecha inicio - fin
  let whereConditionSumaryTopic = `and summary_topics.status_id in(${statusTypes.join()})`;
  if(start) whereConditionSumaryTopic += ` and summary_topics.last_time_evaluated_at >= '${start}'`;
  if(end) whereConditionSumaryTopic += ` and summary_topics.last_time_evaluated_at <= '${end}'`;
  // console.log(whereConditionSumaryTopic);

  let query = `
  SELECT  
          t.id as topic_id, 
          t.name as topic_name, 
          t.course_id, 
          t.assessable,
          c.name as course_name,
          c.code as course_code,
          s.id as school_id,
          s.name as school_name,

  (SELECT count(*) FROM summary_topics WHERE t.id = summary_topics.topic_id and summary_topics.deleted_at IS NULL ${whereConditionSumaryTopic}) AS total_evaluations, 
  (SELECT sum(summary_topics.correct_answers) FROM summary_topics WHERE t.id = summary_topics.topic_id and summary_topics.deleted_at IS NULL ${whereConditionSumaryTopic}) AS total_corrects, 
  (SELECT sum(summary_topics.failed_answers) FROM summary_topics WHERE t.id = summary_topics.topic_id and summary_topics.deleted_at IS NULL ${whereConditionSumaryTopic}) AS total_incorrects 
 
  FROM topics t 
  
  INNER JOIN courses c ON c.id = t.course_id
  INNER JOIN course_school cs ON cs.course_id = c.id
  INNER JOIN schools s ON s.id = cs.school_id

  WHERE t.course_id in (${cursos.join()}) and t.assessable = 1 and t.type_evaluation_id = ${type.id}`;
  
/*  
  sin fecha
  (SELECT count(*) FROM summary_topics WHERE t.id = summary_topics.topic_id and summary_topics.deleted_at IS NULL) AS total_evaluations, 
  (SELECT sum(summary_topics.correct_answers) FROM summary_topics WHERE t.id = summary_topics.topic_id and summary_topics.deleted_at IS NULL) AS total_corrects, 
  (SELECT sum(summary_topics.failed_answers) FROM summary_topics WHERE t.id = summary_topics.topic_id and summary_topics.deleted_at IS NULL) AS total_incorrects 
  
  con fecha
  (SELECT count(*) FROM summary_topics WHERE t.id = summary_topics.topic_id and summary_topics.deleted_at IS NULL ${whereConditionSumaryTopic}) AS total_evaluations, 
  (SELECT sum(summary_topics.correct_answers) FROM summary_topics WHERE t.id = summary_topics.topic_id and summary_topics.deleted_at IS NULL ${whereConditionSumaryTopic}) AS total_corrects, 
  (SELECT sum(summary_topics.failed_answers) FROM summary_topics WHERE t.id = summary_topics.topic_id and summary_topics.deleted_at IS NULL ${whereConditionSumaryTopic}) AS total_incorrects 
*/
  
  if(temas.length) query += ` and t.id in (${temas.join()})`;
  query += ` and t.deleted_at IS NULL`;
  
  // console.log(query);
  const [ rows ] = await con.raw(query);

  return rows;
}

async function loadSchoolsSubworkspaces(escuelas) {

  let query = `
    SELECT 

      w.id, 
      w.name,
      ssw.school_id AS school_id, 
      ssw.subworkspace_id AS subworkspace_id 

    FROM workspaces w
    INNER JOIN school_subworkspace ssw ON w.id = ssw.subworkspace_id 
    WHERE 
    ssw.school_id in (${escuelas.join()}) 
    and w.deleted_at IS NULL
  `;

  const [ rows ] = await con.raw(query);

  return rows;
}


async function loadAllEvaluationsDetailsResults({ topicId, evaluations = [], temas, start, end }) {

  const temas_ids = topicId ? [ topicId ] : temas;
  
  // evaluations
  let EvaluationsInData = setCustomIndexAtObject(evaluations, 'topic_id');

  // questions
  let questions = await loadQuetions(temas_ids);
      questions = setCustomIndexAtObject(questions);
  
  // summaries
  let summariesResults = await loadSummariesTopic(temas_ids, start, end);
  let TopicsQuestionsData = {};

  for(const summarie of summariesResults) {
    const { answers } = summarie;

    for(const answer of answers) {

      const { preg_id, opc } = answer;
      const { rpta_ok } = questions[preg_id];
      const is_correct = (opc == rpta_ok);

      // === total evaluaciones ===
      if(TopicsQuestionsData[preg_id]) {
        TopicsQuestionsData[preg_id].total_evaluations ++;

        // correctas - incorrectas
        if (is_correct) {
          TopicsQuestionsData[preg_id].total_corrects ++;
        }else{
          TopicsQuestionsData[preg_id].total_incorrects ++;
        }
        // correctas - incorrectas

      }else {
      
        TopicsQuestionsData[preg_id] = {
          total_evaluations: 1,
          total_corrects: (is_correct) ? 1 : 0,
          total_incorrects: (is_correct) ? 0 : 1
        }
      
      }
      // === total evaluaciones ===
    }
  }

  let TopicsQuestionsResult = [];
  for(const question in questions) {

    const { id: question_id, pregunta: question_name, topic_id } = questions[question];
    const { total_evaluations, total_corrects, total_incorrects } = TopicsQuestionsData[question] || { total_evaluations: 0, total_corrects:0, total_incorrects: 0 }
    const { subworkspaces_names, school_name, course_name, topic_name } = EvaluationsInData[topic_id];

    TopicsQuestionsResult.push({
      // === by api reusable ===
      subworkspaces_names,
      school_name, 
      course_name, 
      topic_name,
      // === by api reusable ===
      question_id,
      question_name: decode(strippedString(question_name)),
      total_evaluations, 
      total_corrects, 
      total_incorrects
    });
  }

  return TopicsQuestionsResult;
} 

async function loadQuetions(temas) {
  let query = ` 
    SELECT  q.id,
            q.pregunta,
            q.rpta_ok,
            q.topic_id
    FROM 
      questions q
    WHERE 
      q.topic_id in(${temas.join()})
    and q.topic_id IS not NULL
    and q.deleted_at IS NULL
  `;

  const [ rows ] = await con.raw(query);
  
  return rows;
}

async function loadSummariesTopic(temas, start, end) {

  // fecha inicio - fin
  let whereConditionSumaryTopic = '';
  if(start) whereConditionSumaryTopic = ` and st.last_time_evaluated_at >= '${start}'`;
  if(end) whereConditionSumaryTopic += ` and st.last_time_evaluated_at <= '${end}'`;
  // fecha inicio - fin

  let query = `
    SELECT  st.id, 
            st.answers,
            st.status_id,
            st.topic_id
    FROM summary_topics st
    WHERE st.topic_id in(${temas.join()})
    and st.topic_id IS not NULL
    and st.answers IS not NULL
    and st.deleted_at IS NULL

    ${whereConditionSumaryTopic}
    `;

  const [ rows ] = await con.raw(query);

  return rows;
}

module.exports = {
  loadAllEvaluationsResults,
  loadAllEvaluationsDetailsResults
}
