const { con } = require('../db')
const { pluck, pluckUnique } = require('./Helper')
const { getCourseStatusId, loadTopicsStatuses, getTopicStatusId } = require('./CoursesTopicsHelper')

/**
 * Calculate school percentages for all users
 */

exports.loadUsersCoursesProgress = async (schoolsIds) => {
  let usersSchoolsPercentages = []

  if (!schoolsIds.length) {
    return usersSchoolsPercentages
  }

  const schoolsCourses = await getSchoolsCoursesIds(schoolsIds)
  const schoolsCoursesIds = pluckUnique(schoolsCourses, 'course_id')

  // Get id of status id

  const [tax] = await con.raw(`select id 
    from taxonomies 
    where \`group\` = 'course' and code = 'enc_pend' `)
  const idPendingPoll = tax[0].id

  // Load user's courses progress

  const query2 = `
      select
          sc.user_id,
          s.id school_id,
          -- When course has a pending poll, its progress
          -- is cosidered zero
          group_concat(
            if (
              sc.status_id = ${idPendingPoll},
              0,
              if (ifnull(sc.advanced_percentage, 0) = 100, 100, 0)
            )
          ) courses_percentages,
          group_concat(
              sc.course_id
          ) courses_ids,
          group_concat(
              if (c.active = 0, sc.course_id, '')
          ) inactive_courses_ids
      from summary_courses sc
        join courses c on c.id = sc.course_id
        join course_school cs on cs.course_id = c.id
        join schools s on cs.school_id = s.id
      where 
          sc.course_id in (${schoolsCoursesIds.join(',')})
      group by sc.user_id, s.id
  `

  const [rows] = await con.raw(query2)
  usersSchoolsPercentages = rows

  // Load users

  return usersSchoolsPercentages
}

/**
 * Calculate school percentages for specific user
 */

exports.calculateSchoolProgressPercentage = (
  usersCoursesProgress, userId, schoolId, userSegmentedSchoolsCourses
) => {
  if (!userSegmentedSchoolsCourses) return 0

  const schoolInfo = usersCoursesProgress.find(us => {
    return +us.school_id === +schoolId &&
      +us.user_id === +userId
  })

  if (!schoolInfo) return 0

  let progressSum = 0;
  let completedCourses = 0;
  let coursesCount = 0;
  let coursedAdded = []
  userSegmentedSchoolsCourses.forEach(ussc => {
    if (+ussc.school_id === +schoolId) {

      let coursesPercentages = schoolInfo.courses_percentages
        ? schoolInfo.courses_percentages.split(',')
        : []

      let summaryCoursesIds = schoolInfo.courses_ids
        ? schoolInfo.courses_ids.split(',')
        : []

      let inactiveCoursesIds = schoolInfo.inactive_courses_ids
        ? schoolInfo.inactive_courses_ids.split(',')
        : []

      const segmentedCourseId = +ussc.course_id;
      const alreadyProcessed = coursedAdded.includes(segmentedCourseId);
      let isInactive = !ussc.course_is_active;

      if (!alreadyProcessed && !isInactive) {

        // Search index of course in summary
        let courseIndex;
        for (let i = 0; i < summaryCoursesIds.length; i++) {

          if (segmentedCourseId === +summaryCoursesIds[i]) {
            courseIndex = i
          }
        }

        // If segmented course exists in summary, get its progress percentage

        if (courseIndex >= 0) {
          let coursePercentage = +coursesPercentages[courseIndex]
          progressSum += coursePercentage

          if (coursePercentage === 100) {
            completedCourses++
          }
        }

        coursesCount++
        coursedAdded.push(segmentedCourseId)
      }
    }
  })

  const percentage = coursesCount > 0
    ? progressSum / coursesCount
    : 0;

  let schoolPercentage = schoolInfo
    ? Math.round(percentage, 2)
    : 0

  if (typeof schoolPercentage === 'undefined' ||
     schoolPercentage === 'undefined' ||
     isNaN(schoolPercentage)) {
    schoolPercentage = 0
  }

  return {
    schoolPercentage,
    completedCourses,
    coursesCount
  }
}

/**
 * Get schools all courses ids of provided curses' school
 */
const getSchoolsCoursesIds = async (schoolsIds) => {

  const query = `
      select s.id school_id, cs.course_id, c.active course_is_active
      from schools s
               join course_school cs on cs.school_id = s.id
               join courses c on cs.course_id = c.id
      where cs.school_id in (${schoolsIds.join(',')})
      group by s.id, c.id
  `
  const [schoolsCourses] = await con.raw(query)

  return schoolsCourses;
}

exports.getSchoolsCoursesIds =  getSchoolsCoursesIds



exports.loadUsersWithCourses = async (
  workspaceId, userCourseStatuses,
  modulesIds, activeUsers, inactiveUsers, schooldIds, coursesIds,
  aprobados, desaprobados, desarrollo, encuestasPendientes, start, end,
  tipocurso
) => {
  // Base query

  let query = `
      select
          u.id
      from users u
               inner join summary_courses sc on u.id = sc.user_id
               inner join courses c on sc.course_id = c.id
               inner join course_school cs on c.id = cs.course_id
               inner join taxonomies tx on tx.id = c.type_id
               inner join schools s on cs.school_id = s.id
               inner join school_subworkspace sw on s.id = sw.school_id

  `
  query += ` where 
      sc.deleted_at is null and
      u.subworkspace_id in (${modulesIds.join()}) and
      sw.subworkspace_id in (${modulesIds.join()}) `


  // Add type_course and dates at ('created_at')
  if(!tipocurso) query += ` and not tx.code = 'free'`
  if(start) query += ` and date(sc.updated_at) >= '${start}'`
  if(end) query += ` and date(sc.updated_at) <= '${end}'`

  // Add condition for schools ids

  if (schooldIds.length > 0) {
    query += ` and s.id in (${schooldIds.join()})`
  }

  // Add condition for courses ids

  if (coursesIds.length > 0) {
    query += ` and c.id in (${coursesIds.join()})`
  }


  // Add user conditions and group sentence

  query += ' group by u.id'

  // Execute query

  const [rows] = await con.raw(query)
  return rows
}

/**
 * Calculate summary topics count (aprobado and desaprobado)
 * for provided users of a specific course
 */
exports.loadSummaryTopicsCount = async (coursesIds, usersIds) => {

  if (!usersIds.length) return []
  if (!coursesIds.length) return []

  // Load user topic statuses

  const userTopicsStatuses = await loadTopicsStatuses()
  const aprobadoId = getTopicStatusId(userTopicsStatuses, 'aprobado')
  const desaprobadoId = getTopicStatusId(userTopicsStatuses, 'desaprobado')
  const revisadoId = getTopicStatusId(userTopicsStatuses, 'revisado')
  const realizadoId = getTopicStatusId(userTopicsStatuses, 'realizado')

  const query = `
      select
          c.id course_id,
          st.user_id,
          count(distinct st.topic_id) summary_topics_count
      from courses c
          left join topics t on t.course_id = c.id
          left join summary_topics st on st.topic_id = t.id
          left join summary_courses sc on sc.course_id = c.id and sc.user_id = st.user_id
      where 
          c.id in (${coursesIds.join(',')}) and
          t.active = 1 and
          st.user_id in (${usersIds.join(',')}) and
          st.status_id in (${aprobadoId}, ${desaprobadoId}, ${revisadoId}, ${realizadoId}) and
          st.deleted_at is null
      group by c.id, st.user_id
  `

  const [rows] = await con.raw(query)
  return rows || []
}

/**
 * Calculate percentage of total amount of topics (aprobados, desaprobados)
 * by the user from segmented courses
 */
exports.calculateSchoolAccomplishmentPercentage = (coursesTopics, userSummaryTopicsCount, userSegmentedSchoolsCourses, schoolId) => {

  if (!userSummaryTopicsCount || !coursesTopics) return 0
  if (!userSegmentedSchoolsCourses) return 0

  // Count topics of all courses

  const coursedAdded = [];
  let assignedTopicsCount = 0;
  let summaryTopicsCount = 0;
  userSegmentedSchoolsCourses.forEach(ussc => {
    if (+ussc.school_id === +schoolId) {

      const segmentedCourseId = +ussc.course_id;
      const alreadyProcessed = coursedAdded.includes(segmentedCourseId);

      if (!alreadyProcessed) {
        let courseInfo = coursesTopics.find(ct => ct.course_id === segmentedCourseId)
        assignedTopicsCount += courseInfo ? courseInfo.topics_count : 0

        let summaryTopicsInfo = userSummaryTopicsCount.find(utc => utc.course_id === segmentedCourseId)

        if (summaryTopicsInfo) {
          summaryTopicsCount += summaryTopicsInfo.summary_topics_count
        }

        coursedAdded.push(segmentedCourseId)
      }
    }
  })

  // Course user summary topics

  if (summaryTopicsCount > assignedTopicsCount) {
    summaryTopicsCount = assignedTopicsCount
  }

  return assignedTopicsCount
    ? Math.round(summaryTopicsCount * 100 / assignedTopicsCount, 2)
    : 0;
}

/**
 * Calculate percentage of total amount of topics (aprobados, desaprobados)
 * by the user from specific course
 */
exports.calculateCourseAccomplishmentPercentage = (courseId, coursesTopics, userSummaryTopicsCount) => {

  if (!userSummaryTopicsCount || !coursesTopics) return 0

  let summaryTopicsInfo = userSummaryTopicsCount.find(utc => utc.course_id === courseId)
  let courseInfo = coursesTopics.find(ct => ct.course_id === courseId)
  let assignedTopicsCount = courseInfo ? courseInfo.topics_count : 0

  if (summaryTopicsInfo) {

    let summaryTopicsCount = summaryTopicsInfo.summary_topics_count;
    if (summaryTopicsCount > assignedTopicsCount) {
      summaryTopicsCount = assignedTopicsCount
    }

    return assignedTopicsCount
      ? Math.round(summaryTopicsCount * 100 / assignedTopicsCount, 2)
      : 0
  } else {
    return 0
  }
}

exports.countCoursesActiveTopics = async (coursesIds) => {

  if (!coursesIds.length) return []

  const query = `
      select 
          c.id course_id,
          count(*) topics_count
      from courses c
        inner join topics t on t.course_id = c.id
      where 
        t.active = 1 
        and t.deleted_at is null
        and c.id in (${coursesIds.join(',')})
      group by c.id
  `

  const [rows] = await con.raw(query)
  return rows || []
}
