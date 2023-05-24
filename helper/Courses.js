const { con } = require('../db')
const { pluck, pluckUnique } = require('./Helper')
const { getCourseStatusId } = require('./CoursesTopicsHelper')

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

  // Load user's courses progress

  const query2 = `
      select
          sc.user_id,
          s.id school_id,
          sum(
              -- When course has a pending poll, its progress
              -- is cosidered zero
              if (
                  sc.has_pending_poll = 1,
                  0,
                  if (coalesce(sc.advanced_percentage, 0) = 100, 100, 0)
              )
          ) courses_percentage_sum
      from summary_courses sc
               join courses c on c.id = sc.course_id
               join course_school cs on cs.course_id = c.id
               join schools s on cs.school_id = s.id
      where sc.course_id in (${schoolsCoursesIds.join(',')})
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

  let coursesCount = 0;
  userSegmentedSchoolsCourses.forEach(ussc => {
    if (+ussc.school_id === schoolId) {
      coursesCount++
    }
  })

  const percentage = coursesCount > 0
    ? schoolInfo.courses_percentage_sum / coursesCount
    : 0;

  return schoolInfo
    ? Math.round(percentage, 2)
    : 0
}

/**
 * Get schools all courses ids of provided curses' school
 */
const getSchoolsCoursesIds = async (schoolsIds) => {

  const query = `
      select s.id school_id, cs.course_id
      from schools s
        join course_school cs on cs.school_id = s.id
      where cs.school_id in (${schoolsIds.join(',')})
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
        inner join school_workspace sw on s.id = sw.school_id
   
  `
  query += ` where 
      u.subworkspace_id in (${modulesIds.join()}) and
      sw.workspace_id = ${workspaceId} `


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
