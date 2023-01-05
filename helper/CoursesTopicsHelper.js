const { con } = require("../db");
const { uniqueElements, setCustomIndexAtObject } = require("./Helper");
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
          t.course_id in (${courses_id.join()})
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
      t.type_evaluation_id
    from topics t
        inner join courses c on c.id = t.course_id
    where c.id in (${coursesIds.join()})`); 

  return indexId ? setCustomIndexAtObject(topics) : topics;
}