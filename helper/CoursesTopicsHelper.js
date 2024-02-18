const { con } = require("../db");
const { uniqueElements, setCustomIndexAtObject, pluck } = require("./Helper");
/**
 * Filter user course status using its id, and return its name
 * @param userCourseStatuses
 * @param statusId
 */
exports.getCourseStatusName = (userCourseStatuses, statusId) => {
  const status = userCourseStatuses.find((st) => st.id === statusId);
  return status ? status.name : null;
};

/**
 * Filter user course status using its code, and return its id
 * @param userCourseStatuses
 * @param code
 * @returns {*|null}
 */
exports.getCourseStatusId = (userCourseStatuses, code) => {
  const status = userCourseStatuses.find((st) => st.code === code);
  return status ? status.id : null;
};

/**
 * Filter evaluation type using its id, and return its name
 * @param evaluationTypes
 * @param id
 */
exports.getEvaluationTypeName = (evaluationTypes, id) => {
  const evaluationType = evaluationTypes.find((et) => et.id === id);
  return evaluationType ? evaluationType.name : "No evaluable";
};

/**
 * Load evaluation types from Taxonomies table
 */
exports.loadEvaluationTypes = async () => {
  return con("taxonomies")
    .where("group", "topic")
    .where("type", "evaluation-type");
};

/**
 * Load courses statuses list from database
 */
exports.loadCoursesStatuses = async () => {
  return con("taxonomies")
    .where("group", "course")
    .where("type", "user-status");
};

/**
 * Load topics statuses list from database
 */
exports.loadTopicsStatuses = async () => {
  return con("taxonomies").where("group", "topic").where("type", "user-status");
};
exports.loadModalities=async()=>{
  return await con("taxonomies").select('id','name','code').where("group", "course").where("type", "modality");
}
exports.loadAssistances=async(course_id,type='in-person')=>{
  let assistances = [];
  switch (type) {
    case 'in-person':
      assistances = await con('topic_assistance_user as tau')
                  .select('topic_id', 'user_id', 't.name as status_name', 'date_assistance')
                  .join('taxonomies as t', 't.id', '=', 'tau.status_id')
                  .join('topics as to', 'to.id', '=', 'tau.topic_id')
                  .where('to.course_id',course_id);
    break;
    case 'virtual':
      assistances = await con('meetings as m')
                  .select('t.id as topic_id',
                          'a.usuario_id as user_id', 
                          con.raw('IF(a.present_at_first_call = 1, "Asistió", "No asistió") as present_at_first_call'),
                          con.raw('IF(a.present_at_middle_call = 1, "Asistió", "No asistió") as present_at_middle_call'),
                          con.raw('IF(a.present_at_last_call = 1, "Asistió", "No asistió") as present_at_last_call'),
                          'a.total_duration',
                          'm.started_at','m.finished_at','m.starts_at')
                  .join('topics as t', 't.id', 'm.model_id')
                  .join('attendants as a', 'a.meeting_id', 'm.id')
                  .where('m.model_type', 'App\\Models\\Topic')
                  .andWhere('t.course_id', course_id)
      for (const assistance of assistances) {
          assistance.presence_in_meeting = getTotalDurationPercentInMeeting(assistance);
      }
    break;
  }
  return assistances;
}
function getTotalDurationPercentInMeeting(assistance){
  const meeting_total_duration = getTotalDuration(assistance);
  if (meeting_total_duration > 0){
      return (assistance.total_duration / meeting_total_duration * 100).toFixed(2);
  }
  return 0;
}

function getTotalDuration(meeting) {
  if (meeting.started_at && meeting.finished_at) {
      const started_at = meeting.started_at < meeting.starts_at ?
          meeting.starts_at : meeting.started_at;
      const diffInMinutes = Math.abs((meeting.finished_at - started_at) / (1000 * 60));
      return diffInMinutes;
  }
  return 0;
}
/**
 * Filter user topic status using its code, and return its id
 * @param userTopicStatuses
 * @param code
 * @returns {*|null}
 */
exports.getTopicStatusId = (userTopicStatuses, code) => {
  const status = userTopicStatuses.find((st) => st.code === code);
  return status ? status.id : null;
};

/**
 * Filter user course status using its id, and return its name
 * @param userTopicStatuses
 * @param statusId
 */
exports.getTopicStatusName = (userTopicStatuses, statusId) => {
  const status = userTopicStatuses.find((st) => st.id === statusId);
  return status ? status.name : null;
};

/**
 * Get the id of the compatibles courses
 * @param course_id
 */
exports.loadCompatiblesId = async (course_id) => {
  const [rows_a] = await con.raw(
    `
        select 
          comp.course_a_id as id
        from 
            compatibilities comp
                join courses c_a on c_a.id = comp.course_a_id 
                            and c_a.active = 1
        where 
          comp.course_b_id = ${course_id}
    `
  );

  const [rows_b] = await con.raw(
    `
    select 
      comp.course_b_id as id
    from 
        compatibilities comp
            join courses c_b on c_b.id = comp.course_b_id 
                        and c_b.active = 1
    where 
      comp.course_a_id = ${course_id}
    `
  );

  const rows = [...rows_a, ...rows_b];

  return uniqueElements(rows);
};

/**
 * Get the ids of the compatibles courses
 * @param coursesIds
 */
exports.loadCompatiblesIds = async (coursesIds) => {

  if (!Array.isArray(coursesIds)) return []
  if (coursesIds.length === 0) return []

  const [rows_a] = await con.raw(
    `
        select 
          comp.course_a_id as id
        from 
            compatibilities comp
                join courses c_a on c_a.id = comp.course_a_id 
                            and c_a.active = 1
        where
            comp.course_b_id in (${coursesIds.join(',')})
    `
  )

  const [rows_b] = await con.raw(
    `
    select 
      comp.course_b_id as id
    from 
        compatibilities comp
            join courses c_b on c_b.id = comp.course_b_id 
                        and c_b.active = 1
    where
        comp.course_a_id in (${coursesIds.join(',')})
    `
  );

  const rows = [...rows_a, ...rows_b]

  const ids = pluck(uniqueElements(rows), 'id')

  // Remove courses ids, to keep only compatible ids

  return ids.filter(compatibleId => !coursesIds.includes(compatibleId))
}

exports.loadTopicsByCourseId = async (courses_id) => {
  courses_id = courses_id.filter(el => el != null);

  if (courses_id.length === 0) return [];

  const [rows] = await con.raw(
    `
        select

          t.id as topic_id

        from 
            topics t
        where 
          t.course_id in (${courses_id.join()}) and t.deleted_at is null
    `
  );

  return rows;
}

exports.loadTopicsByCoursesIds = async (
    coursesIds, indexId = false) => {

  const [ topics ] = await con.raw(`
    select
      t.id,
      t.name topic_name,
      t.active topic_active,
      t.assessable topic_assessable,
      t.type_evaluation_id,
      t.qualification_type_id

    from topics t
        inner join courses c on c.id = t.course_id
    where c.id in (${coursesIds.join()}) and t.deleted_at is null`); 

  return indexId ? setCustomIndexAtObject(topics) : topics;
}


exports.loadTopicQualificationTypes = async () => {
  return con("taxonomies")
    .where("group", "system")
    .where("type", "qualification-type");
} 

exports.getTopicCourseGrade = (topic_grade, topic_escala) => {

  if(topic_grade) {
    const grade = (topic_grade / 20 * topic_escala);
    return parseFloat(grade.toFixed(2));
  }
  return '-';
}
