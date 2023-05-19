const { con } = require('../db')

/**
 * Calculate school percentages for all users
 */

exports.loadUsersSchoolsPercentages = async (coursesIds) => {
  let usersSchoolsPercentages = []

  if (!coursesIds.length) {
    return usersSchoolsPercentages
  }

  const query = `
      select 
        sc.user_id,
        s.id school_id,
        avg(coalesce(sc.advanced_percentage, 0)) percentage

      from summary_courses sc
        join courses c on c.id = sc.course_id
        join course_school cs on cs.course_id = c.id
        join schools s on cs.school_id = s.id

      where sc.course_id in (${coursesIds.join(',')})
      group by sc.user_id, s.id
  `

  const [rows] = await con.raw(query)
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
