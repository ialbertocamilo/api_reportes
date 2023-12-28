const { con } = require('../db')
const sequelize = require('../sequelize.js');
const { Op } = require('sequelize');

const School = require('../models/School');
const SchoolWorkspace = require('../models/SchoolWorkspace');
const Course = require('../models/Course');
const CourseSchool = require('../models/CourseSchool');
const { pluck } = require('./Helper')

exports.getSchoolStatesWorkspace = async (workspaceId, school_sts) => {

  const schools = await School.findAll({
    where: {
      active: {
        [Op.in] : school_sts
      }
    },
    include: [
      {
        model: SchoolWorkspace,
        where: {
          workspace_id: workspaceId
        }
      }
    ]
  });

  return schools.map((el) => el.id); // only ids
  //return schools; // log
};

exports.getSchoolCoursesStates = async (schoolsIds, course_sts) => {

  const courses = await Course.findAll({
    where: {
      active: {
        [Op.in] : course_sts
      }
    },
    include: [
      {
        model: CourseSchool,
        where: {
          school_id: {
            [Op.in] : schoolsIds
          }
        }
      }
    ]
  });

  return courses.map((el) => el.id); // only ids
  // return courses; // log
};

exports.BuildQueryAtDate = (date) => {

    // if not found date
    if(!date.length) 
      return {
        where: {
          certification_issued_at : {
            [Op.not] : null
          }
        }
      };

    const isRange = (date.length === 2);

    // if exist date or dates
    let modelQuery;

    if(isRange) {
        const [ firstDate, secondDate ] = date;

        modelQuery =  {
          where: {
            [Op.and] : [
            sequelize.where(sequelize.fn('date', sequelize.col('certification_issued_at')), '>=', firstDate),
            sequelize.where(sequelize.fn('date', sequelize.col('certification_issued_at')), '<=', secondDate)
            ]
          }
        };

    } else {
      const [ firstDate ] = date;
        
        modelQuery = {
          where: sequelize.where(sequelize.fn('date', sequelize.col('certification_issued_at')), '=', firstDate)
        };
    }

    return modelQuery;
};

/**
 * Generate SQL query to load summary courses with certificates
 * @returns {string}
 */
exports.generateQuery = (
  type, modulesIds, usersIds, usersStatuses, schoolsIds,
  coursesIds, schoolsStatuses, coursesStatuses, date, compatiblesCoursesIds = []
) => {
  const conditions = exports.generateConditions(
    type,
    modulesIds, usersIds, usersStatuses, schoolsIds,
    coursesIds, schoolsStatuses, coursesStatuses, date, compatiblesCoursesIds
  )
  return `
    select 
      w.name workspace_name,
      u.id user_id,
      concat(coalesce(u.lastname, ''), ' ', coalesce(u.surname, ''), ' ', coalesce(u.name, '')) user_fullname,
      u.document user_document,
      u.active user_active,
      s.name school_name,
      s.active school_active,
      tx.name course_type,
      c.id course_id,
      c.name course_name,
      c.active course_active,
      sc.certification_issued_at,
      sc.certification_accepted_at
    from users u
             left join summary_courses sc on u.id = sc.user_id
             join workspaces w on w.id = u.subworkspace_id
             join courses c on c.id = sc.course_id
             left join course_school cs on cs.course_id = c.id
             left join schools s on s.id = cs.school_id
             join taxonomies tx on c.type_id = tx.id
    where
        ${conditions}
  `

}

/**
 * Generate conditions for SQL query
 * @returns {string}
 */
exports.generateConditions = (
  type, modulesIds, usersIds, usersStatuses, schoolsIds,
  coursesIds, schoolsStatuses, coursesStatuses, date,
  compatiblesCoursesIds
) => {
  const modulesCondition = modulesIds.length
    ? ` u.subworkspace_id in (${modulesIds.join(',')})`
    : ''

  const usersCondition = usersIds.length
    ? ` u.id in (${usersIds.join(',')})`
    : ''

  const schoolsCondition = schoolsIds.length
    ? ` and s.id in (${schoolsIds.join(',')})`
    : ''

  const coursesCondition = coursesIds.length
    ? ` and c.id in (${coursesIds.join(',')})`
    : ''

  const usersStatusesCondition = usersStatuses.length
    ? ` and u.active in (${usersStatuses.join(',')})`
    : ''

  const schoolsStatusesCondition = schoolsStatuses.length
    ? ` and s.active in (${schoolsStatuses.join(',')})`
    : ''

  const coursesStatusesCondition = coursesStatuses.length
    ? ` and c.active in (${coursesStatuses.join(',')})`
    : ''

  let compatiblesCoursesCondition = compatiblesCoursesIds.length
    ? ` and sc.course_id in (${compatiblesCoursesIds.join(',')})`
    : ''

  // Generate dates condition

  const isRange = (date.length === 2)
  let datesCondition = ''

  if (isRange) {
    const [firstDate, secondDate] = date
    datesCondition = ` and ( sc.certification_issued_at between '${firstDate}' and '${secondDate}'  )`

  } else {
    const [firstDate] = date
    if (firstDate) {
      datesCondition = ` and sc.certification_issued_at = '${firstDate}'`
    }
  }

  if (type === 'with-diplomas') {
    return `
      ${modulesCondition}
      ${schoolsCondition}
      ${coursesCondition}
      ${usersStatusesCondition}
      ${schoolsStatusesCondition}
      ${coursesStatusesCondition}
      ${datesCondition}
      and certification_issued_at is not null
    `
  }

  if (type === 'without-diplomas') {
    return `
      ${usersCondition}
      ${datesCondition}
      and certification_issued_at is null
    `
  }

  if (type === 'compatible-diplomas') {
    if (compatiblesCoursesCondition) {
      compatiblesCoursesCondition = `
          or
          (
            ${usersCondition}
            ${compatiblesCoursesCondition}
          )
      `
    }
    // c.show_certification_to_user = 1 and
    return `
      (
        certification_issued_at is not null
        ${datesCondition}
        and
        (
          (
            ${modulesCondition}
            ${schoolsCondition}
            ${coursesCondition}
            ${usersStatusesCondition}
            ${schoolsStatusesCondition}
            ${coursesStatusesCondition}
          )
          ${compatiblesCoursesCondition}
        )
      )
    `
  }
}

exports.removeCoursesWithDisabledDiplomas = async (coursesIds) => {


  const [courses] = await con.raw(`
      select
        c.id
      from courses c
      where
        c.id in (${coursesIds.join()})
        and c.show_certification_to_user = 1
  `);

  return pluck(courses, 'id')
}
