const { con } = require('../db')
const { pluck, pluckUnique } = require('./Helper')

/**
 * Calculate school percentages for all users
 */

exports.loadUsersSchoolsPercentages = async (coursesIds) => {
  let usersSchoolsPercentages = []

  if (!coursesIds.length) {
    return usersSchoolsPercentages
  }

  // Get schools all courses ids of provided curses' school

  const query = `
      select s.id school_id, cs.course_id
      from schools s
        join course_school cs on cs.school_id = s.id
      where cs.school_id in (
        select distinct s.id
        from schools s
        join course_school cs on cs.school_id = s.id
        where cs.course_id in (${coursesIds.join(',')})
      )
    `
  const [schools] = await con.raw(query)
  const schoolsIds = pluckUnique(schools, 'school_id')
  const schoolsCoursesIds = pluckUnique(schools, 'course_id')

  if (!schoolsIds.length) {
    return usersSchoolsPercentages
  }

  // Calculate user's school progress

  const query2 = `
      select
          sc.user_id,
          s.id school_id,
          schools_totals.courses_count,
          sum(coalesce(sc.advanced_percentage, 0)),
          if (
              schools_totals.courses_count > 0,
              sum(coalesce(sc.advanced_percentage, 0)) / schools_totals.courses_count
              ,
              0
         ) percentage
      from summary_courses sc
               join courses c on c.id = sc.course_id
               join course_school cs on cs.course_id = c.id
               join schools s on cs.school_id = s.id
               join (
                    -- count courses for each school
                    select s.id school_id, count(cs.course_id) courses_count
                    from schools s
                       join course_school cs on cs.school_id = s.id
                    where s.id in (${schoolsIds.join(',')})
                    group by s.id
                ) schools_totals on schools_totals.school_id = s.id
      where sc.course_id in (${schoolsCoursesIds.join(',')})
      group by sc.user_id, s.id
  `

  const [rows] = await con.raw(query2)
  usersSchoolsPercentages = rows

  return usersSchoolsPercentages
}

/**
 * Calculate school percentages for specific user
 */

exports.calculateSchoolProgressPercentage = (usersSchoolsPercentages, userId, schoolId) => {
  const schoolInfo = usersSchoolsPercentages.find(us => {
    return +us.school_id === +schoolId && +us.user_id === +userId
  })

  return schoolInfo
    ? Math.round(schoolInfo.percentage, 2)
    : 0
}
