const { con } = require('../db')
/**
 * Filter user course status using its id, and return its name
 * @param userCourseStatuses
 * @param statusId
 */
exports.getCourseStatusName = (userCourseStatuses, statusId) => {
  const status = userCourseStatuses.find(st => st.id === statusId)
  return (status) ? status.name : null
}

/**
 * Filter user course status using its code, and return its id
 * @param userCourseStatuses
 * @param code
 * @returns {*|null}
 */
exports.getCourseStatusId = (userCourseStatuses, code) => {

  const status = userCourseStatuses.find(st => st.code === code)
  return (status) ? status.id : null
}

/**
 * Filter evaluation type using its id, and return its name
 * @param evaluationTypes
 * @param id
 */
exports.getEvaluationTypeName = (evaluationTypes, id) => {
  const evaluationType = evaluationTypes.find(et => et.id === id)
  return (evaluationType) ? evaluationType.name : null
}

/**
 * Load evaluation types from Taxonomies table
 */
exports.loadEvaluationTypes = async () => {
  return con('taxonomies')
    .where('group', 'topic')
    .where('type', 'evaluation-type')
}

/**
 * Load courses statuses list from database
 */
exports.loadCoursesStatuses = async () => {
  return con('taxonomies')
    .where('group', 'course')
    .where('type', 'user-status')
}

/**
 * Load topics statuses list from database
 */
exports.loadTopicsStatuses = async () => {
  return con('taxonomies')
    .where('group', 'topic')
    .where('type', 'user-status')
}

/**
 * Filter user topic status using its code, and return its id
 * @param userTopicStatuses
 * @param code
 * @returns {*|null}
 */
exports.getTopicStatusId = (userTopicStatuses, code) => {
  const status = userTopicStatuses.find(st => st.code === code)
  return (status) ? status.id : null
}
